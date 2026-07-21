"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleGamingCourt = handleGamingCourt;
const discord_js_1 = require("discord.js");
const database_1 = require("../database");
const gemini_1 = require("../services/gemini");
const utils_1 = require("../utils");
/**
 * Xử lý lệnh luận tội gaming (@BotToan toaan @User)
 */
async function handleGamingCourt(message, rawInput) {
    if (!message.guild) {
        await message.reply("❌ Lệnh này chỉ dùng được trong server thôi nha cưng!").catch(() => { });
        return;
    }
    // Lấy đối tượng bị luận tội (tag đầu tiên)
    const targetMember = message.mentions.members?.filter(m => m.id !== message.client.user?.id).first();
    const targetUser = message.mentions.users.filter(u => u.id !== message.client.user?.id).first();
    if (!targetMember || !targetUser) {
        await message.reply("❌ **THIẾU ĐỐI TƯỢNG!** Tag cái đứa mày muốn luận tội vào đây xem nào! (Ví dụ: `@BotToan toaan @Ten_Dong_Bon`)").catch(() => { });
        return;
    }
    const targetId = targetMember.id;
    const senderId = message.author.id;
    const botId = message.client.user?.id;
    // --- EASTER EGGS ---
    // 1. Tự luận tội chính mình
    if (targetId === senderId) {
        await message.reply("🔍 **TỰ THÚ TRƯỚC BÌNH MINH À?**\nTòa tuyên tội danh: **Tự kỷ giai đoạn cuối**. Phán quyết: Tắt Discord và đi ra ngoài chạm cỏ (touch grass) giùm cái cưng! 🌿").catch(() => { });
        return;
    }
    // 2. Luận tội BotToan
    if (targetId === botId) {
        await message.reply("❌ **CẮT CỔ CÒN ĐÒI KHIẾU NẠI?**\nỦa định kết tội tao à? Thẩm Phán Tối Cao có quyền miễn trừ tư pháp nhé con trai! Phạt mày nộp 20k vào hũ Jackpot vì tội xúc phạm quan tòa! 🏛️").catch(() => { });
        return;
    }
    // 3. Luận tội Sếp ToanLee
    const OWNER_ID = '911989602213060688';
    if (targetId === OWNER_ID) {
        await message.reply("👑 **QUYỀN LỰC TỐI CAO:**\nTội danh của sếp là: **Quá chăm chỉ và đẹp trai**. Sếp chơi game là để giải tỏa áp lực gánh vác thế giới, đứa nào dám phán xét sếp bước ra đây anh vả sưng mỏ! 👑").catch(() => { });
        return;
    }
    // --- CHẨN ĐOÁN INTENT PRESENCE ---
    const authorMember = message.guild.members.cache.get(senderId);
    const presenceIntentMissing = authorMember && !authorMember.presence;
    const presence = targetMember.presence;
    if (!presence) {
        if (presenceIntentMissing) {
            await message.reply("❌ **LỖI HỆ THỐNG:** Thẩm phán không thể đọc sóng não của tội phạm! (Admin hãy kích hoạt Privileged Gateway Intent **Presences Intent** trong Discord Developer Portal).").catch(() => { });
            return;
        }
        await message.reply("❌ **ĐỐI TƯỢNG ĐÃ TRỐN TRẠI!** Tội nhân này đã bật chế độ tàng hình (Invisible) hoặc offline thật. Tòa tạm thời cho nợ án, sơ hở là anh gáy ngay!").catch(() => { });
        return;
    }
    // --- QUÉT HOẠT ĐỘNG GAMING (ĐỘ ƯU TIÊN: PLAYING -> STREAMING -> COMPETING) ---
    const activities = presence.activities || [];
    let gameActivity = activities.find(act => act.type === discord_js_1.ActivityType.Playing);
    if (!gameActivity) {
        gameActivity = activities.find(act => act.type === discord_js_1.ActivityType.Streaming);
    }
    if (!gameActivity) {
        gameActivity = activities.find(act => act.type === discord_js_1.ActivityType.Competing);
    }
    if (!gameActivity) {
        await message.reply(`🔍 **MÁY QUÉT TRỐNG KHÔNG:** Đứa này hiện tại không treo game gì cả. Chắc đang lướt TikTok hoặc đi ngủ rồi, tha cho nó lần này.`).catch(() => { });
        return;
    }
    const gameName = gameActivity.name;
    const startTime = gameActivity.timestamps?.start;
    let durationText = "nãy giờ chưa chịu nghỉ";
    let isMaVungKinhKin = false;
    if (startTime) {
        const totalMinutes = Math.floor((Date.now() - startTime.getTime()) / 60000);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        if (totalMinutes >= 480) { // >= 8 tiếng
            isMaVungKinhKin = true;
        }
        durationText = hours > 0 ? `${hours} tiếng ${minutes} phút` : `${minutes} phút`;
    }
    // --- ĐỌC GIỚI TÍNH ĐỒNG BỘ TỪ DATABASE ---
    const profile = await (0, database_1.getProfile)(targetId).catch(() => null);
    let pronoun = "thí chủ";
    if (profile && profile.gender) {
        if (profile.gender === "Nam") {
            pronoun = "thằng báo thủ này";
        }
        else if (profile.gender === "Nữ") {
            pronoun = "con báo thủ này";
        }
    }
    // --- GỬI HIỆU ỨNG GÕ BÚA CHỜ 3 GIÂY ---
    const statusMsg = await message.reply("⚖️ **Thẩm phán ToanLee đang gõ búa, tra sổ xem tội trạng game thủ...**").catch(() => null);
    await (0, utils_1.sleep)(3000);
    // --- XỬ LÝ EASTER EGG TREO GAME > 8 TIẾNG ---
    if (isMaVungKinhKin) {
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(`⚖️ BẢN ÁN GAMING TỐI CAO: ${targetMember.displayName}`)
            .setDescription(`🎮 **Tội trạng thực tế:** Nghiện game **${gameName}**\n` +
            `⏱️ **Thời gian phạm tội:** Đã cắm mặt vào game **${durationText}** liên tục.`)
            .setColor(0x1F1F1F) // Màu đen tối tăm rùng rợn
            .setThumbnail(targetUser.displayAvatarURL())
            .addFields({ name: "🏷️ TỘI DANH: HỆ TIẾN HÓA THÀNH MA VÙNG KÊNH KÍN ☠️", value: `Mày cày game hơn 8 tiếng rồi đấy ${pronoun.toLowerCase()} điên này! Thần linh cũng phải lạy mày, định chơi đến lúc hóa thạch luôn à? Đầu óc chắc nát map luôn rồi!` }, { name: "⚖️ Phán quyết cuối cùng", value: "Cưỡng chế ngắt nguồn máy tính, tịch thu ổ cứng và xua đuổi lên giường đi ngủ ngay lập tức!" }, { name: "📊 Chỉ số báo thủ", value: `\`[████████████████████]\` **100%** *(Hết cứu, báo nhà báo cửa báo cả dòng họ)*` })
            .setFooter({ text: "BotToan Gaming Court - Ma Vùng Kênh Kín Alert", iconURL: message.client.user?.displayAvatarURL() })
            .setTimestamp();
        if (statusMsg)
            await statusMsg.delete().catch(() => { });
        await message.reply({ embeds: [embed] }).catch(() => { });
        return;
    }
    // --- GỌI GEMINI LUẬN TỘI ---
    try {
        const geminiOutput = await (0, gemini_1.generateGamingCourtVerdict)(targetMember.displayName, gameName, durationText, pronoun);
        // Trích xuất P_BAR (giới hạn an toàn fallback)
        const match = geminiOutput.match(/P_BAR:\s*(\d+)/i);
        const percentage = match ? parseInt(match[1], 10) : Math.floor(Math.random() * (95 - 70 + 1)) + 70;
        // Dọn dẹp khoảng trống và xóa dòng P_BAR
        const cleanVerdict = geminiOutput
            .replace(/P_BAR:\s*\d+%/gi, '')
            .replace(/P_BAR:\s*\d+/gi, '')
            .trim();
        // Vẽ thanh tiến trình
        const barLength = 20;
        const filledLength = Math.round((percentage / 100) * barLength);
        const bar = "█".repeat(filledLength) + "░".repeat(barLength - filledLength);
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(`⚖️ BẢN ÁN GAMING TỐI CAO: ${targetMember.displayName}`)
            .setDescription(`🎮 **Tội trạng thực tế:** Nghiện game **${gameName}**\n` +
            `⏱️ **Thời gian phạm tội:** Đã cắm mặt vào game **${durationText}** liên tục.\n\n` +
            cleanVerdict)
            .setColor(0xE74C3C)
            .setThumbnail(targetUser.displayAvatarURL())
            .addFields({ name: "📊 Chỉ số báo thủ", value: `\`[${bar}]\` **${percentage}%**` })
            .setFooter({ text: "BotToan Gaming Court - Phán xét mỏ hỗn", iconURL: message.client.user?.displayAvatarURL() })
            .setTimestamp();
        if (statusMsg)
            await statusMsg.delete().catch(() => { });
        await message.reply({ embeds: [embed] }).catch(() => { });
    }
    catch (error) {
        console.error("Lỗi luận tội gaming:", error);
        if (statusMsg) {
            await statusMsg.edit("❌ **LỖI TÒA ÁN:** Thẩm phán đột nhiên đột quỵ không thể phán xử, tha bổng tội nhân lần này!").catch(() => { });
        }
        else {
            await message.reply("❌ **LỖI TÒA ÁN:** Không thể phán xử lúc này.").catch(() => { });
        }
    }
}
