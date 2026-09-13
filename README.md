# 🎁 TikTok Live Chest Hunter - Telegram Bot Node.js

Bot Telegram tự động theo dõi, tìm kiếm các phiên live trên TikTok và quét rương (Treasure Box / Kho báu xu) theo thời gian thực (realtime). Khi phát hiện rương, bot sẽ lập tức gửi thông báo trực tiếp đến nhóm hoặc cá nhân kèm link xem live, số lượng xu, số người nhận và số phút đếm ngược thật.

---

## 🌟 Tính Năng Chính

- 🤖 **Kích hoạt tức thì**: Người dùng hoặc nhóm chỉ cần gõ `/start` là bot bắt đầu theo dõi và bắn thông báo.
- 📡 **Theo dõi Realtime**: Sử dụng kết nối Webcast WebSocket tới các phòng live để bắt sự kiện rương ngay khi người dùng nạp rương.
- 💎 **Thông tin chi tiết**:
  - Tên kênh live & link trực tiếp (`https://www.tiktok.com/@username/live`)
  - Số lượng xu rương (Diamonds/Coins)
  - Số người có thể nhận rương
  - Số phút đếm ngược thật chính xác đến từng giây
  - Nút bấm trực tiếp `[ 🚀 Vào Nhặt Rương Ngay ]`
- 🔍 **Tự động mở rộng & dò tìm live mới**:
  - Quét danh sách hơn 40+ kênh top streamer thường xuyên phát live và PK.
  - Tự động trích xuất kênh đối thủ qua các trận PK / Battle (`linkMicBattle`) và đưa vào hàng đợi theo dõi.
  - Cho phép người dùng bổ sung thêm kênh bằng lệnh `/add <kênh>`.
- 🔁 **Tự động chạy chu kỳ 5 tiếng trên GitHub Actions**:
  - Chạy liên tục 24/7 bằng GitHub Actions.
  - Tự ngắt trước mốc 5 tiếng và kích hoạt chu kỳ mới qua GitHub Actions API + Cron Job dự phòng.

---

## 📋 Danh Sách Lệnh Telegram Bot

| Lệnh | Mô tả |
|------|-------|
| `/start` | Kích hoạt nhận thông báo rương tại nhóm hoặc chat riêng |
| `/stop` | Dừng nhận thông báo rương tại nhóm hoặc chat này |
| `/status` | Xem báo cáo trạng thái hệ thống, số phòng đang xem, số rương đã tìm |
| `/add <kênh>` | Thêm kênh TikTok vào danh sách theo dõi (Ví dụ: `/add datvilla94`) |
| `/remove <kênh>` | Xoá kênh khỏi danh sách |
| `/list` | Xem danh sách các kênh đang theo dõi |
| `/help` | Xem bảng trợ giúp hướng dẫn |

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Cục Bộ (Local)

### 1. Yêu cầu
- Node.js >= 18.0.0
- npm hoặc yarn

### 2. Cài đặt thư viện
```bash
npm install
```

### 3. Cấu hình biến môi trường
Tạo file `.env` (nếu cần đổi token khác):
```env
BOT_TOKEN=8738721874:AAG22QXgkzi8tURDRWJLkmJQUCtdbIxnG2E
MAX_CONCURRENT_ROOMS=15
```

### 4. Khởi động bot
```bash
npm start
```

---

## ⚙️ Cơ Chế Chạy 5 Tiếng Tự Khởi Động Lại Trên GitHub Actions

1. Repository đã được tích hợp file workflow tại `.github/workflows/run.yml`.
2. Khi code được đẩy lên nhánh `main`, GitHub Actions sẽ tự động kích hoạt job.
3. Bot chạy trong 4 giờ 50 phút (~5 tiếng).
4. Khi kết thúc chu kỳ, bước cuối cùng của job sẽ tự động gọi API GitHub Actions (`curl /dispatches`) để kích hoạt một lượt chạy mới ngay lập tức.
5. Ngoài ra, lịch biểu Cron `0 */5 * * *` được cấu hình để dự phòng kích hoạt lại nếu luồng API bị trễ, đảm bảo bot hoạt động liên tục vô tận 24/7.
