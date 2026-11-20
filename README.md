# BotToan — Discord bot

Chạy với Node.js 22 trở lên. Cài dependencies bằng `npm ci`, build bằng `npm run build` và khởi động bằng `npm start`.

## Chat AI

- Đặt `DISCORD_TOKEN` và `GEMINI_API_KEY` trong biến môi trường của host hoặc trong file `.env` tại thư mục gốc dự án. Không commit file `.env`. Biến đã được host cấp được ưu tiên hơn giá trị cùng tên trong file.
- Model mặc định là `gemini-3.5-flash-lite`. Có thể đổi riêng model chat bằng `GEMINI_CHAT_MODEL`.
- Trên Discord, dùng `@BotToan chat Gợi ý phim hay cho cuối tuần`. Cú pháp này ưu tiên chat thay vì dò từ khóa game/soundboard. Mention không kèm lệnh chat vẫn dùng AI nếu không khớp một lệnh khác.
- Chạy `npm test` để kiểm tra luồng chat bằng API giả lập. Chạy `npm run check-ai` để kiểm tra kết nối Gemini thật mà không đăng nhập Discord (tính một lượt gọi API). Trên host chỉ có dependencies production, dùng `node scripts/check-ai.cjs` với bản `dist/` đã build.
- Khi chuyển lên AlwaysData, cấu hình key trên **chính host** và khởi động lại bot. File `.env` trên máy local không được đồng bộ qua Git.