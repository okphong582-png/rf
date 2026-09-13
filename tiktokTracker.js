const { TikTokLiveConnection, WebcastEvent } = require('tiktok-live-connector');
const config = require('./config');
const storage = require('./storage');

class TikTokTracker {
  constructor() {
    this.activeConnections = new Map(); // username -> conn
    this.connectingUsers = new Set();
    this.queue = [];
    this.seenEnvelopes = new Map(); // key -> timestamp
    this.onChestCallback = null;
    this.isRunning = false;
    this.loopTimer = null;
    this.cacheCleanupTimer = null;
  }

  // Đăng ký callback khi tìm thấy rương
  onChest(callback) {
    this.onChestCallback = callback;
  }

  // Khởi động trình theo dõi
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[TikTokTracker] 🚀 Khởi động hệ thống quét và theo dõi rương TikTok Live realtime...');

    // Nạp danh sách kênh vào hàng đợi
    this.refreshQueue();

    // Vòng lặp kiểm tra hàng đợi định kỳ
    this.loopTimer = setInterval(() => {
      this.processQueue();
    }, config.QUEUE_CHECK_INTERVAL_SEC * 1000);

    // Dọn dẹp cache rương cũ mỗi 5 phút
    this.cacheCleanupTimer = setInterval(() => {
      this.cleanupCache();
    }, 5 * 60 * 1000);

