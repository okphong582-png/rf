const config = require('./config');
const storage = require('./storage');
const tracker = require('./tiktokTracker');
const telegramBot = require('./telegramBot');

async function main() {
  console.log('====================================================');
  console.log('   TIKTOK LIVE CHEST HUNTER - TELEGRAM BOT NODEJS   ');
  console.log('====================================================');
  console.log(`[Main] Max Runtime: ${(config.MAX_RUNTIME_MS / 3600000).toFixed(2)} giờ (~5 tiếng)`);
  console.log(`[Main] Max Concurrent Rooms: ${config.MAX_CONCURRENT_ROOMS}`);
  console.log(`[Main] Total Seed Channels: ${storage.getChannels().length}`);

  // Liên kết sự kiện phát hiện rương với việc bắn tin nhắn Telegram
  tracker.onChest((chestData) => {
    telegramBot.broadcastChestAlert(chestData);
  });

  // Khởi động Telegram Bot
  await telegramBot.launch();

  // Khởi động trình theo dõi rương TikTok
  tracker.start();

  // Thiết lập hẹn giờ tự ngắt sau gần 5 tiếng để GitHub Actions tái khởi động chu kỳ mới
  console.log(`[Main] ⏳ Đã đặt lịch chạy ${((config.MAX_RUNTIME_MS) / (1000 * 60)).toFixed(0)} phút. Sau đó tiến trình sẽ tự hoàn tất để kích hoạt chu kỳ 5 tiếng tiếp theo.`);
  setTimeout(() => {
    console.log('[Main] ⏰ Đã hết chu kỳ 5 tiếng! Đang lưu trạng thái và dừng bot an toàn...');
    tracker.stop();
    telegramBot.stop();
    setTimeout(() => {
      console.log('[Main] ✅ Chu kỳ kết thúc sạch. Hẹn gặp lại ở chu kỳ tiếp theo!');
      process.exit(0);
    }, 3000);
  }, config.MAX_RUNTIME_MS);
}

// Xử lý tắt tiến trình mượt mà (Graceful shutdown)
function handleShutdown(signal) {
  console.log(`\n[Main] Nhận tín hiệu ${signal}. Đang dừng hệ thống an toàn...`);
  tracker.stop();
  telegramBot.stop();
  setTimeout(() => {
    process.exit(0);
  }, 2000);
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Main] Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Main] Uncaught Exception:', err);
});

main().catch(err => {
  console.error('[Main] Lỗi nghiêm trọng khi khởi chạy:', err);
  process.exit(1);
});
