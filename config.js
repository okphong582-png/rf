require('dotenv').config();

module.exports = {
  // Token Telegram Bot
  BOT_TOKEN: process.env.BOT_TOKEN || '8738721874:AAG22QXgkzi8tURDRWJLkmJQUCtdbIxnG2E',

  // Số lượng phòng live theo dõi đồng thời tối đa
  MAX_CONCURRENT_ROOMS: parseInt(process.env.MAX_CONCURRENT_ROOMS, 10) || 15,

  // Thời gian tối đa chạy một phiên trước khi tự khởi động lại (4 giờ 50 phút = 17400000 ms)
  MAX_RUNTIME_MS: parseInt(process.env.MAX_RUNTIME_MS, 10) || (4 * 60 + 50) * 60 * 1000,

  // Khoảng thời gian quét kiểm tra hàng đợi (giây)
  QUEUE_CHECK_INTERVAL_SEC: 10,

  // Thời gian lưu cache rương để tránh gửi trùng lặp (phút)
  CHEST_CACHE_TTL_MINUTES: 15,

  // Danh sách các kênh TikTok Live mẫu (kênh thường xuyên phát live, PK, nạp xu tặng rương)
  SEED_CREATORS: [
    // Top streamer / PK Việt Nam
    'datvilla94',
    'phongbatu',
    'phamthoai',
    'chichilive',
    'linhbarbie',
    'tiendung_official',
    'hothienly_official',
    'ngank98',
    'quoccuong.live',
    'khanhhuyen204',
    'hoaa.hanassii',
    'trucvy_live',
    'thienphuc_pk',
    'hoanghon_live',
    'tramanh.live',
    'vietnam_pk_show',
    'thanhtung.official',
    'minhhang_stream',
    'haiyen.live',
    'ducphat_pk',

    // Top live quốc tế / gaming / PK Châu Á
    'charlidamelio',
    'bellapoarch',
    'khaby.lame',
    'addisonre',
    'mrbeast',
    'zachking',
    'dixiedamelio',
    'spencerx',
    'lorengray',
    'justmaiko',
    'brentrivera',
    'avani',
    'riyaz.14',
    'camerondallas',
    'jiffpom',
    'dobretwins',
    'jamescharles',
    'lilhuddy',
    'stokestwins',
    'gilmhercroes'
  ]
};