    // Chạy xử lý ngay lập tức
    this.processQueue();
  }

  // Dừng trình theo dõi
  stop() {
    this.isRunning = false;
    if (this.loopTimer) clearInterval(this.loopTimer);
    if (this.cacheCleanupTimer) clearInterval(this.cacheCleanupTimer);

    console.log('[TikTokTracker] 🛑 Đang ngắt kết nối toàn bộ phòng live...');
    for (const [username, conn] of this.activeConnections.entries()) {
      try {
        conn.disconnect();
      } catch (err) {
        // bỏ qua
      }
    }
    this.activeConnections.clear();
    this.connectingUsers.clear();
    storage.stats.activeConnections = 0;
  }

  // Làm mới hàng đợi từ storage
  refreshQueue() {
    const allChannels = storage.getChannels();
    // Trộn ngẫu nhiên để quét đa dạng
    const shuffled = [...allChannels].sort(() => 0.5 - Math.random());
    for (const ch of shuffled) {
      if (!this.queue.includes(ch) && !this.activeConnections.has(ch) && !this.connectingUsers.has(ch)) {
        this.queue.push(ch);
      }
    }
    console.log(`[TikTokTracker] 📋 Đã nạp ${this.queue.length} kênh vào hàng đợi quét.`);
  }

  // Xử lý hàng đợi kết nối
  async processQueue() {
    if (!this.isRunning) return;

    // Cập nhật số kết nối đang hoạt động
    storage.stats.activeConnections = this.activeConnections.size;

    // Nếu hàng đợi sắp hết, nạp thêm
    if (this.queue.length < 5) {
      this.refreshQueue();
    }

    const availableSlots = config.MAX_CONCURRENT_ROOMS - (this.activeConnections.size + this.connectingUsers.size);
    if (availableSlots <= 0) {
      return;
    }

    // Lấy số lượng kênh theo số slots trống
    for (let i = 0; i < availableSlots; i++) {
      if (this.queue.length === 0) break;
      const username = this.queue.shift();
      if (username && !this.activeConnections.has(username) && !this.connectingUsers.has(username)) {
        this.connectToStream(username).catch(err => {
          console.error(`[TikTokTracker] Lỗi kết nối tới @${username}:`, err.message);
        });
      }
    }
  }

  // Kết nối tới 1 streamer cụ thể
  async connectToStream(username) {
    const cleanUser = username.toLowerCase().replace('@', '').trim();
    if (this.activeConnections.has(cleanUser) || this.connectingUsers.has(cleanUser)) {
      return;
    }

    this.connectingUsers.add(cleanUser);

    try {
      // Chú ý: luôn truyền đối tượng options {} để tương thích tiktok-live-connector v2.4+
      const conn = new TikTokLiveConnection(cleanUser, {
        processInitialData: true,
        enableExtendedGiftInfo: false,
        clientPresets: undefined
      });

      // Lắng nghe sự kiện rương (Treasure Box / Envelope)
      conn.on(WebcastEvent.ENVELOPE, (data) => {
        const envelope = data.envelopeInfo;
        if (envelope) {
          this.handleChestDetected(cleanUser, envelope, 'Rương kho báu xu');
        }
      });

      // Lắng nghe sự kiện rương Super Fan
      conn.on(WebcastEvent.SUPER_FAN_BOX, (data) => {
        const envelope = data.envelopeInfo;
        if (envelope) {
          this.handleChestDetected(cleanUser, envelope, 'Rương Super Fan');
        }
      });

      // Tự động phát hiện đối thủ qua PK Battle để mở rộng danh sách live
      conn.on(WebcastEvent.LINK_MIC_BATTLE, (data) => {
        try {
          if (data.anchorInfo) {
            for (const info of Object.values(data.anchorInfo)) {
              const rival = info.user?.displayId || info.user?.uniqueId;
              if (rival && rival.toLowerCase() !== cleanUser) {
                this.addDiscoveredStreamer(rival);
              }
            }
          }
        } catch (e) {
          // bỏ qua
        }
      });

      // Khi kết thúc live
      conn.on(WebcastEvent.STREAM_END, () => {
        console.log(`[TikTokTracker] 📴 Phiên live của @${cleanUser} đã kết thúc.`);
        this.cleanupConnection(cleanUser);
      });

      // Khi bị mất kết nối
      conn.on('disconnected', () => {
        this.cleanupConnection(cleanUser);
      });

      // Khi có lỗi
      conn.on('error', (err) => {
        // console.error(`[TikTokTracker] Lỗi room @${cleanUser}:`, err.message);
        this.cleanupConnection(cleanUser);
      });

      // Thực hiện kết nối
      const state = await conn.connect();
      this.connectingUsers.delete(cleanUser);
      this.activeConnections.set(cleanUser, conn);
      storage.stats.activeConnections = this.activeConnections.size;

      console.log(`[TikTokTracker] ✅ Đang theo dõi @${cleanUser} (RoomId: ${state.roomId}) | Tổng: ${this.activeConnections.size}/${config.MAX_CONCURRENT_ROOMS}`);

    } catch (err) {
      this.connectingUsers.delete(cleanUser);
      // Nếu offline, đưa lại vào cuối hàng đợi để kiểm tra sau
      // console.log(`[TikTokTracker] @${cleanUser} hiện không phát live (${err.message}).`);
    }
  }

  // Tự động thêm streamer được phát hiện từ PK Battle hoặc người dùng
  addDiscoveredStreamer(username) {
    const clean = username.toLowerCase().replace('@', '').trim();
    if (!clean) return;

    const added = storage.addChannel(clean);
    if (added) {
      console.log(`[TikTokTracker] 🔍 Tự động phát hiện streamer mới từ PK: @${clean}`);
      // Ưu tiên đưa lên đầu hàng đợi để kết nối ngay
      if (!this.activeConnections.has(clean) && !this.connectingUsers.has(clean)) {
        this.queue.unshift(clean);
      }
    }
  }

  // Dọn dẹp kết nối khi streamer offline hoặc lỗi
  cleanupConnection(username) {
    const conn = this.activeConnections.get(username);
    if (conn) {
      try {
        conn.disconnect();
      } catch (e) {}
      this.activeConnections.delete(username);
      storage.stats.activeConnections = this.activeConnections.size;
    }
    this.connectingUsers.delete(username);
  }

  // Xử lý khi phát hiện rương
  handleChestDetected(username, envelope, chestType = 'Rương kho báu xu') {
    const nowSec = Math.floor(Date.now() / 1000);
    const envelopeId = envelope.envelopeId || `${username}_${envelope.diamondCount}_${envelope.unpackAt}`;

    // Kiểm tra trùng lặp rương
    if (this.seenEnvelopes.has(envelopeId)) {
      return;
    }
    this.seenEnvelopes.set(envelopeId, Date.now());
    storage.incrementChestsFound();

    // Tính thời gian mở rương thật
    const unpackAt = Number(envelope.unpackAt) || (nowSec + 300);
    const remainingSec = Math.max(0, unpackAt - nowSec);
    const minutes = Math.floor(remainingSec / 60);
    const seconds = remainingSec % 60;

    const timeFormatted = `${minutes} phút ${seconds < 10 ? '0' : ''}${seconds} giây`;
    const openTimeStr = new Date(unpackAt * 1000).toLocaleTimeString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const chestData = {
      username,
      roomUrl: `https://www.tiktok.com/@${username}/live`,
      chestType,
      envelopeId,
      sendUserName: envelope.sendUserName || 'Người dùng ẩn danh',
      diamondCount: envelope.diamondCount || 0,
      peopleCount: envelope.peopleCount || 0,
      unpackAt,
      remainingSec,
      timeFormatted,
      openTimeStr
    };

    console.log(`[TikTokTracker] 🎁 PHÁT HIỆN RƯƠNG tại @${username} | ${chestData.diamondCount} Xu | ${chestData.peopleCount} người | Đếm ngược: ${timeFormatted}`);

    if (typeof this.onChestCallback === 'function') {
      try {
        this.onChestCallback(chestData);
      } catch (err) {
        console.error('[TikTokTracker] Lỗi khi gọi callback onChest:', err.message);
      }
    }
  }

  // Dọn dẹp cache rương cũ quá TTL
  cleanupCache() {
    const expireTime = Date.now() - config.CHEST_CACHE_TTL_MINUTES * 60 * 1000;
    for (const [key, ts] of this.seenEnvelopes.entries()) {
      if (ts < expireTime) {
        this.seenEnvelopes.delete(key);
      }
    }
  }

  // Thêm kênh thủ công
  addManualChannel(username) {
    const clean = username.toLowerCase().replace('@', '').trim();
    if (!clean) return false;
    storage.addChannel(clean);
    if (!this.activeConnections.has(clean) && !this.connectingUsers.has(clean)) {
      this.queue.unshift(clean);
      this.processQueue();
    }
    return true;
  }
}

module.exports = new TikTokTracker();
