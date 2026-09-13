const { Telegraf, Markup } = require('telegraf');
const config = require('./config');
const storage = require('./storage');
const tracker = require('./tiktokTracker');

class TelegramBotManager {
  constructor() {
    this.bot = new Telegraf(config.BOT_TOKEN);
    this.setupHandlers();
  }

  setupHandlers() {
    // Lệnh /start - Kích hoạt theo dõi và nhận thông báo
    this.bot.command('start', async (ctx) => {
      const chatId = ctx.chat.id;
      const chatTitle = ctx.chat.title || ctx.chat.first_name || 'Bạn';
      const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';

      storage.addSubscriber(chatId);

      // Kích hoạt tracker nếu chưa chạy
      if (!tracker.isRunning) {
        tracker.start();
      }

      const welcomeMsg = `
🎁 <b>TIKTOK LIVE CHEST HUNTER BOT ĐÃ SẴN SÀNG!</b> 🎁
━━━━━━━━━━━━━━━━━━━━
Chào <b>${chatTitle}</b>!
✅ <b>${isGroup ? 'Nhóm này' : 'Bạn'} đã được đăng ký nhận thông báo rương TikTok Live realtime!</b>

📡 <b>Trạng thái:</b> Đang tự động quét các phòng live và theo dõi realtime.
💎 <b>Khi có rương xu:</b> Bot sẽ lập tức bắn thông báo kèm link trực tiếp, số lượng xu, số người nhận và số phút thật đếm ngược!

📋 <b>Danh sách lệnh hữu ích:</b>
• /status - Xem trạng thái hoạt động & thống kê
• /add &lt;kênh&gt; - Thêm kênh TikTok cụ thể (ví dụ: <code>/add datvilla94</code>)
• /remove &lt;kênh&gt; - Xoá kênh khỏi danh sách quét
• /list - Xem danh sách kênh đang theo dõi
• /stop - Dừng nhận thông báo rương tại nhóm/chat này
• /help - Hướng dẫn chi tiết
━━━━━━━━━━━━━━━━━━━━
<i>Chúc bạn nhặt được thật nhiều xu rương! 🪙✨</i>
      `.trim();

      await ctx.replyWithHTML(welcomeMsg, {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('📊 Kiểm tra trạng thái', 'check_status')],
          [Markup.button.callback('📋 Danh sách kênh', 'check_list')]
        ]).reply_markup
      });
    });

    // Lệnh /stop - Huỷ nhận thông báo
    this.bot.command('stop', async (ctx) => {
      const chatId = ctx.chat.id;
      storage.removeSubscriber(chatId);
      await ctx.replyWithHTML('🛑 <b>Đã dừng nhận thông báo rương tại đây.</b>\nGõ /start bất cứ lúc nào để kích hoạt lại!');
    });

    // Lệnh /status - Xem trạng thái
    this.bot.command('status', async (ctx) => {
      await this.sendStatus(ctx);
    });

    this.bot.action('check_status', async (ctx) => {
      await ctx.answerCbQuery();
      await this.sendStatus(ctx);
    });

    // Lệnh /add - Thêm streamer
    this.bot.command('add', async (ctx) => {
      const text = ctx.message.text.trim();
      const parts = text.split(/\s+/);
      if (parts.length < 2) {
        return ctx.replyWithHTML('⚠️ Vui lòng nhập tên kênh TikTok cần thêm.\nVí dụ: <code>/add datvilla94</code>');
      }
      const username = parts[1].replace('@', '').trim();
      const ok = tracker.addManualChannel(username);
      if (ok) {
        await ctx.replyWithHTML(`✅ Đã thêm kênh <b>@${username}</b> vào danh sách theo dõi và ưu tiên kết nối ngay!`);
      } else {
        await ctx.replyWithHTML(`⚠️ Kênh không hợp lệ hoặc đã có trong danh sách.`);
      }
    });

    // Lệnh /remove - Xoá streamer
    this.bot.command('remove', async (ctx) => {
      const text = ctx.message.text.trim();
      const parts = text.split(/\s+/);
      if (parts.length < 2) {
        return ctx.replyWithHTML('⚠️ Vui lòng nhập tên kênh cần xoá.\nVí dụ: <code>/remove datvilla94</code>');
      }
      const username = parts[1].replace('@', '').trim();
      const removed = storage.removeChannel(username);
      if (removed) {
        tracker.cleanupConnection(username);
        await ctx.replyWithHTML(`🗑️ Đã xoá kênh <b>@${username}</b> khỏi danh sách.`);
      } else {
        await ctx.replyWithHTML(`⚠️ Kênh <b>@${username}</b> không có trong danh sách.`);
      }
    });

    // Lệnh /list - Xem danh sách kênh
    this.bot.command('list', async (ctx) => {
      await this.sendList(ctx);
    });

    this.bot.action('check_list', async (ctx) => {
      await ctx.answerCbQuery();
      await this.sendList(ctx);
    });

    // Lệnh /help - Trợ giúp
    this.bot.command('help', async (ctx) => {
      const helpMsg = `
📖 <b>HƯỚNG DẪN SỬ DỤNG BOT SĂN RƯƠNG TIKTOK</b>
━━━━━━━━━━━━━━━━━━━━
Bot hoạt động tự động 24/7, liên tục quét các phòng live TikTok phổ biến và các trận PK lớn để phát hiện rương xu.

📌 <b>Các lệnh quản trị:</b>
• <code>/start</code> : Bắt đầu nhận thông báo rương tại nhóm hoặc chat riêng
• <code>/stop</code> : Ngừng nhận thông báo
• <code>/status</code> : Xem thống kê số phòng đang theo dõi, số rương đã phát hiện
• <code>/add &lt;tên_kênh&gt;</code> : Thêm kênh TikTok streamer bạn muốn theo dõi
• <code>/remove &lt;tên_kênh&gt;</code> : Xoá kênh khỏi danh sách
• <code>/list</code> : Hiển thị các kênh đang được hệ thống quét
• <code>/help</code> : Hiển thị bảng trợ giúp này

💡 <b>Mẹo nhặt rương:</b> Khi nhận được thông báo, hãy nhấn ngay nút <b>[ 🚀 Vào Nhặt Rương Ngay ]</b> để mở TikTok và chờ đồng hồ đếm ngược kết thúc để bấm nhận xu!
      `.trim();
      await ctx.replyWithHTML(helpMsg);
    });

    // Lỗi bot
    this.bot.catch((err, ctx) => {
      console.error(`[TelegramBot] Lỗi Telegraf cho update ${ctx.updateType}:`, err.message);
    });
  }

  async sendStatus(ctx) {
    const stats = storage.getStats();
    const activeCount = tracker.activeConnections.size;
    const waitingCount = Math.max(0, stats.channelsCount - activeCount);

    const statusMsg = `
📊 <b>TRẠNG THÁI HỆ THỐNG BOT SĂN RƯƠNG</b>
━━━━━━━━━━━━━━━━━━━━
⏱️ <b>Thời gian hoạt động:</b> ${stats.uptime}
🟢 <b>Phòng đang phát live & theo dõi:</b> ${activeCount}/${config.MAX_CONCURRENT_ROOMS}
🔄 <b>Kênh chờ live lại (đang quét liên tục):</b> ${waitingCount} kênh
📋 <b>Tổng kênh trong hệ thống:</b> ${stats.channelsCount} kênh
🎁 <b>Tổng rương đã phát hiện:</b> ${stats.chestsFound} rương
👥 <b>Số nhóm/người nhận thông báo:</b> ${stats.subscribersCount}
━━━━━━━━━━━━━━━━━━━━
<i>💡 Cơ chế tự động: Khi streamer tắt live, bot vẫn giữ kênh trong hàng đợi và liên tục kiểm tra định kỳ 24/7. Ngay khi streamer mở live lại, bot sẽ tự động kết nối và theo dõi rương ngay lập tức!</i>
    `.trim();

    await ctx.replyWithHTML(statusMsg);
  }

  async sendList(ctx) {
    const channels = storage.getChannels();
    const activeList = Array.from(tracker.activeConnections.keys());

    let listText = `📋 <b>DANH SÁCH KÊNH THEO DÕI (${channels.length} kênh)</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
    if (activeList.length > 0) {
      listText += `🟢 <b>Đang phát live & theo dõi (${activeList.length}):</b>\n`;
      listText += activeList.map(u => `• @${u}`).join(', ') + '\n\n';
    }

    listText += `📡 <b>Kênh trong hàng đợi quét:</b>\n`;
    const sample = channels.slice(0, 30);
    listText += sample.map(u => `@${u}`).join(', ');
    if (channels.length > 30) {
      listText += `\n... và còn ${channels.length - 30} kênh khác.`;
    }

    listText += `\n━━━━━━━━━━━━━━━━━━━━\n<i>Thêm kênh mới bằng lệnh: <code>/add &lt;tên_kênh&gt;</code></i>`;

    await ctx.replyWithHTML(listText);
  }

  // Bắn thông báo rương tới tất cả người đăng ký
  async broadcastChestAlert(chestData) {
    const subscribers = storage.getSubscribers();
    if (subscribers.length === 0) {
      console.log('[TelegramBot] ⚠️ Chưa có nhóm/người dùng nào /start để nhận thông báo rương.');
      return;
    }

    const messageHtml = `
🎁 <b>PHÁT HIỆN ${chestData.chestType.toUpperCase()}!</b> 🎁
━━━━━━━━━━━━━━━━━━━━
👤 <b>Kênh Live:</b> <code>@${chestData.username}</code>
🔗 <b>Link phòng live:</b> <a href="${chestData.roomUrl}">${chestData.roomUrl}</a>

💰 <b>Số lượng xu:</b> <b>${chestData.diamondCount.toLocaleString('vi-VN')} Xu (Diamonds)</b> 🪙
👥 <b>Số người nhận:</b> <b>${chestData.peopleCount} người</b>
⏳ <b>Thời gian còn lại:</b> <b>${chestData.timeFormatted}</b>
⏰ <b>Thời điểm mở:</b> <b>${chestData.openTimeStr}</b> (Giờ VN)
🎁 <b>Người gửi rương:</b> ${chestData.sendUserName}
━━━━━━━━━━━━━━━━━━━━
👉 <i>Nhanh tay nhấn nút bên dưới để vào nhặt rương kẻo hết!</i>
    `.trim();

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.url('🚀 Vào Nhặt Rương Ngay', chestData.roomUrl)]
    ]);

    for (const chatId of subscribers) {
      try {
        await this.bot.telegram.sendMessage(chatId, messageHtml, {
          parse_mode: 'HTML',
          ...keyboard
        });
      } catch (err) {
        console.error(`[TelegramBot] Lỗi gửi tin tới chat ${chatId}:`, err.message);
        // Nếu bot bị chặn hoặc xoá khỏi nhóm, huỷ đăng ký
        if (err.message.includes('bot was blocked') || err.message.includes('chat not found') || err.message.includes('bot was kicked')) {
          storage.removeSubscriber(chatId);
        }
      }
    }
  }

  async launch() {
    console.log('[TelegramBot] 🤖 Đang khởi chạy Telegram Bot...');
    try {
      await this.bot.launch({ dropPendingUpdates: true });
      console.log('[TelegramBot] ✅ Bot đã kết nối Telegram thành công và đang lắng nghe lệnh!');
    } catch (err) {
      console.error('[TelegramBot] Lỗi kết nối Telegraf:', err.message);
      if (err.message.includes('409') || err.message.includes('conflict')) {
        console.log('[TelegramBot] Phát hiện phiên bot cũ đang chạy, đang đợi 8s để phiên cũ ngắt...');
        await new Promise(r => setTimeout(r, 8000));
        await this.bot.launch({ dropPendingUpdates: true });
        console.log('[TelegramBot] ✅ Bot đã kết nối lại Telegram thành công!');
      } else {
        throw err;
      }
    }
  }

  stop() {
    try {
      this.bot.stop();
    } catch (e) {}
  }
}

module.exports = new TelegramBotManager();
