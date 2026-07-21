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
// Tự động load file .env thủ công trước tiên để đảm bảo các biến môi trường được thiết lập trước khi import các file config khác!
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
    // Import động để đảm bảo các biến môi trường đã được tải vào process.env trước khi config.ts được evaluate
    const { connectDB, addWarmupVideo } = await Promise.resolve().then(() => __importStar(require('../database')));
    const { isTikTokUrl, convertToTnktok } = await Promise.resolve().then(() => __importStar(require('../commands/warmup')));
    // 1. Kết nối database
    console.log("🔄 Đang kết nối tới MongoDB...");
    await connectDB();
    const linksFilePath = path.join(__dirname, '../../tiktok_links.txt');
    if (!fs.existsSync(linksFilePath)) {
        console.error(`❌ Không tìm thấy file dữ liệu tại: ${linksFilePath}`);
        console.log("👉 Vui lòng tạo file tiktok_links.txt ở thư mục gốc của bot và dán danh sách link TikTok vào.");
        process.exit(1);
    }
    const content = fs.readFileSync(linksFilePath, 'utf-8');
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0 && !line.startsWith('#'));
    if (lines.length === 0) {
        console.log("⚠️ File tiktok_links.txt đang trống rỗng.");
        process.exit(0);
    }
    console.log(`📂 Tìm thấy ${lines.length} dòng dữ liệu cần xử lý. Bắt đầu import...`);
    let successCount = 0;
    let failCount = 0;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let title = '';
        let url = '';
        if (line.includes('|')) {
            const parts = line.split('|');
            title = parts[0].trim();
            url = parts[1].trim();
        }
        else {
            url = line;
            // Tự tạo tiêu đề theo số thứ tự (ví dụ: Video TikTok #1)
            title = `Video TikTok #${lines.length - i}`;
        }
        if (!url.startsWith('http')) {
            console.warn(`⚠️ Dòng ${i + 1} không chứa link hợp lệ, bỏ qua: "${line}"`);
            failCount++;
            continue;
        }
        // Tự động tối ưu link TikTok sang tnktok
        if (isTikTokUrl(url)) {
            url = convertToTnktok(url);
        }
        try {
            await addWarmupVideo({
                title,
                description: "Import tự động từ tài khoản TikTok cá nhân",
                category: "TikTok của Trang Anh",
                videoUrl: url,
                videoType: "external",
                addedBy: "System"
            });
            console.log(`✅ [${i + 1}/${lines.length}] Đã thêm thành công: "${title}" -> ${url}`);
            successCount++;
        }
        catch (err) {
            console.error(`❌ [${i + 1}/${lines.length}] Thêm thất bại cho "${title}":`, err.message || err);
            failCount++;
        }
    }
    console.log(`\n🎉 HOÀN THÀNH QUÁ TRÌNH IMPORT!`);
    console.log(`- Thêm thành công: ${successCount} video`);
    console.log(`- Thất bại/Bỏ qua: ${failCount} video`);
    console.log(`👉 Vui lòng khởi động lại Bot hoặc chạy lệnh \`@BotToan warmup reload\` trên Discord để nạp lại cache!`);
    // Đóng kết nối MongoDB
    await mongoose_1.default.connection.close();
    process.exit(0);
}
run().catch(err => {
    console.error("❌ Lỗi nghiêm trọng khi chạy import script:", err);
    process.exit(1);
});
