"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAura = handleAura;
exports.handleAnonymousLetter = handleAnonymousLetter;
exports.handleCheckDM = handleCheckDM;
exports.handleMoodDiary = handleMoodDiary;
exports.handleOverthink = handleOverthink;
exports.handleChotDon = handleChotDon;
exports.handleDailyAesthetic = handleDailyAesthetic;
const discord_js_1 = require("discord.js");
const database_1 = require("../database");
const database_2 = require("../database");
const gemini_1 = require("../services/gemini");
const tarot_1 = require("./tarot");
const AURA_COLORS = [
    { name: 'Đỏ Rực', emoji: '🔴', hexColor: 0xFF3B30, vibeDesc: 'Đam mê cháy bỏng, năng lượng bùng nổ' },
    { name: 'Hồng Pastel', emoji: '🌸', hexColor: 0xFF6EB4, vibeDesc: 'Mơ mộng ngọt ngào, yêu đời dịu dàng' },
    { name: 'Tím Hoàng Gia', emoji: '💜', hexColor: 0x7B2FBE, vibeDesc: 'Huyền bí quyền năng, trực giác sắc bén' },
    { name: 'Xanh Ngọc', emoji: '💚', hexColor: 0x00B4D8, vibeDesc: 'Chữa lành thanh thản, tâm hồn bình an' },
    { name: 'Vàng Kim', emoji: '✨', hexColor: 0xFFCC00, vibeDesc: 'Tài lộc sung túc, thu hút may mắn' },
    { name: 'Trắng Thuần', emoji: '🤍', hexColor: 0xF0F0F0, vibeDesc: 'Tinh khiết trong sáng, tâm trí rõ ràng' },
    { name: 'Cam Rạng Rỡ', emoji: '🧡', hexColor: 0xFF7700, vibeDesc: 'Nhiệt huyết sáng tạo, vui vẻ phóng khoáng' },
    { name: 'Đen Huyền', emoji: '🖤', hexColor: 0x2C2C2C, vibeDesc: 'Lạnh lùng bí ẩn, sức mạnh nội tâm sâu thẳm' },
    { name: 'Xanh Dương', emoji: '💙', hexColor: 0x007AFF, vibeDesc: 'Tin cậy vững chắc, tư duy logic sắc bén' },
    { name: 'Bạc Ánh Trăng', emoji: '🌙', hexColor: 0xC0C0C0, vibeDesc: 'Trực giác mặt trăng, nhạy cảm tinh tế' },
    { name: 'Nâu Đất', emoji: '🤎', hexColor: 0x8B5E3C, vibeDesc: 'Chắc chắn ổn định, gần gũi ấm áp' },
    { name: 'Xanh Lá', emoji: '🍃', hexColor: 0x34C759, vibeDesc: 'Sinh lực dồi dào, tươi mới và phát triển' },
    { name: 'Hồng San Hô', emoji: '🪸', hexColor: 0xFF6B6B, vibeDesc: 'Quyến rũ nổi bật, thu hút ánh nhìn' },
    { name: 'Vàng Chanh', emoji: '💛', hexColor: 0xFFE500, vibeDesc: 'Năng động trẻ trung, đầu óc sáng tạo bay bổng' },
];
// Lấy màu aura theo userId + ngày (seed nhất quán cả ngày, đổi mỗi ngày mới)
function getAuraColorForDay(userId, dateStr) {
    // Simple hash: userId + date → index
    let hash = 0;
    const str = userId + dateStr;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    const idx = Math.abs(hash) % AURA_COLORS.length;
    return AURA_COLORS[idx];
}
// ============================================================
// =========== TÍNH NĂNG 1: BÓI MÀU VẬN KHÍ (AURA) ==========
// ============================================================
async function handleAura(message, rawInput) {
    const afterCmd = rawInput.replace(/^(aura|mau van khi|sac mau hom nay)\s*/i, '').trim();
    const today = (0, database_1.getVNDateString)(Date.now());
    const userName = message.member?.displayName || message.author.username;
    // Kiểm tra có phải aura match không
    const mentionedUser = message.mentions.users.filter(u => u.id !== message.client.user?.id).first();
    const isMatch = afterCmd.toLowerCase().includes('match') || mentionedUser !== undefined;
    if (isMatch) {
        // --- AURA MATCH ---
        if (!mentionedUser) {
            await message.reply('💜 **Aura Match cần tag đối tượng!** Ví dụ: `@BotToan aura match @Crush`').catch(() => { });
            return;
        }
        const myAura = getAuraColorForDay(message.author.id, today);
        const theirAura = getAuraColorForDay(mentionedUser.id, today);
        const targetName = message.guild?.members.cache.get(mentionedUser.id)?.displayName || mentionedUser.username;
        const typingMsg = await message.reply('🔮 *Đang đọc luồng năng lượng giữa hai người...*').catch(() => null);
        let reading = '';
        try {
            reading = await (0, gemini_1.getAuraReading)(myAura.name, userName, theirAura.name, targetName);
        }
        catch {
            reading = 'Vũ trụ đang bận, thử lại sau nhé!';
        }
        await typingMsg?.delete().catch(() => { });
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(`${myAura.emoji} AURA MATCH: ${userName} & ${targetName} ${theirAura.emoji}`)
            .setColor(myAura.hexColor)
            .setDescription(reading)
            .addFields({ name: `${myAura.emoji} Aura của ${userName}`, value: `**${myAura.name}**\n*${myAura.vibeDesc}*`, inline: true }, { name: `${theirAura.emoji} Aura của ${targetName}`, value: `**${theirAura.name}**\n*${theirAura.vibeDesc}*`, inline: true })
            .setFooter({ text: `Aura Match ngày ${today} • BotToan Huyền Bí`, iconURL: message.client.user?.displayAvatarURL() })
            .setTimestamp();
        await message.reply({ embeds: [embed] }).catch(() => { });
        return;
    }
    // --- AURA ĐƠN (Bói vận khí hôm nay) ---
    const lastDate = await (0, database_2.getLastAuraDate)(message.author.id);
    if (lastDate === today) {
        const myAura = getAuraColorForDay(message.author.id, today);
        await message.reply(`${myAura.emoji} **Aura hôm nay của bạn đã được bói rồi!** Màu vận khí hôm nay là **${myAura.name}** — check lại tin nhắn trước nhé. Ngày mai quay lại để xem màu mới! 🌙`).catch(() => { });
        return;
    }
    const myAura = getAuraColorForDay(message.author.id, today);
    await (0, database_2.setLastAuraDate)(message.author.id, today);
    const typingMsg = await message.reply(`${myAura.emoji} *Đang đọc luồng Aura của bạn hôm nay...*`).catch(() => null);
    let reading = '';
    try {
        reading = await (0, gemini_1.getAuraReading)(myAura.name, userName);
    }
    catch {
        reading = 'Vũ trụ đang nhiễu sóng, nhưng năng lượng bạn hôm nay trông rất tốt đấy! ✨';
    }
    await typingMsg?.delete().catch(() => { });
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle(`${myAura.emoji} VẬN KHÍ MÀU SẮC HÔM NAY — ${myAura.name.toUpperCase()}`)
        .setColor(myAura.hexColor)
        .setDescription(reading)
        .addFields({ name: '🌈 Màu Aura Hôm Nay', value: `${myAura.emoji} **${myAura.name}**`, inline: true }, { name: '✨ Năng Lượng', value: myAura.vibeDesc, inline: true }, { name: '💡 Gợi ý thêm', value: '`@BotToan aura match @User` để xem hai người hợp nhau không hôm nay!', inline: false })
        .setFooter({ text: `Vận khí ngày ${today} • Đổi màu mỗi ngày lúc 00:00 VN`, iconURL: message.client.user?.displayAvatarURL() })
        .setTimestamp();
    await message.reply({ embeds: [embed] }).catch(() => { });
}
// ============================================================
// =========== TÍNH NĂNG 2: HỘP THƯ BÍ MẬT (ANONYMOUS) ======
// ============================================================
// Hàng đợi thư kẹt (trong RAM — thư chưa gửi được vì người nhận khóa DM)
// Map<receiverId, { senderId, processedContent, tone, timestamp }[]>
const pendingLetterQueue = new Map();
async function handleAnonymousLetter(message, rawInput) {
    const today = (0, database_1.getVNDateString)(Date.now());
    // Kiểm tra giới hạn 2 thư/ngày
    const letterData = await (0, database_2.getAnonymousLetterData)(message.author.id);
    const todayCount = letterData.lastDate === today ? letterData.count : 0;
    if (todayCount >= 2) {
        await message.reply('💌 **Hết hạn mạch hôm nay rồi fen ơi!** Mỗi ngày chỉ được gửi **2 thư bí mật** thôi. Ngày mai quay lại nhé! 🌙').catch(() => { });
        return;
    }
    // Tìm người nhận
    const targetUser = message.mentions.users.filter(u => u.id !== message.client.user?.id).first();
    if (!targetUser) {
        await message.reply('💌 **Gửi thư bí mật cho ai?** Tag người nhận vào! Ví dụ:\n`@BotToan thu bi mat @User --love Mình thích bạn từ lâu rồi!`\n`@BotToan thu bi mat @User --drama Ai đó muốn nhắc nhở bạn điều gì đó...`').catch(() => { });
        return;
    }
    if (targetUser.id === message.author.id) {
        await message.reply('💌 **Gửi thư cho chính mình?** Thôi thôi, mở nhật ký ra viết đi bạn ơi! 📖').catch(() => { });
        return;
    }
    if (targetUser.bot) {
        await message.reply('💌 **Bot không đọc thư được đâu bạn ơi!** Gửi cho người thật đi nào! 🤖').catch(() => { });
        return;
    }
    // Parse tone và nội dung
    let tone = 'love';
    let content = rawInput
        .replace(/^(thu bi mat|anonymous|anon)\s+/i, '')
        .replace(/<@!?\d+>/g, '')
        .replace(/--love\s*/i, '')
        .replace(/--drama\s*/i, '')
        .trim();
    if (/--drama/i.test(rawInput))
        tone = 'drama';
    if (!content || content.length < 3) {
        await message.reply(`💌 **Ơ thư trống rỗng!** Viết nội dung vào đi bạn!\nVí dụ: \`@BotToan thu bi mat @User --love Mình rất ngưỡng mộ bạn!\``).catch(() => { });
        return;
    }
    // Xử lý thư bằng Gemini
    const processingMsg = await message.reply(`${tone === 'love' ? '💌' : '🎭'} *Đang mã hóa bức thư bí mật của bạn...*`).catch(() => null);
    let processedContent = content;
    try {
        processedContent = await (0, gemini_1.processAnonymousLetter)(content, tone);
    }
    catch {
        // Nếu Gemini lỗi, dùng nội dung gốc
        processedContent = content;
    }
    await processingMsg?.delete().catch(() => { });
    // Xóa lệnh gốc để bảo mật người gửi
    await message.delete().catch(() => { });
    // Tạo embed thư
    const toneLabel = tone === 'love' ? '💌 Thư Tình Ẩn Danh' : '🎭 Thư Bí Mật';
    const letterEmbed = new discord_js_1.EmbedBuilder()
        .setTitle(`${toneLabel}`)
        .setColor(tone === 'love' ? 0xFF6EB4 : 0x7B2FBE)
        .setDescription(`*Bạn nhận được một lá thư bí mật từ ai đó trên server...*\n\n💬 **"${processedContent}"**`)
        .addFields({ name: '📮 Người gửi', value: '*Ẩn danh hoàn toàn*', inline: true })
        .setFooter({ text: 'Trả lời: @BotToan thu bi mat @<người gửi> --love <nội dung> • BotToan Anonymous' })
        .setTimestamp();
    // Gửi DM cho người nhận
    try {
        await targetUser.send({ embeds: [letterEmbed] });
        await (0, database_2.incrementAnonymousLetterCount)(message.author.id, today);
        // Thông báo gửi thành công (ephemeral - gửi tới người gửi)
        const successMsg = await message.channel.send({
            content: `📮 **Thư bí mật đã được gửi thành công!** *(tin nhắn này tự xóa sau 5 giây)*`,
        }).catch(() => null);
        setTimeout(() => successMsg?.delete().catch(() => { }), 5000);
    }
    catch (err) {
        // Người nhận khóa DM — lưu vào hàng đợi
        const queue = pendingLetterQueue.get(targetUser.id) || [];
        queue.push({ senderId: message.author.id, processedContent, tone, timestamp: Date.now() });
        pendingLetterQueue.set(targetUser.id, queue);
        const failMsg = await message.channel.send({
            content: `📮 **Gửi hụt rồi <@${message.author.id}> ơi!** Đối phương đang bế quan tỏa cảng, khóa DM rồi. Thư đã được lưu vào hàng đợi — bảo người ta mở DM ra thì nhắn \`@BotToan checkdm\` để nhận nhé! 📬`
        }).catch(() => null);
        setTimeout(() => failMsg?.delete().catch(() => { }), 10000);
    }
}
/**
 * Kiểm tra thư đang kẹt trong hàng đợi (dành cho người nhận)
 */
