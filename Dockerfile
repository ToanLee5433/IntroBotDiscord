# Sử dụng Node.js bản LTS gọn nhẹ
FROM node:20-slim

# Cài đặt các công cụ hệ thống cần thiết cho thư viện Voice (ffmpeg để phát nhạc, python/g++ để build thư viện native)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Thiết lập thư mục làm việc trong container
WORKDIR /app

# Sao chép các cấu hình và mã nguồn cần thiết để biên dịch (giúp tận dụng Docker cache)
COPY package*.json ./
COPY tsconfig.json ./
COPY src/ ./src/

# Cài đặt toàn bộ dependencies (lệnh này sẽ kích hoạt postinstall: tsc thành công vì đã có src)
RUN npm ci

# Sao chép toàn bộ các tài nguyên và file còn lại (assets, audio, v.v.) vào container
COPY . .

# Đảm bảo toàn bộ dự án được build hoàn chỉnh
RUN npm run build

# Cổng mặc định của Hugging Face Spaces là 7860
ENV PORT=7860
EXPOSE 7860

# Khởi chạy bot
CMD ["npm", "start"]
