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
    // Import động để đảm bảo các biến môi trường được tải
    const { connectDB, getWarmupVideos, updateWarmupVideo } = await import('../database');

    console.log("🔄 Đang kết nối tới MongoDB...");
    await connectDB();

    console.log("🔍 Đang lấy danh sách video từ Database...");
    const videos = await getWarmupVideos();
    console.log(`📊 Tìm thấy tổng cộng ${videos.length} video.`);

    let restoredCount = 0;

    for (const video of videos) {
        if (!video.id) continue;

        let needsUpdate = false;
        const updateData: any = {};

        // 1. Chuyển đổi tên miền sang tnktok.com (1)
        if (video.videoUrl && (video.videoUrl.includes('tiktok.com') || video.videoUrl.includes('fxtiktok.com') || video.videoUrl.includes('vxtiktok.com')) && !video.videoUrl.includes('tnktok.com')) {
            updateData.videoUrl = video.videoUrl
                .replace(/tiktok\.com/g, 'tnktok.com')
                .replace(/fxtiktok\.com/g, 'tnktok.com')
                .replace(/vxtiktok\.com/g, 'tnktok.com');
            needsUpdate = true;
        }

        // 2. Trả lại thể loại (Category) cho video cũ:
        // - Video mới import: category = 'TikTok của Trang Anh'
        // - Video cũ hôm qua: category = 'Tiktok'
        if (video.description === "Import tự động từ tài khoản TikTok cá nhân") {
            if (video.category !== 'TikTok của Trang Anh') {
                updateData.category = 'TikTok của Trang Anh';
                needsUpdate = true;
            }
        } else {
            // Các video cũ
            if (video.category !== 'Tiktok') {
                updateData.category = 'Tiktok';
                needsUpdate = true;
            }
        }

        if (needsUpdate) {
            console.log(`🔄 Cập nhật ID ${video.id} ("${video.title}"): Thể loại -> ${updateData.category || video.category}, URL -> ${updateData.videoUrl || video.videoUrl}`);
            await updateWarmupVideo(video.id, updateData);
            restoredCount++;
        }
    }

    console.log(`\n🎉 HOÀN THÀNH CẬP NHẬT!`);
    console.log(`- Đã sửa đổi thành công: ${restoredCount} video.`);
    console.log(`👉 Vui lòng chạy lệnh \`@BotToan warmup reload\` trên Discord để nạp lại cache!`);

    await mongoose.connection.close();
    process.exit(0);
}

run().catch(err => {
    console.error("❌ Lỗi cập nhật dữ liệu:", err);
    process.exit(1);
});
