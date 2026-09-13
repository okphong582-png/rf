const assert = require('assert');
const storage = require('../storage');
const config = require('../config');
const tracker = require('../tiktokTracker');

console.log('--- Đang chạy kiểm thử hệ thống Bot săn rương ---');

// 1. Kiểm tra config
assert(config.BOT_TOKEN, 'BOT_TOKEN phải tồn tại');
assert(config.MAX_CONCURRENT_ROOMS > 0, 'MAX_CONCURRENT_ROOMS phải lớn hơn 0');
assert(config.SEED_CREATORS.length > 0, 'SEED_CREATORS không được rỗng');
console.log('✅ Config: Hợp lệ');

// 2. Kiểm tra Storage
const testChatId = 123456789;
storage.addSubscriber(testChatId);
assert(storage.getSubscribers().includes(testChatId), 'addSubscriber phải lưu được chatId');

storage.removeSubscriber(testChatId);
assert(!storage.getSubscribers().includes(testChatId), 'removeSubscriber phải xoá được chatId');

const testChannel = 'test_streamer_live';
storage.addChannel(testChannel);
assert(storage.getChannels().includes(testChannel), 'addChannel phải lưu được channel');

storage.removeChannel(testChannel);
assert(!storage.getChannels().includes(testChannel), 'removeChannel phải xoá được channel');
console.log('✅ Storage: Tất cả chức năng hoạt động chính xác');

// 3. Kiểm tra lọc gói tin giả lập (display: 2 hoặc 0 xu)
let receivedChest = null;
tracker.onChest((data) => {
  receivedChest = data;
});

// Gói tin đóng rương (display: 2) giống lỗi của @minigamegiaitrivuive
tracker.handleChestDetected('minigamegiaitrivuive', {
  display: 2,
  envelopeInfo: {
    envelopeId: '7685008551714245397',
    diamondCount: 0,
    peopleCount: 0,
    unpackAt: 0,
    sendUserName: ''
  }
});
assert(receivedChest === null, 'Gói tin display: 2 (đóng rương) PHẢI bị bỏ qua!');
console.log('✅ Lọc gói tin đóng rương (display: 2): Hoạt động chuẩn xác');

// Gói tin 0 xu / 0 người
tracker.handleChestDetected('minigamegiaitrivuive', {
  display: 1,
  envelopeInfo: {
    envelopeId: 'dummy_zero',
    diamondCount: 0,
    peopleCount: 0,
    unpackAt: 0
  }
});
assert(receivedChest === null, 'Gói tin 0 xu / 0 người PHẢI bị bỏ qua!');
console.log('✅ Lọc gói tin 0 xu / 0 người: Hoạt động chuẩn xác');

// Gói tin rương thật
const nowSec = Math.floor(Date.now() / 1000);
const realUnpackAt = nowSec + 185; // 3 phút 5 giây
tracker.handleChestDetected('minigamegiaitrivuive', {
  display: 1,
  envelopeInfo: {
    envelopeId: 'real_chest_123',
    diamondCount: 100,
    peopleCount: 20,
    unpackAt: realUnpackAt,
    sendUserName: 'Top1Gifter'
  }
});

assert(receivedChest !== null, 'Rương thật có xu PHẢI được nhận diện!');
assert(receivedChest.diamondCount === 100, 'Số xu phải là 100');
assert(receivedChest.peopleCount === 20, 'Số người nhận phải là 20');
assert(receivedChest.sendUserName === 'Top1Gifter', 'Người gửi phải là Top1Gifter');
assert(receivedChest.timeFormatted.includes('3 phút'), `Thời gian phải hiển thị 3 phút (nhận: ${receivedChest.timeFormatted})`);
console.log(`✅ Nhận diện rương thật: ${receivedChest.diamondCount} Xu, ${receivedChest.peopleCount} người, đếm ngược: ${receivedChest.timeFormatted}`);

console.log('🎉 TẤT CẢ KIỂM THỬ ĐÃ VƯỢT QUA XUẤT SẮC!');