async function handleCheckDM(message) {
    const userId = message.author.id;
    const queue = pendingLetterQueue.get(userId);
    if (!queue || queue.length === 0) {
        await message.reply('📭 **Hộp thư trống teo!** Chưa có thư bí mật nào đang đợi bạn cả. *(Hoặc hãy thử mở DM rồi bảo bạn bè gửi thư nhé!)*').catch(() => { });
        return;
    }
    // Thử gửi lại các thư còn kẹt
    let sentCount = 0;
    const remaining = [];
    for (const letter of queue) {
        const toneLabel = letter.tone === 'love' ? '💌 Thư Tình Ẩn Danh' : '🎭 Thư Bí Mật';
        const letterEmbed = new discord_js_1.EmbedBuilder()
            .setTitle(toneLabel)
            .setColor(letter.tone === 'love' ? 0xFF6EB4 : 0x7B2FBE)
            .setDescription(`*Bạn nhận được một lá thư bí mật từ ai đó trên server...*\n\n💬 **"${letter.processedContent}"**`)
            .addFields({ name: '📮 Người gửi', value: '*Ẩn danh hoàn toàn*', inline: true })
            .setFooter({ text: 'BotToan Anonymous • Gửi từ hàng đợi' })
            .setTimestamp(new Date(letter.timestamp));
        try {
            await message.author.send({ embeds: [letterEmbed] });
            sentCount++;
        }
        catch {
            remaining.push(letter);
        }
    }
    if (remaining.length === 0) {
        pendingLetterQueue.delete(userId);
    }
    else {
        pendingLetterQueue.set(userId, remaining);
    }
    if (sentCount > 0) {
        await message.reply(`📬 **Đã gửi ${sentCount} thư bí mật vào DM của bạn!** Check inbox đi nào! 💌`).catch(() => { });
    }
    else {
        await message.reply(`📪 **Vẫn không gửi được!** DM của bạn vẫn đang bị khóa. Vào Settings → Privacy & Safety → bật "Allow direct messages" rồi thử lại nhé!`).catch(() => { });
    }
}
const MOOD_MAP = {
    'vui': { label: 'Vui Vẻ 😊', emoji: '😊', color: 0xFFCC00, tarotHint: 'The Sun (Mặt Trời) — ánh sáng hân hoan' },
    'buon': { label: 'Buồn Bã 😢', emoji: '😢', color: 0x5E81AC, tarotHint: 'The Moon (Mặt Trăng) — cảm xúc sâu thẳm' },
    'lo': { label: 'Lo Lắng 😰', emoji: '😰', color: 0xEBCB8B, tarotHint: 'The Hermit (Ẩn Sĩ) — cần thời gian tĩnh lặng' },
    'gian': { label: 'Tức Giận 😤', emoji: '😤', color: 0xBF616A, tarotHint: 'The Tower (Tháp Đổ) — năng lượng bùng nổ cần giải phóng' },
    'met': { label: 'Mệt Mỏi 😴', emoji: '😴', color: 0x8FBCBB, tarotHint: 'The Hermit (Ẩn Sĩ) — cần nghỉ ngơi nạp lại năng lượng' },
};
// Nhận dạng tâm trạng từ input thô
function parseMood(input) {
    const lower = input.toLowerCase().trim();
    if (lower.includes('vui') || lower.includes('happy') || lower.includes('😊'))
        return 'vui';
    if (lower.includes('buon') || lower.includes('sad') || lower.includes('😢') || lower.includes('😭'))
        return 'buon';
    if (lower.includes('lo') || lower.includes('lo lang') || lower.includes('anxiety') || lower.includes('😰'))
        return 'lo';
    if (lower.includes('gian') || lower.includes('tuc') || lower.includes('angry') || lower.includes('😤') || lower.includes('😡'))
        return 'gian';
    if (lower.includes('met') || lower.includes('tired') || lower.includes('😴') || lower.includes('😪'))
        return 'met';
    return null;
}
// Emoji cho biểu đồ tâm trạng tuần
const MOOD_EMOJIS = {
    'vui': '😊', 'buon': '😢', 'lo': '😰', 'gian': '😤', 'met': '😴'
};
async function handleMoodDiary(message, rawInput) {
    const today = (0, database_1.getVNDateString)(Date.now());
    const userName = message.member?.displayName || message.author.username;
    // Kiểm tra lệnh mood summary
    const afterCmd = rawInput.replace(/^(tam trang|mood|cam xuc)\s*/i, '').trim();
    const isLowerCmd = afterCmd.toLowerCase();
    if (isLowerCmd === 'summary' || isLowerCmd === 'tong ket' || isLowerCmd === 'tong hop') {
        await handleMoodSummary(message, userName, today);
        return;
    }
    // Parse mood
    const moodKey = parseMood(afterCmd);
    if (!moodKey) {
        await message.reply('🌈 **Bạn đang cảm thấy thế nào?**\n' +
            'Gõ: `@BotToan tam trang vui` / `buon` / `lo` / `gian` / `met`\n' +
            'Hoặc dùng emoji: 😊 😢 😰 😤 😴\n\n' +
            '📊 Gõ `@BotToan mood summary` để xem biểu đồ cảm xúc tuần qua!').catch(() => { });
        return;
    }
    const moodData = await (0, database_2.getMoodData)(message.author.id);
    const alreadyLoggedToday = moodData.lastDate === today;
    // Lấy lá tarot mini ngẫu nhiên (seed = userId + today + mood để nhất quán)
    let hashSeed = 0;
    const seedStr = message.author.id + today + moodKey;
    for (let i = 0; i < seedStr.length; i++) {
        hashSeed = ((hashSeed << 5) - hashSeed) + seedStr.charCodeAt(i);
        hashSeed |= 0;
    }
    const tarotCard = tarot_1.TAROT_DECK[Math.abs(hashSeed) % tarot_1.TAROT_DECK.length];
    const config = MOOD_MAP[moodKey];
    // Lưu mood và tính streak
    const newStreak = await (0, database_2.saveMood)(message.author.id, moodKey, today);
    // Gọi Gemini tư vấn
    const typingMsg = await message.reply(`${config.emoji} *Đang lắng nghe bạn...*`).catch(() => null);
    let advice = '';
    try {
        advice = await (0, gemini_1.getMoodAdvice)(config.label, userName, `${tarotCard.name} (${tarotCard.englishName})`);
    }
    catch {
        advice = `${config.emoji} Cảm ơn bạn đã chia sẻ! Dù hôm nay bạn đang ${config.label.toLowerCase()}, hãy nhớ rằng mỗi cảm xúc đều có giá trị riêng của nó. Hãy trân trọng bản thân nhé! 💙`;
    }
    await typingMsg?.delete().catch(() => { });
    // Streak badge
    let streakBadge = '';
    if (newStreak >= 7)
        streakBadge = '👑 **Streak 7+ ngày!** Bạn thật kiên trì!';
    else if (newStreak >= 3)
        streakBadge = `🔥 **Streak ${newStreak} ngày!** Đang giữ đà tốt!`;
    else if (newStreak >= 2)
        streakBadge = `✨ **Streak ${newStreak} ngày!** Bắt đầu rồi đấy!`;
    const alreadyNote = alreadyLoggedToday ? '\n*(Bạn đã cập nhật tâm trạng hôm nay — vừa ghi lại lần 2)*' : '';
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle(`${config.emoji} NHẬT KÝ TÂM TRẠNG — ${config.label.toUpperCase()}`)
        .setColor(config.color)
        .setDescription(advice + alreadyNote)
        .addFields({ name: '🃏 Lá Tarot Hôm Nay', value: `**${tarotCard.name}** *(${tarotCard.englishName})*\n*${config.tarotHint}*`, inline: false }, { name: '📅 Ngày Ghi', value: today, inline: true }, { name: '🔥 Streak', value: `**${newStreak}** ngày liên tiếp`, inline: true })
        .setFooter({ text: '`@BotToan mood summary` để xem biểu đồ tuần qua • BotToan tâm lý', iconURL: message.client.user?.displayAvatarURL() })
        .setTimestamp();
    if (streakBadge)
        embed.addFields({ name: '🏆 Thành Tích', value: streakBadge, inline: false });
    await message.reply({ embeds: [embed] }).catch(() => { });
}
async function handleMoodSummary(message, userName, today) {
    const data = await (0, database_2.getMoodData)(message.author.id);
    if (data.weeklyMoods.length === 0) {
        await message.reply('📊 **Chưa có dữ liệu tâm trạng!** Hãy gõ `@BotToan tam trang vui/buon/lo/gian/met` mỗi ngày để BotToan lưu nhật ký nhé! 🌈').catch(() => { });
        return;
    }
    // Tổng hợp mood 7 ngày
    const moodCount = { vui: 0, buon: 0, lo: 0, gian: 0, met: 0 };
    for (const entry of data.weeklyMoods) {
        if (moodCount[entry.mood] !== undefined)
            moodCount[entry.mood]++;
    }
    // Mood chủ đạo
    const dominantMood = Object.entries(moodCount).sort((a, b) => b[1] - a[1])[0];
    const dominantConfig = dominantMood ? MOOD_MAP[dominantMood[0]] : MOOD_MAP['vui'];
    // Biểu đồ emoji theo ngày (7 ngày gần nhất)
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() + 7 * 3600000 - i * 86400000);
        const dStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
        const entry = data.weeklyMoods.find(e => e.date === dStr);
        const dayLabel = `**${d.getUTCDate()}/${d.getUTCMonth() + 1}**`;
        last7Days.push(entry ? `${dayLabel}: ${MOOD_EMOJIS[entry.mood] || '❓'}` : `${dayLabel}: ⬜`);
    }
    // Lời tổng kết dí dỏm theo mood chủ đạo
    const summaryLines = {
        vui: [`Tuần qua ${userName} vui như Tết, năng lượng xịn mịn lắm! 🎉`, `Cả tuần xôm tụ thế này, BotToan cũng lây được vui rồi! ✨`],
        buon: [`Tuần qua hơi nặng nề nhỉ, nhưng sóng gió rồi cũng qua thôi! 🌊`, `${userName} ơi, biển động thì cá mới trưởng thành — ổn thôi! 💙`],
        lo: [`Lo nhiều quá rồi đấy, hít thở sâu đi nào ${userName}! 🍃`, `Tuần qua worry nhiều — nhưng 90% điều lo thì không xảy ra đâu bạn ơi! 🌸`],
        gian: [`Cháy cả tuần thế này, cần xả stress đi thôi ${userName}! 🔥`, `Tức nhiều quá rồi — bớt năng lượng vào chỗ đáng giá hơn nhé! 💪`],
        met: [`Pin yếu cả tuần rồi, cần sạc lại gấp! Ngủ đủ giấc vào! 😴`, `Mệt mà vẫn cố thế này, ${userName} thật sự kiên cường! Nhớ nghỉ ngơi nhé! 🤍`],
    };
    const summaryArr = summaryLines[dominantMood?.[0] || 'vui'] || summaryLines.vui;
    const summaryText = summaryArr[Math.floor(Math.random() * summaryArr.length)];
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle(`📊 BIỂU ĐỒ CẢM XÚC TUẦN QUA — ${userName.toUpperCase()}`)
        .setColor(dominantConfig.color)
        .setDescription(`*${summaryText}*`)
        .addFields({ name: '📅 7 Ngày Qua', value: last7Days.join(' | '), inline: false }, { name: '😊 Vui', value: `${moodCount.vui} ngày`, inline: true }, { name: '😢 Buồn', value: `${moodCount.buon} ngày`, inline: true }, { name: '😰 Lo', value: `${moodCount.lo} ngày`, inline: true }, { name: '😤 Giận', value: `${moodCount.gian} ngày`, inline: true }, { name: '😴 Mệt', value: `${moodCount.met} ngày`, inline: true }, { name: '🏆 Mood Chủ Đạo', value: `${dominantConfig.emoji} **${dominantConfig.label}**`, inline: true }, { name: '🔥 Streak Hiện Tại', value: `**${data.streak}** ngày liên tiếp`, inline: false })
        .setFooter({ text: `Nhật ký ${data.weeklyMoods.length} ngày đã ghi • BotToan tâm lý`, iconURL: message.client.user?.displayAvatarURL() })
        .setTimestamp();
    await message.reply({ embeds: [embed] }).catch(() => { });
}
// ============================================================
// =========== TÍNH NĂNG 4: BIÊN NIÊN SỬ OVERTHINK ===========
// ============================================================
async function handleOverthink(message, rawInput) {
    const situation = rawInput.replace(/^(overthink|suy dien|bimbi)\s*/i, '').trim();
    if (!situation || situation.length < 5) {
        await message.reply('🔮 **Overthink cái gì?** Nhập tình huống vào!\n' +
            'Ví dụ: `@BotToan overthink "Anh ấy nhắn vâng thay vì vâng ạ và không rep icon nữa"`').catch(() => { });
        return;
    }
    const processingMsg = await message.reply('🧠 *Đang kết nối vào mạng lưới thần kinh suy diễn toàn cầu...*').catch(() => null);
    let analysis = '';
    try {
        analysis = await (0, gemini_1.getOverthinkAnalysis)(situation);
    }
    catch {
        analysis = [
            '📊 LEVEL 1 — THỰC TẾ TỈNH TÁO:\nNgười ta đầu óc đang bơi đi, không có gì phức tạp đâu em ơi.',
            '📺 LEVEL 2 — DRAMA PHIM HÀN:\nCó thể họ đang giấu một nỗi đau không nói nên lời...',
            '🌌 LEVEL 3 — THUYẾT ÂM MƯU ĐA VŨ TRỤ:\nNASA đã dự báo điều này từ 2019.',
            '💡 LỜI KHUYÊN BỚT ĐIÊN:\nUống trà sữa đi, nghĩ ít thôi không rụng tóc đấy!'
        ].join('\n\n');
    }
    await processingMsg?.delete().catch(() => { });
    // Trích xuất nội dung từng phần
    const extractSection = (text, level, nextLevel) => {
        const regex = nextLevel
            ? new RegExp(`${level}[\\s\\S]*?(?=${nextLevel}|$)`, 'i')
            : new RegExp(`${level}[\\s\\S]*$`, 'i');
        const match = text.match(regex);
        if (!match)
            return '*Chưa rõ...*';
        return match[0].replace(new RegExp(level + '.*?:\n?', 'i'), '').trim().substring(0, 300);
    };
    const l1 = extractSection(analysis, 'LEVEL 1', 'LEVEL 2');
    const l2 = extractSection(analysis, 'LEVEL 2', 'LEVEL 3');
    const l3 = extractSection(analysis, 'LEVEL 3', 'LỜI KHUYÊN');
    const advice = extractSection(analysis, 'LỜI KHUYÊN');
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle('🧠 BIÊN NIÊN SỬ OVERTHINK — PHÂN TÍCH CÓ CHIỀU')
        .setColor(0x7B2FBE)
        .setDescription(`> *"${situation.substring(0, 150)}${situation.length > 150 ? '...' : ''}"*`)
        .addFields({ name: '📊 LEVEL 1 — THỰC TẾ TỈNH TÁO', value: l1 || '*...*', inline: false }, { name: '📺 LEVEL 2 — DRAMA PHIM HÀN', value: l2 || '*...*', inline: false }, { name: '🌌 LEVEL 3 — THUYẾT ÂM MƯU ĐA VŨ TRỤ', value: l3 || '*...*', inline: false }, { name: '💡 LỜI KHUYÊN BỚT ĐIÊN', value: advice || '*Uống trà sữa đi em ơi!*', inline: false })
        .setFooter({ text: 'Chụp màn hình đăng story liền đi! • BotToan Nhà Tâm Lý Học Vũ Trụ', iconURL: message.client.user?.displayAvatarURL() })
        .setTimestamp();
    await message.reply({ embeds: [embed] }).catch(() => { });
}
// ============================================================
// =========== TÍNH NĂNG 5: ĐỘI ĐẶC NHIỆM CHỐT ĐƠN =============
// ============================================================
async function handleChotDon(message, rawInput) {
    const content = rawInput.replace(/^(chotdon|chot don|mua hay khong|tieu hay cat)\s*/i, '').trim();
    if (!content || content.length < 3) {
        await message.reply('🛍️ **Chốt đơn cái gì thế?** Nhập tên món đồ vào!\n' +
            'Ví dụ: `@BotToan chotdon Váy hai dây hoa nhí siêu xinh 350k`').catch(() => { });
        return;
    }
    // Tách giá (nếu có)
    const priceMatch = content.match(/(\d+(?:[.,]\d+)?\s*(?:k|tr|trieu|triệu|đ|vnd)?\s*)$/i);
    const price = priceMatch ? priceMatch[1].trim() : '';
    const item = price ? content.replace(new RegExp(priceMatch[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'), '').trim() : content;
    // Tung xúc xắc tâm linh: seed = userId + ngày + tên món đồ → nhất quán trong ngày
    const today = (0, database_1.getVNDateString)(Date.now());
    let hash = 0;
    const seedStr = message.author.id + today + item.toLowerCase();
    for (let i = 0; i < seedStr.length; i++) {
        hash = ((hash << 5) - hash) + seedStr.charCodeAt(i);
        hash |= 0;
    }
    const roll = Math.abs(hash) % 100;
    const verdict = roll < 55 ? 'CHỐT' : 'CẤT';
    const regretScore = verdict === 'CHỐT' ? (roll % 40) + 10 : (roll % 30) + 5;
    const processingMsg = await message.reply(`🧧 *Đang tung xúc xắc tâm linh... ${roll}/100...*`).catch(() => null);
    let reason = '';
    try {
        reason = await (0, gemini_1.getShoppingVerdict)(item, price, verdict, regretScore);
    }
    catch {
        reason = verdict === 'CHỐT'
            ? 'Đời ngắn lắm, mua đi em, không mua mai hối hận đấy!'
            : 'Nhìn lại số dư tài khoản đi em, anh không có nói nữa đâu.';
    }
    await processingMsg?.delete().catch(() => { });
    const isChot = verdict === 'CHỐT';
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle(isChot ? '🛍️🟢 PHÁN QUYẾT: CHỐT ĐƠN LIỀN!' : '🛍️🔴 PHÁN QUYẾT: CẤT TÚI RỒI!')
        .setColor(isChot ? 0x34C759 : 0xFF3B30)
        .setDescription(reason)
        .addFields({ name: '🛒 Món Đồ', value: `**${item}**${price ? ` | 💰 **${price}**` : ''}`, inline: false }, { name: '🎲 Xúc Xắc Tâm Linh', value: `\`${roll}/100\` → **${verdict}**`, inline: true }, { name: '🪤 Chỉ Số Hối Hận', value: getRegretBar(regretScore), inline: true })
        .setFooter({ text: 'Mỗi món đồ → một phán quyết riêng trong ngày • BotToan Đội Đặc Nhiệm', iconURL: message.client.user?.displayAvatarURL() })
        .setTimestamp();
    await message.reply({ embeds: [embed] }).catch(() => { });
}
function getRegretBar(score) {
    const filled = Math.round(score / 10);
    const bar = '🟥'.repeat(filled) + '⬜'.repeat(10 - filled);
    return `${bar} **${score}%**`;
}
const AESTHETIC_ARCHETYPES = [
    {
        name: 'Nàng Thơ Matcha', emoji: '🌿', color: 0x8DB87F,
        energy: 'Nhẹ nhàng hướng nội, chữa lành nhưng thực ra đang lười',
        description: 'Hôm nay em toả ra năng lượng thoảnh thơi, lưu làng, không ai bế phần tâm hồn của em lên cả. Aesthetic bất bụng nhưng thực ra chỉ muốn nằm mơ cả ngày.',
        accessories: ['🍵 Ly matcha latte tự pha', '📚 Sách dày chưa được mở', '🧘‍♀️ Tư thế ngồi thanh thản'],
        soundtrack: 'Nhạc lofi chill playlist 3 tiếng',
        quote: '"Em đang heal đó, đừng phá" 🌿'
    },
    {
        name: 'Nữ Hoàng Drama', emoji: '👑', color: 0xBF616A,
        energy: 'Hôm nay hít hà drama, nói câu nào là bén câu đó',
        description: 'Năng lượng hôm nay đang ở trạng thái full-combat. Mọi thứ đều có thể trở thành đầu mối drama. Em không tìm kiếm rắc rối, nhưng rắc rối tự tìm đến em.',
        accessories: ['💅 Nail màu đỏ thắm', '📱 Thông báo mạng xã hội mở toàn màn hình', '👇 Ngón trỏ sẵn sàng tag tên'],
        soundtrack: 'BLACKPINK — Shut Down (repeat)',
        quote: '"Ai đụng vào thì biết tay em" 👑'
    },
    {
        name: 'CEO Overnight', emoji: '💼', color: 0x2C3E50,
        energy: 'Vibe tổng tài, deadline ngập đầu, tiền chưa thấy đâu',
        description: 'Hôm nay em đang nhìn xa trông rộng. Kế hoạch lớn, ước mơ to. Vấn đề duy nhất là tất cả đang nằm trong ghi chú điện thoại chưa được xả ra.',
        accessories: ['☕ Cà phê đá lạnh thứ 3', '📝 To-do list 47 dòng', '📱 Tab Chrome mở 23 cái'],
        soundtrack: 'Podcast "làm giàu từ con số 0"',
        quote: '"Em đang xây dựng đế chế" 💼'
    },
    {
        name: 'Đóa Hồng Gai Góc', emoji: '🌹', color: 0xFF2D55,
        energy: 'Ai đụng vào là chờ nhận hậu quả',
        description: 'Năng lượng hôm nay của em là "Không ai trầm bướng được em". Em đẹp, em biết, và em cũng đang sẵn sàng đấu khẩu nếu ai có ý kiến.',
        accessories: ['💁‍♀️ Tóc đầy đủ style phản đối', '👢 Đôi giày sẵn sàng bỏ đi', '🔵 Avatar story trêu'],
        soundtrack: 'Olivia Rodrigo — good 4 u',
        quote: '"Em không gây sự nhưng em kết thúc sự" 🌹'
    },
    {
        name: 'Mộng Mơ Trà Sữa', emoji: '🧋', color: 0xC8A97E,
        energy: 'Bay bay trong đầu, không có gì quan trọng hơn ly trà sữa',
        description: 'Hôm nay trâu đầu em đang ở một bước về ào... trần mun. Đời sống bình yên nhất khi có ly trà sữa cầm tay và không ai hỏi gì cả.',
        accessories: ['🧋 Trà sữa full topping', '🎧 Tai nghe chống ồn thế giới', '📸 Filter camera màu warm'],
        soundtrack: 'IU — Palette (acoustic version)',
        quote: '"Trà sữa chữa lành mọi thứ" 🧋'
    },
    {
        name: 'Bà Hoàng Nội Tâm', emoji: '🌙', color: 0x5E81AC,
        energy: 'Nhiều suy nghĩ hơn lời nói, sâu hơn người ta tưởng',
        description: 'Ngày hôm nay em thích nhìn ra cửa sổ và suy nghĩ về nhiều thứ lắm. Có điều gì đó đang được ấp ủ bên trong. Người nào hiểu được em hôm nay đáng được giải thưởng.',
        accessories: ['📓 Nhật ký có khóa', '🌙 Ảnh nền màu xanh tím lạnh', '🎧 Playlist chỉ mình em biết'],
        soundtrack: 'Phương Ly — Nếu Em Được Chọn',
        quote: '"Không phải lạnh lùng, chỉ là chọn lọc" 🌙'
    },
    {
        name: 'Gái Bé Sài Gòn', emoji: '👩‍💼', color: 0xFF9500,
        energy: 'Năng động cháy đến 11 giờ đêm mới về',
        description: 'Hôm nay năng lượng em như máy chạy. Lịch dày đặc, cà phê mạnh, không ai bắt kịp. Sài Gòn sinh ra em hôm nay và em đủ sức chạy hết địa bàn.',
        accessories: ['🛵 Grab bike đặt trước', '☕ Cà phê sữa đá vừa', '📱 Zalo, Facebook mở song song'],
        soundtrack: 'Nhạc remix đám cưới trên xe',
        quote: '"Ai chậu không nổi thì đứng sang một bên" 👩‍💼'
    },
    {
        name: 'Phượng Hoàng Tái Sinh', emoji: '🔥', color: 0xFF5733,
        energy: 'Vừa trải qua giai đoạn khó, hôm nay glow up mạnh',
        description: 'Hôm nay em đang bước ra khỏi một giai đoạn cũ với version 2.0 càng xịn hơn. Nước chảy, đá mòn, em thì glow up.',
        accessories: ['💄 Son màu bold mới mua', '🎉 Điệu bộ tự tin hơn thường', '📸 Nhật ký hành trình glow up'],
        soundtrack: 'SZA — Good Days',
        quote: '"Em không phải đang sống sót — em đang trưởng thành" 🔥'
    },
    {
        name: 'Tiểu Thư An Nhàn', emoji: '🫖', color: 0xF8D7DA,
        energy: 'Không vội, không muộn, tất cả đang trong tầm kiểm soát',
        description: 'Hôm nay em chọn sống chậm. Không phải không có việc, chỉ là em ưu tiên những gì làm em thấy định vị. Người ta có thể chạy, em thì không cần.',
        accessories: ['🫖 Nằm diên, điện thoại trên tay', '🥤 Nước ép đẹp', '🪷 Thả mask dưỡng da'],
        soundtrack: 'Taylor Swift — The Eras Tour Acoustic',
        quote: '"Hôm nay em chọn bản thân" 🫖'
    },
    {
        name: 'Một Mình Một Cõi', emoji: '🎒', color: 0x8FBCBB,
        energy: 'Tự lập, tự do, tự đi cà phê một mình',
        description: 'Hôm nay em không cần ai cả. Bản thân là bạn thân tốt nhất. Đi đâu cũng một mình và thấy ổn với điều đó.',
        accessories: ['🎒 Túi một mình bạo', '🎙️ Tai nghe khóa thế giới ngoài', '📷 Nhật ký ảnh solo trips'],
        soundtrack: 'Harry Styles — Adore You',
        quote: '"Solo trip em tự book, đi đâu cũng ok" 🎒'
    },
    {
        name: 'Thần Tài Bỏ Túi', emoji: '💸', color: 0xFFCC00,
        energy: 'Hôm nay may mắn, tài lộc đang về phía em',
        description: 'Năng lượng hôm nay của em đang rất tốt để ký kết, gửi tin nhắn qóa, hỏi lương, hoặc chốt đơn đồ sale. Người ta gọi đó là "main character energy".',
        accessories: ['💳 Ví điện tử sẵn', '🍀 Đồ vật may mắn kèm', '📊 List mục tiêu tháng'],
        soundtrack: 'Doja Cat — Woman',
        quote: '"Tiền như được mua, cơ hội chỉ có một lần" 💸'
    },
    {
        name: 'Nghệ Nhân Thuần Túy', emoji: '🎨', color: 0x9B59B6,
        energy: 'Sáng tạo không có cửa cản, thèm làm một thứ gì đó đẹp',
        description: 'Hôm nay tay em ngứa muốn làm gì đó: vẽ, dán, cắt, chụp, edit. Đầu óc đang rất nhiều ý tưởng nhưng chưa biết xả ra cái nào trước.',
        accessories: ['🎨 Palette màu trendy', '📸 Lightroom preset riêng', '✏️ Sổ tay dotted'],
        soundtrack: 'Cigarettes After Sex — Apocalypse',
        quote: '"Nghệ thuật là cách em nói chuyện không cần lời" 🎨'
    },
    {
        name: 'Gái Bé Hôm Nay Khó', emoji: '🥺', color: 0xA8D8EA,
        energy: 'Phải chăm sóc, phải nhường bộ, đừng đụng',
        description: 'Hôm nay không phải ngày xui nhưng cũng chưa phải ngày vui. Em đang ở trạng thái "cần ai đó hỏi em có ổn không". Nếu không thì chừa.',
        accessories: ['🥺 Giao diện buồn có kinh nghiệm', '👌 Âm muốn gài', '💬 Status ẩn ý nhiều'],
        soundtrack: 'Adele — Someone Like You',
        quote: '"Em ổn. (Không phải ổn)" 🥺'
    },
    {
        name: 'Warrior Tóc Mây', emoji: '💪', color: 0x34C759,
        energy: 'Mạnh mẽ, tự tin, không cần ai xác nhận',
        description: 'Hôm nay em tự tin nhất quý. Không có gì em không thể giải quyết. Validation? Em tự cấp cho chính mình.',
        accessories: ['💪 Playlist càng ngày càng mạnh', '📝 List thành tích bàn thờ', '☀️ Nhật ký được thú đi'],
        soundtrack: 'Beyoncé — Run the World (Girls)',
        quote: '"Em là câu trả lời, không phải câu hỏi" 💪'
    },
    {
        name: 'Nhân Vật Chính Hôm Nay', emoji: '🌟', color: 0x00B4D8,
        energy: 'Main character energy đang bật màn hình',
        description: 'Hôm nay em đang sống trong phân cảnh chuyển hóa. Mọi người xung quanh đều là phụ cảnh. Nhạc nền đang cố tình epic.',
        accessories: ['💋 Son đổi màu theo giờ', '🌟 Outfit có cốt truyện', '🎥 Đầu óc tự thêm nhạc nền'],
        soundtrack: 'Mitski — Nobody',
        quote: '"Hôm nay em đang trong cảnh slow-motion bước vào" 🌟'
    },
];
function getAestheticForDay(userId, dateStr) {
    let hash = 0;
    const str = userId + dateStr + 'aesthetic';
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return AESTHETIC_ARCHETYPES[Math.abs(hash) % AESTHETIC_ARCHETYPES.length];
}
async function handleDailyAesthetic(message) {
    const today = (0, database_1.getVNDateString)(Date.now());
    const userName = message.member?.displayName || message.author.username;
    const arch = getAestheticForDay(message.author.id, today);
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle(`${arch.emoji} HÔM NAY ${userName.toUpperCase()} LÀ: ${arch.name.toUpperCase()}`)
        .setColor(arch.color)
        .setDescription(`*${arch.description}*`)
        .addFields({ name: '⚡ Năng Lượng Chủ Đạo', value: arch.energy, inline: false }, { name: '💌 Phụ Kiện Bắt Buộc', value: arch.accessories.join('\n'), inline: true }, { name: '🎵 Nhạc Nền Hôm Nay', value: arch.soundtrack, inline: true }, { name: '💬 Quót Đặc Trưng', value: arch.quote, inline: false })
        .setFooter({ text: `Aesthetic ngày ${today} • Đổi mỗi ngày lúc 00:00 VN • BotToan Style`, iconURL: message.client.user?.displayAvatarURL() })
        .setTimestamp();
    await message.reply({ embeds: [embed] }).catch(() => { });
}
