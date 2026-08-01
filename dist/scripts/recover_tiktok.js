"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const mongoose_1 = __importDefault(require("mongoose"));
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
            if (val.startsWith('"') && val.endsWith('"'))
                val = val.slice(1, -1);
            if (val.startsWith("'") && val.endsWith("'"))
                val = val.slice(1, -1);
            process.env[key] = val;
        }
    });
}
async function run() {
    // Import động để đảm bảo các biến môi trường được tải
    const { connectDB, getWarmupVideos, updateWarmupVideo } = await Promise.resolve().then(() => __importStar(require('../database')));
    console.log("🔄 Đang kết nối tới MongoDB...");
    await connectDB();
    console.log("🔍 Đang lấy danh sách video từ Database...");
    const videos = await getWarmupVideos();
    console.log(`📊 Tìm thấy tổng cộng ${videos.length} video.`);
    let restoredCount = 0;
    for (const video of videos) {
        if (!video.id)
            continue;
        let needsUpdate = false;
        const updateData = {};
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
        }
        else {
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
    await mongoose_1.default.connection.close();
    process.exit(0);
}
run().catch(err => {
    console.error("❌ Lỗi cập nhật dữ liệu:", err);
    process.exit(1);
});
