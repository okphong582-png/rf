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
        this.handleChestDetected(cleanUser, data, 'Rương kho báu xu');
      });

      // Lắng nghe sự kiện rương Super Fan
      conn.on(WebcastEvent.SUPER_FAN_BOX, (data) => {
        this.handleChestDetected(cleanUser, data, 'Rương Super Fan');
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
        console.log(`[TikTokTracker] 📴 Kênh @${cleanUser} đã tắt live. Hệ thống vẫn tiếp tục kiểm tra để tự động theo dõi lại ngay khi phát tiếp!`);
        this.cleanupConnection(cleanUser, true);
      });

      // Khi bị mất kết nối
      conn.on('disconnected', () => {
        this.cleanupConnection(cleanUser, true);
      });

      // Khi có lỗi kết nối
      conn.on('error', (err) => {
        this.cleanupConnection(cleanUser, true);
      });

      // Thực hiện kết nối
      const state = await conn.connect();
      this.connectingUsers.delete(cleanUser);
      this.activeConnections.set(cleanUser, conn);
      storage.stats.activeConnections = this.activeConnections.size;

      console.log(`[TikTokTracker] 🟢 @${cleanUser} ĐANG LIVE (RoomId: ${state.roomId}) | Đang theo dõi rương realtime! | Tổng live: ${this.activeConnections.size}/${config.MAX_CONCURRENT_ROOMS}`);

    } catch (err) {
      this.connectingUsers.delete(cleanUser);
      // Kênh đang offline -> đưa lại vào hàng đợi để kiểm tra vòng lặp liên tục cho đến khi live lại
      this.requeueChannel(cleanUser);
    }
  }

  // Đưa kênh trở lại hàng đợi quét định kỳ
  requeueChannel(username) {
    const clean = username.toLowerCase().replace('@', '').trim();
    if (!clean) return;
    if (!this.queue.includes(clean) && !this.activeConnections.has(clean) && !this.connectingUsers.has(clean)) {
      this.queue.push(clean);
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

  // Dọn dẹp kết nối khi streamer offline hoặc kết thúc live
  cleanupConnection(username, shouldRequeue = true) {
    const conn = this.activeConnections.get(username);
    if (conn) {
      try {
        conn.disconnect();
      } catch (e) {}
      this.activeConnections.delete(username);
      storage.stats.activeConnections = this.activeConnections.size;
    }
    this.connectingUsers.delete(username);

    if (shouldRequeue) {
      this.requeueChannel(username);
    }
  }

  // Xử lý khi phát hiện rương
  handleChestDetected(username, data, chestType = 'Rương kho báu xu') {
    if (!data) return;

    // 1. Bỏ qua nếu là sự kiện ẩn / đóng / hết rương (display === 2: HIDE)
    if (data.display === 2) {
      // console.log(`[TikTokTracker] ℹ️ Rương tại @${username} đã kết thúc/ẩn (display: 2).`);
      return;
    }

    const envelope = data.envelopeInfo || {};

    // 2. Trích xuất số lượng xu (diamonds/coins)
    const diamondCount = Number(envelope.diamondCount) ||
                         Number(envelope.diamond_count) ||
                         Number(envelope.coins) ||
                         Number(envelope.voteCount) ||
                         Number(envelope.superFanCount) ||
                         Number(data.treasureBoxData?.coins) || 0;

    // 3. Trích xuất số người có thể nhận
    const peopleCount = Number(envelope.peopleCount) ||
                        Number(envelope.people_count) ||
                        Number(envelope.canOpen) ||
                        Number(data.treasureBoxData?.canOpen) || 0;

    // 4. Bỏ qua nếu số xu và số người đều bằng 0 (thông báo giả/rương đóng)
    if (diamondCount <= 0 && peopleCount <= 0) {
      return;
    }

    // 5. Tính toán thời gian mở rương thật (unpackAt)
    const nowSec = Math.floor(Date.now() / 1000);
    const rawUnpackAt = Number(envelope.unpackAt) ||
                        Number(envelope.unpack_at) ||
                        Number(envelope.openAt) ||
                        Number(data.treasureBoxData?.timestamp) || 0;

    let unpackTimestampSec = 0;
    let remainingSec = 0;

    if (rawUnpackAt > 1000000000000) {
      // Timestamp dạng mili-giây (13 chữ số)
      unpackTimestampSec = Math.floor(rawUnpackAt / 1000);
      remainingSec = Math.max(0, unpackTimestampSec - nowSec);
    } else if (rawUnpackAt > 100000000) {
      // Timestamp Unix chuẩn tính bằng giây (10 chữ số)
      unpackTimestampSec = rawUnpackAt;
      remainingSec = Math.max(0, unpackTimestampSec - nowSec);
    } else if (rawUnpackAt > 0) {
      // Số giây đếm ngược còn lại (ví dụ 180s, 300s)
      remainingSec = rawUnpackAt;
      unpackTimestampSec = nowSec + rawUnpackAt;
    } else {
      // Không có thời gian đếm ngược
      remainingSec = 0;
      unpackTimestampSec = nowSec;
    }

    // 6. Bỏ qua nếu rương đã mở từ trong quá khứ hơn 10 giây trước
    if (unpackTimestampSec > 0 && unpackTimestampSec < (nowSec - 10)) {
      return;
    }

    // 7. Định dạng thời gian đếm ngược thật
    let timeFormatted = '';
    if (remainingSec > 0) {
      const minutes = Math.floor(remainingSec / 60);
      const seconds = remainingSec % 60;
      timeFormatted = `${minutes} phút ${seconds < 10 ? '0' : ''}${seconds} giây`;
    } else {
      timeFormatted = '⚡ Có thể mở ngay bây giờ!';
    }

    const openTimeStr = unpackTimestampSec > 0
      ? new Date(unpackTimestampSec * 1000).toLocaleTimeString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      : 'Mở ngay';

    // 8. Trích xuất tên người tặng
    let sendUserName = (envelope.sendUserName || envelope.send_user_name || '').trim();
    if (!sendUserName && data.common?.displayText?.pieces) {
      for (const p of data.common.displayText.pieces) {
        if (p.userValue?.user?.nickname || p.userValue?.user?.displayId) {
          sendUserName = p.userValue.user.nickname || p.userValue.user.displayId;
          break;
        }
      }
    }
    if (!sendUserName) {
      sendUserName = `Chủ phòng (@${username})`;
    }

    // 9. Kiểm tra chống trùng lặp thông báo rương
    const envelopeId = envelope.envelopeId || `${username}_${diamondCount}_${unpackTimestampSec}`;
    if (this.seenEnvelopes.has(envelopeId)) {
      return;
    }
    this.seenEnvelopes.set(envelopeId, Date.now());
    storage.incrementChestsFound();

    const chestData = {
      username,
      roomUrl: `https://www.tiktok.com/@${username}/live`,
      chestType,
      envelopeId,
      sendUserName,
      diamondCount,
      peopleCount,
      unpackAt: unpackTimestampSec,
      remainingSec,
      timeFormatted,
      openTimeStr
    };

    console.log(`[TikTokTracker] 🎁 PHÁT HIỆN RƯƠNG HỢP LỆ tại @${username} | ${chestData.diamondCount} Xu | ${chestData.peopleCount} người | Đếm ngược: ${timeFormatted}`);

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

  // Chuẩn hoá tên người dùng TikTok hoặc đường dẫn live
  cleanUsername(input) {
    if (!input || typeof input !== 'string') return '';
    let str = input.trim();
    const urlMatch = str.match(/tiktok\.com\/@([a-zA-Z0-9._]+)/i);
    if (urlMatch) {
      str = urlMatch[1];
    }
    str = str.replace(/^[#/]+/, '').replace(/^@+/, '').replace(/\/.*$/, '').trim().toLowerCase();
    if (/^[a-zA-Z0-9._]{2,64}$/.test(str)) {
      return str;
    }
    return '';
  }

  // Thêm kênh thủ công
  addManualChannel(rawInput) {
    const clean = this.cleanUsername(rawInput);
    if (!clean) {
      return { status: 'invalid', username: rawInput };
    }

    if (storage.hasChannel(clean)) {
      // Đã có trong danh sách -> vẫn ưu tiên đưa lên đầu hàng đợi quét ngay
      if (!this.activeConnections.has(clean) && !this.connectingUsers.has(clean)) {
        this.queue.unshift(clean);
        this.processQueue();
      }
      return { status: 'already_exists', username: clean };
    }

    storage.addChannel(clean);
    if (!this.activeConnections.has(clean) && !this.connectingUsers.has(clean)) {
      this.queue.unshift(clean);
      this.processQueue();
    }
    return { status: 'added', username: clean };
  }
}

module.exports = new TikTokTracker();
