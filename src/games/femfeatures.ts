import { Message, EmbedBuilder } from 'discord.js';
import { getVNDateString } from '../database';
import {
    getLastAuraDate, setLastAuraDate,
    getAnonymousLetterData, incrementAnonymousLetterCount,
    getMoodData, saveMood
} from '../database';
import { getAuraReading, processAnonymousLetter, getMoodAdvice } from '../services/gemini';
import { TAROT_DECK } from './tarot';

// ============================================================
// =========== DỮ LIỆU MÀU AURA (14 MÀU VẬN KHÍ) ============
// ============================================================

interface AuraColor {
    name: string;
    emoji: string;
    hexColor: number;
    vibeDesc: string; // mô tả ngắn năng lượng
}

const AURA_COLORS: AuraColor[] = [
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
function getAuraColorForDay(userId: string, dateStr: string): AuraColor {
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

export async function handleAura(message: Message, rawInput: string): Promise<void> {
    const afterCmd = rawInput.replace(/^(aura|mau van khi|sac mau hom nay)\s*/i, '').trim();
    const today = getVNDateString(Date.now());
    const userName = message.member?.displayName || message.author.username;

    // Kiểm tra có phải aura match không
    const mentionedUser = message.mentions.users.filter(u => u.id !== message.client.user?.id).first();
    const isMatch = afterCmd.toLowerCase().includes('match') || mentionedUser !== undefined;

    if (isMatch) {
        // --- AURA MATCH ---
        if (!mentionedUser) {
            await message.reply('💜 **Aura Match cần tag đối tượng!** Ví dụ: `@BotToan aura match @Crush`').catch(() => {});
            return;
        }
        const myAura = getAuraColorForDay(message.author.id, today);
        const theirAura = getAuraColorForDay(mentionedUser.id, today);
        const targetName = message.guild?.members.cache.get(mentionedUser.id)?.displayName || mentionedUser.username;

        const typingMsg = await message.reply('🔮 *Đang đọc luồng năng lượng giữa hai người...*').catch(() => null);
        let reading = '';
        try {
            reading = await getAuraReading(myAura.name, userName, theirAura.name, targetName);
        } catch {
            reading = 'Vũ trụ đang bận, thử lại sau nhé!';
        }
        await typingMsg?.delete().catch(() => {});

        const embed = new EmbedBuilder()
            .setTitle(`${myAura.emoji} AURA MATCH: ${userName} & ${targetName} ${theirAura.emoji}`)
            .setColor(myAura.hexColor)
            .setDescription(reading)
            .addFields(
                { name: `${myAura.emoji} Aura của ${userName}`, value: `**${myAura.name}**\n*${myAura.vibeDesc}*`, inline: true },
                { name: `${theirAura.emoji} Aura của ${targetName}`, value: `**${theirAura.name}**\n*${theirAura.vibeDesc}*`, inline: true }
            )
            .setFooter({ text: `Aura Match ngày ${today} • BotToan Huyền Bí`, iconURL: message.client.user?.displayAvatarURL() })
            .setTimestamp();

        await message.reply({ embeds: [embed] }).catch(() => {});
        return;
    }

    // --- AURA ĐƠN (Bói vận khí hôm nay) ---
    const lastDate = await getLastAuraDate(message.author.id);
    if (lastDate === today) {
        const myAura = getAuraColorForDay(message.author.id, today);
        await message.reply(`${myAura.emoji} **Aura hôm nay của bạn đã được bói rồi!** Màu vận khí hôm nay là **${myAura.name}** — check lại tin nhắn trước nhé. Ngày mai quay lại để xem màu mới! 🌙`).catch(() => {});
        return;
    }

    const myAura = getAuraColorForDay(message.author.id, today);
    await setLastAuraDate(message.author.id, today);

    const typingMsg = await message.reply(`${myAura.emoji} *Đang đọc luồng Aura của bạn hôm nay...*`).catch(() => null);
    let reading = '';
    try {
        reading = await getAuraReading(myAura.name, userName);
    } catch {
        reading = 'Vũ trụ đang nhiễu sóng, nhưng năng lượng bạn hôm nay trông rất tốt đấy! ✨';
    }
    await typingMsg?.delete().catch(() => {});

    const embed = new EmbedBuilder()
        .setTitle(`${myAura.emoji} VẬN KHÍ MÀU SẮC HÔM NAY — ${myAura.name.toUpperCase()}`)
        .setColor(myAura.hexColor)
        .setDescription(reading)
        .addFields(
            { name: '🌈 Màu Aura Hôm Nay', value: `${myAura.emoji} **${myAura.name}**`, inline: true },
            { name: '✨ Năng Lượng', value: myAura.vibeDesc, inline: true },
            { name: '💡 Gợi ý thêm', value: '`@BotToan aura match @User` để xem hai người hợp nhau không hôm nay!', inline: false }
        )
        .setFooter({ text: `Vận khí ngày ${today} • Đổi màu mỗi ngày lúc 00:00 VN`, iconURL: message.client.user?.displayAvatarURL() })
        .setTimestamp();

    await message.reply({ embeds: [embed] }).catch(() => {});
}

// ============================================================
// =========== TÍNH NĂNG 2: HỘP THƯ BÍ MẬT (ANONYMOUS) ======
// ============================================================

// Hàng đợi thư kẹt (trong RAM — thư chưa gửi được vì người nhận khóa DM)
// Map<receiverId, { senderId, processedContent, tone, timestamp }[]>
const pendingLetterQueue = new Map<string, { senderId: string; processedContent: string; tone: string; timestamp: number }[]>();

export async function handleAnonymousLetter(message: Message, rawInput: string): Promise<void> {
    const today = getVNDateString(Date.now());

    // Kiểm tra giới hạn 2 thư/ngày
    const letterData = await getAnonymousLetterData(message.author.id);
    const todayCount = letterData.lastDate === today ? letterData.count : 0;
    if (todayCount >= 2) {
        await message.reply('💌 **Hết hạn mạch hôm nay rồi fen ơi!** Mỗi ngày chỉ được gửi **2 thư bí mật** thôi. Ngày mai quay lại nhé! 🌙').catch(() => {});
        return;
    }

    // Tìm người nhận
    const targetUser = message.mentions.users.filter(u => u.id !== message.client.user?.id).first();
    if (!targetUser) {
        await message.reply('💌 **Gửi thư bí mật cho ai?** Tag người nhận vào! Ví dụ:\n`@BotToan thu bi mat @User --love Mình thích bạn từ lâu rồi!`\n`@BotToan thu bi mat @User --drama Ai đó muốn nhắc nhở bạn điều gì đó...`').catch(() => {});
        return;
    }

    if (targetUser.id === message.author.id) {
        await message.reply('💌 **Gửi thư cho chính mình?** Thôi thôi, mở nhật ký ra viết đi bạn ơi! 📖').catch(() => {});
        return;
    }
    if (targetUser.bot) {
        await message.reply('💌 **Bot không đọc thư được đâu bạn ơi!** Gửi cho người thật đi nào! 🤖').catch(() => {});
        return;
    }

    // Parse tone và nội dung
    let tone: 'love' | 'drama' = 'love';
    let content = rawInput
        .replace(/^(thu bi mat|anonymous|anon)\s+/i, '')
        .replace(/<@!?\d+>/g, '')
        .replace(/--love\s*/i, '')
        .replace(/--drama\s*/i, '')
        .trim();

    if (/--drama/i.test(rawInput)) tone = 'drama';
    if (!content || content.length < 3) {
        await message.reply(`💌 **Ơ thư trống rỗng!** Viết nội dung vào đi bạn!\nVí dụ: \`@BotToan thu bi mat @User --love Mình rất ngưỡng mộ bạn!\``).catch(() => {});
        return;
    }

    // Xử lý thư bằng Gemini
    const processingMsg = await message.reply(`${tone === 'love' ? '💌' : '🎭'} *Đang mã hóa bức thư bí mật của bạn...*`).catch(() => null);
    let processedContent = content;
    try {
        processedContent = await processAnonymousLetter(content, tone);
    } catch {
        // Nếu Gemini lỗi, dùng nội dung gốc
        processedContent = content;
    }
    await processingMsg?.delete().catch(() => {});

    // Xóa lệnh gốc để bảo mật người gửi
    await message.delete().catch(() => {});

    // Tạo embed thư
    const toneLabel = tone === 'love' ? '💌 Thư Tình Ẩn Danh' : '🎭 Thư Bí Mật';
    const letterEmbed = new EmbedBuilder()
        .setTitle(`${toneLabel}`)
        .setColor(tone === 'love' ? 0xFF6EB4 : 0x7B2FBE)
        .setDescription(`*Bạn nhận được một lá thư bí mật từ ai đó trên server...*\n\n💬 **"${processedContent}"**`)
        .addFields({ name: '📮 Người gửi', value: '*Ẩn danh hoàn toàn*', inline: true })
        .setFooter({ text: 'Trả lời: @BotToan thu bi mat @<người gửi> --love <nội dung> • BotToan Anonymous' })
        .setTimestamp();

    // Gửi DM cho người nhận
    try {
        await targetUser.send({ embeds: [letterEmbed] });
        await incrementAnonymousLetterCount(message.author.id, today);

        // Thông báo gửi thành công (ephemeral - gửi tới người gửi)
        const successMsg = await (message.channel as any).send({
            content: `📮 **Thư bí mật đã được gửi thành công!** *(tin nhắn này tự xóa sau 5 giây)*`,
        }).catch(() => null);
        setTimeout(() => successMsg?.delete().catch(() => {}), 5000);

    } catch (err: any) {
        // Người nhận khóa DM — lưu vào hàng đợi
        const queue = pendingLetterQueue.get(targetUser.id) || [];
        queue.push({ senderId: message.author.id, processedContent, tone, timestamp: Date.now() });
        pendingLetterQueue.set(targetUser.id, queue);

        const failMsg = await (message.channel as any).send({
            content: `📮 **Gửi hụt rồi <@${message.author.id}> ơi!** Đối phương đang bế quan tỏa cảng, khóa DM rồi. Thư đã được lưu vào hàng đợi — bảo người ta mở DM ra thì nhắn \`@BotToan checkdm\` để nhận nhé! 📬`
        }).catch(() => null);
        setTimeout(() => failMsg?.delete().catch(() => {}), 10000);
    }
}

/**
 * Kiểm tra thư đang kẹt trong hàng đợi (dành cho người nhận)
 */
export async function handleCheckDM(message: Message): Promise<void> {
    const userId = message.author.id;
    const queue = pendingLetterQueue.get(userId);

    if (!queue || queue.length === 0) {
        await message.reply('📭 **Hộp thư trống teo!** Chưa có thư bí mật nào đang đợi bạn cả. *(Hoặc hãy thử mở DM rồi bảo bạn bè gửi thư nhé!)*').catch(() => {});
        return;
    }

    // Thử gửi lại các thư còn kẹt
    let sentCount = 0;
    const remaining = [];
    for (const letter of queue) {
        const toneLabel = letter.tone === 'love' ? '💌 Thư Tình Ẩn Danh' : '🎭 Thư Bí Mật';
        const letterEmbed = new EmbedBuilder()
            .setTitle(toneLabel)
            .setColor(letter.tone === 'love' ? 0xFF6EB4 : 0x7B2FBE)
            .setDescription(`*Bạn nhận được một lá thư bí mật từ ai đó trên server...*\n\n💬 **"${letter.processedContent}"**`)
            .addFields({ name: '📮 Người gửi', value: '*Ẩn danh hoàn toàn*', inline: true })
            .setFooter({ text: 'BotToan Anonymous • Gửi từ hàng đợi' })
            .setTimestamp(new Date(letter.timestamp));
        try {
            await message.author.send({ embeds: [letterEmbed] });
            sentCount++;
        } catch {
            remaining.push(letter);
        }
    }

    if (remaining.length === 0) {
        pendingLetterQueue.delete(userId);
    } else {
        pendingLetterQueue.set(userId, remaining);
    }

    if (sentCount > 0) {
        await message.reply(`📬 **Đã gửi ${sentCount} thư bí mật vào DM của bạn!** Check inbox đi nào! 💌`).catch(() => {});
    } else {
        await message.reply(`📪 **Vẫn không gửi được!** DM của bạn vẫn đang bị khóa. Vào Settings → Privacy & Safety → bật "Allow direct messages" rồi thử lại nhé!`).catch(() => {});
    }
}

// ============================================================
// =========== TÍNH NĂNG 3: NHẬT KÝ TÂM TRẠNG (MOOD) =========
// ============================================================

interface MoodConfig {
    label: string;
    emoji: string;
    color: number;
    tarotHint: string; // gợi ý lá tarot tương ứng
}

const MOOD_MAP: { [key: string]: MoodConfig } = {
    'vui':  { label: 'Vui Vẻ 😊', emoji: '😊', color: 0xFFCC00, tarotHint: 'The Sun (Mặt Trời) — ánh sáng hân hoan' },
    'buon': { label: 'Buồn Bã 😢', emoji: '😢', color: 0x5E81AC, tarotHint: 'The Moon (Mặt Trăng) — cảm xúc sâu thẳm' },
    'lo':   { label: 'Lo Lắng 😰', emoji: '😰', color: 0xEBCB8B, tarotHint: 'The Hermit (Ẩn Sĩ) — cần thời gian tĩnh lặng' },
    'gian': { label: 'Tức Giận 😤', emoji: '😤', color: 0xBF616A, tarotHint: 'The Tower (Tháp Đổ) — năng lượng bùng nổ cần giải phóng' },
    'met':  { label: 'Mệt Mỏi 😴', emoji: '😴', color: 0x8FBCBB, tarotHint: 'The Hermit (Ẩn Sĩ) — cần nghỉ ngơi nạp lại năng lượng' },
};

// Nhận dạng tâm trạng từ input thô
function parseMood(input: string): string | null {
    const lower = input.toLowerCase().trim();
    if (lower.includes('vui') || lower.includes('happy') || lower.includes('😊')) return 'vui';
    if (lower.includes('buon') || lower.includes('sad') || lower.includes('😢') || lower.includes('😭')) return 'buon';
    if (lower.includes('lo') || lower.includes('lo lang') || lower.includes('anxiety') || lower.includes('😰')) return 'lo';
    if (lower.includes('gian') || lower.includes('tuc') || lower.includes('angry') || lower.includes('😤') || lower.includes('😡')) return 'gian';
    if (lower.includes('met') || lower.includes('tired') || lower.includes('😴') || lower.includes('😪')) return 'met';
    return null;
}

// Emoji cho biểu đồ tâm trạng tuần
const MOOD_EMOJIS: { [key: string]: string } = {
    'vui': '😊', 'buon': '😢', 'lo': '😰', 'gian': '😤', 'met': '😴'
};

export async function handleMoodDiary(message: Message, rawInput: string): Promise<void> {
    const today = getVNDateString(Date.now());
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
        await message.reply(
            '🌈 **Bạn đang cảm thấy thế nào?**\n' +
            'Gõ: `@BotToan tam trang vui` / `buon` / `lo` / `gian` / `met`\n' +
            'Hoặc dùng emoji: 😊 😢 😰 😤 😴\n\n' +
            '📊 Gõ `@BotToan mood summary` để xem biểu đồ cảm xúc tuần qua!'
        ).catch(() => {});
        return;
    }

    const moodData = await getMoodData(message.author.id);
    const alreadyLoggedToday = moodData.lastDate === today;

    // Lấy lá tarot mini ngẫu nhiên (seed = userId + today + mood để nhất quán)
    let hashSeed = 0;
    const seedStr = message.author.id + today + moodKey;
    for (let i = 0; i < seedStr.length; i++) {
        hashSeed = ((hashSeed << 5) - hashSeed) + seedStr.charCodeAt(i);
        hashSeed |= 0;
    }
    const tarotCard = TAROT_DECK[Math.abs(hashSeed) % TAROT_DECK.length];
    const config = MOOD_MAP[moodKey];

    // Lưu mood và tính streak
    const newStreak = await saveMood(message.author.id, moodKey, today);

    // Gọi Gemini tư vấn
    const typingMsg = await message.reply(`${config.emoji} *Đang lắng nghe bạn...*`).catch(() => null);
    let advice = '';
    try {
        advice = await getMoodAdvice(config.label, userName, `${tarotCard.name} (${tarotCard.englishName})`);
    } catch {
        advice = `${config.emoji} Cảm ơn bạn đã chia sẻ! Dù hôm nay bạn đang ${config.label.toLowerCase()}, hãy nhớ rằng mỗi cảm xúc đều có giá trị riêng của nó. Hãy trân trọng bản thân nhé! 💙`;
    }
    await typingMsg?.delete().catch(() => {});

    // Streak badge
    let streakBadge = '';
    if (newStreak >= 7) streakBadge = '👑 **Streak 7+ ngày!** Bạn thật kiên trì!';
    else if (newStreak >= 3) streakBadge = `🔥 **Streak ${newStreak} ngày!** Đang giữ đà tốt!`;
    else if (newStreak >= 2) streakBadge = `✨ **Streak ${newStreak} ngày!** Bắt đầu rồi đấy!`;

    const alreadyNote = alreadyLoggedToday ? '\n*(Bạn đã cập nhật tâm trạng hôm nay — vừa ghi lại lần 2)*' : '';

    const embed = new EmbedBuilder()
        .setTitle(`${config.emoji} NHẬT KÝ TÂM TRẠNG — ${config.label.toUpperCase()}`)
        .setColor(config.color)
        .setDescription(advice + alreadyNote)
        .addFields(
            { name: '🃏 Lá Tarot Hôm Nay', value: `**${tarotCard.name}** *(${tarotCard.englishName})*\n*${config.tarotHint}*`, inline: false },
            { name: '📅 Ngày Ghi', value: today, inline: true },
            { name: '🔥 Streak', value: `**${newStreak}** ngày liên tiếp`, inline: true }
        )
        .setFooter({ text: '`@BotToan mood summary` để xem biểu đồ tuần qua • BotToan tâm lý', iconURL: message.client.user?.displayAvatarURL() })
        .setTimestamp();

    if (streakBadge) embed.addFields({ name: '🏆 Thành Tích', value: streakBadge, inline: false });

    await message.reply({ embeds: [embed] }).catch(() => {});
}

async function handleMoodSummary(message: Message, userName: string, today: string): Promise<void> {
    const data = await getMoodData(message.author.id);

    if (data.weeklyMoods.length === 0) {
        await message.reply('📊 **Chưa có dữ liệu tâm trạng!** Hãy gõ `@BotToan tam trang vui/buon/lo/gian/met` mỗi ngày để BotToan lưu nhật ký nhé! 🌈').catch(() => {});
        return;
    }

    // Tổng hợp mood 7 ngày
    const moodCount: { [key: string]: number } = { vui: 0, buon: 0, lo: 0, gian: 0, met: 0 };
    for (const entry of data.weeklyMoods) {
        if (moodCount[entry.mood] !== undefined) moodCount[entry.mood]++;
    }

    // Mood chủ đạo
    const dominantMood = Object.entries(moodCount).sort((a, b) => b[1] - a[1])[0];
    const dominantConfig = dominantMood ? MOOD_MAP[dominantMood[0]] : MOOD_MAP['vui'];

    // Biểu đồ emoji theo ngày (7 ngày gần nhất)
    const last7Days: string[] = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() + 7 * 3600000 - i * 86400000);
        const dStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
        const entry = data.weeklyMoods.find(e => e.date === dStr);
        const dayLabel = `**${d.getUTCDate()}/${d.getUTCMonth() + 1}**`;
        last7Days.push(entry ? `${dayLabel}: ${MOOD_EMOJIS[entry.mood] || '❓'}` : `${dayLabel}: ⬜`);
    }

    // Lời tổng kết dí dỏm theo mood chủ đạo
    const summaryLines: { [key: string]: string[] } = {
        vui:  [`Tuần qua ${userName} vui như Tết, năng lượng xịn mịn lắm! 🎉`, `Cả tuần xôm tụ thế này, BotToan cũng lây được vui rồi! ✨`],
        buon: [`Tuần qua hơi nặng nề nhỉ, nhưng sóng gió rồi cũng qua thôi! 🌊`, `${userName} ơi, biển động thì cá mới trưởng thành — ổn thôi! 💙`],
        lo:   [`Lo nhiều quá rồi đấy, hít thở sâu đi nào ${userName}! 🍃`, `Tuần qua worry nhiều — nhưng 90% điều lo thì không xảy ra đâu bạn ơi! 🌸`],
        gian: [`Cháy cả tuần thế này, cần xả stress đi thôi ${userName}! 🔥`, `Tức nhiều quá rồi — bớt năng lượng vào chỗ đáng giá hơn nhé! 💪`],
        met:  [`Pin yếu cả tuần rồi, cần sạc lại gấp! Ngủ đủ giấc vào! 😴`, `Mệt mà vẫn cố thế này, ${userName} thật sự kiên cường! Nhớ nghỉ ngơi nhé! 🤍`],
    };
    const summaryArr = summaryLines[dominantMood?.[0] || 'vui'] || summaryLines.vui;
    const summaryText = summaryArr[Math.floor(Math.random() * summaryArr.length)];

    const embed = new EmbedBuilder()
        .setTitle(`📊 BIỂU ĐỒ CẢM XÚC TUẦN QUA — ${userName.toUpperCase()}`)
        .setColor(dominantConfig.color)
        .setDescription(`*${summaryText}*`)
        .addFields(
            { name: '📅 7 Ngày Qua', value: last7Days.join(' | '), inline: false },
            { name: '😊 Vui', value: `${moodCount.vui} ngày`, inline: true },
            { name: '😢 Buồn', value: `${moodCount.buon} ngày`, inline: true },
            { name: '😰 Lo', value: `${moodCount.lo} ngày`, inline: true },
            { name: '😤 Giận', value: `${moodCount.gian} ngày`, inline: true },
            { name: '😴 Mệt', value: `${moodCount.met} ngày`, inline: true },
            { name: '🏆 Mood Chủ Đạo', value: `${dominantConfig.emoji} **${dominantConfig.label}**`, inline: true },
            { name: '🔥 Streak Hiện Tại', value: `**${data.streak}** ngày liên tiếp`, inline: false }
        )
        .setFooter({ text: `Nhật ký ${data.weeklyMoods.length} ngày đã ghi • BotToan tâm lý`, iconURL: message.client.user?.displayAvatarURL() })
        .setTimestamp();

    await message.reply({ embeds: [embed] }).catch(() => {});
}
