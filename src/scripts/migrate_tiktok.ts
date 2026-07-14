import * as fs from 'fs';
import * as path from 'path';
import mongoose from 'mongoose';

// Tự động load file .env thủ công trước tiên để đảm bảo các biến môi trường được thiết lập
const envPath = path.join(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)$/);
        if (match) {
            const key = match[1].trim();
            let val = match[2].trim();
            // Loại bỏ dấu ngoặc kép nếu có
            if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
            if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
            process.env[key] = val;
        }
    });
}

async function run() {
    // Import động để đảm bảo biến môi trường đã được load
    const { connectDB, getWarmupVideos, updateWarmupVideo } = await import('../database');

    console.log("🔄 Đang kết nối tới MongoDB...");
    await connectDB();

    console.log("🔍 Đang tải danh sách video từ Database...");
    const videos = await getWarmupVideos();
    console.log(`📊 Tìm thấy tổng cộng ${videos.length} video trong DB.`);

    let updatedCount = 0;

    for (const video of videos) {
        if (!video.id) continue;

        let needsUpdate = false;
        const updateData: any = {};

        // 1. Chuyển đổi thể loại từ 'Tiktok' sang 'TikTok của Trang Anh'
        if (video.category === 'Tiktok') {
            updateData.category = 'TikTok của Trang Anh';
            needsUpdate = true;
        }

        // 2. Chuyển đổi link vxtiktok.com bị hỏng sang fxtiktok.com
        if (video.videoUrl && video.videoUrl.includes('vxtiktok.com')) {
            updateData.videoUrl = video.videoUrl.replace(/vxtiktok\.com/g, 'fxtiktok.com');
            needsUpdate = true;
        }

        if (needsUpdate) {
            console.log(`🔄 Cập nhật ID ${video.id} ("${video.title}"): Thể loại -> ${updateData.category || video.category}, URL -> ${updateData.videoUrl || video.videoUrl}`);
            await updateWarmupVideo(video.id, updateData);
            updatedCount++;
        }
    }

    console.log(`\n🎉 HOÀN THÀNH DI CHUYỂN!`);
    console.log(`- Đã sửa đổi thành công: ${updatedCount} video.`);
    console.log(`👉 Vui lòng chạy lệnh \`@BotToan warmup reload\` trên Discord để nạp lại cache!`);

    await mongoose.connection.close();
    process.exit(0);
}

run().catch(err => {
    console.error("❌ Lỗi di chuyển dữ liệu:", err);
    process.exit(1);
});
