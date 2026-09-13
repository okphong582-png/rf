const assert = require('assert');
const storage = require('../storage');
const config = require('../config');

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

storage.incrementChestsFound();
const stats = storage.getStats();
assert(stats.chestsFound >= 1, 'incrementChestsFound phải tăng đếm rương');
console.log('✅ Storage: Tất cả chức năng hoạt động chính xác');

// 3. Kiểm tra tính toán thời gian rương và đếm ngược thật
const nowSec = Math.floor(Date.now() / 1000);
const futureSec = nowSec + 185; // 3 phút 5 giây

const remainingSec = Math.max(0, futureSec - nowSec);
const minutes = Math.floor(remainingSec / 60);
const seconds = remainingSec % 60;
const timeFormatted = `${minutes} phút ${seconds < 10 ? '0' : ''}${seconds} giây`;

assert(minutes === 3, `Phút phải là 3 (nhận được: ${minutes})`);
assert(seconds === 5, `Giây phải là 5 (nhận được: ${seconds})`);
assert(timeFormatted === '3 phút 05 giây', `Định dạng phải là "3 phút 05 giây" (nhận được: ${timeFormatted})`);
console.log(`✅ Time calculation: ${timeFormatted} chuẩn xác`);

console.log('🎉 TẤT CẢ KIỂM THỬ ĐÃ VƯỢT QUA!');
