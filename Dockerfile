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

# Sao chép các file cấu hình package để tận dụng Docker cache
COPY package*.json ./

# Cài đặt toàn bộ dependencies (bao gồm cả devDependencies để biên dịch TypeScript)
RUN npm ci

# Sao chép toàn bộ mã nguồn dự án vào container
COPY . .

# Biên dịch mã nguồn TypeScript sang JavaScript
RUN npm run build

# Cổng mặc định của Hugging Face Spaces là 7860
ENV PORT=7860
EXPOSE 7860

# Khởi chạy bot
CMD ["npm", "start"]
