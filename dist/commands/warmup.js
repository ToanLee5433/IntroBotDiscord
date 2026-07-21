"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activeVideoMessages = exports.globalWarmupCache = exports.CATEGORY_EMOJIS = void 0;
exports.isTikTokUrl = isTikTokUrl;
exports.convertToTnktok = convertToTnktok;
exports.isDiscordCdnUrlExpired = isDiscordCdnUrlExpired;
exports.loadWarmupVideosCache = loadWarmupVideosCache;
exports.handleWarmupCommand = handleWarmupCommand;
exports.registerWarmupCollector = registerWarmupCollector;
const discord_js_1 = require("discord.js");
const database_1 = require("../database");
const config_1 = require("../config");
// Bản đồ Emoji tương ứng với từng thể loại video
exports.CATEGORY_EMOJIS = {
    'Gaming': '🎮',
    'Meme': '😂',
    'Music': '🎶',
    'Tiktok': '📱',
    'Dance': '💃',
    'General': '🎬'
};
// RAM Cache lưu trữ tạm thời các video để truy cập cực nhanh
exports.globalWarmupCache = [];
// Quản lý tin nhắn video đang phát trên từng kênh chat để tự động xóa tin nhắn cũ
exports.activeVideoMessages = new Map(); // channelId -> messageId
function getCategoryEmoji(category) {
    const catLower = category.toLowerCase().trim();
    // Tự động nhận diện từ khóa để gán emoji phù hợp cho các thể loại tự nhập
    if (catLower.includes('valorant') || catLower.includes('lol') || catLower.includes('cs') || catLower.includes('game') || catLower.includes('pubg') || catLower.includes('lien quan') || catLower.includes('toc chien')) {
        return '🎮';
    }
    if (catLower.includes('tiktok') || catLower.includes('douyin') || catLower.includes('shorts') || catLower.includes('reels')) {
        return '📱';
    }
    if (catLower.includes('dance') || catLower.includes('vu dao') || catLower.includes('dancer') || catLower.includes('nhay')) {
        return '💃';
    }
    if (catLower.includes('music') || catLower.includes('nhac') || catLower.includes('song') || catLower.includes('sing')) {
        return '🎶';
    }
    if (catLower.includes('meme') || catLower.includes('hai') || catLower.includes('funny') || catLower.includes('comedy')) {
        return '😂';
    }
    // Khớp chính xác theo map mặc định
    const matchedKey = Object.keys(exports.CATEGORY_EMOJIS).find(k => k.toLowerCase() === catLower);
    if (matchedKey)
        return exports.CATEGORY_EMOJIS[matchedKey];
    return '🎬';
}
/** Kiểm tra URL có phải YouTube không */
function isYouTubeUrl(url) {
    return /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)/i.test(url);
}
/** Lấy video ID từ YouTube URL (dùng để tạo thumbnail) */
function getYouTubeId(url) {
    const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([\w-]{11})/);
    return m ? m[1] : null;
}
/** Kiểm tra URL có phải TikTok không */
function isTikTokUrl(url) {
    return /^(https?:\/\/)?(www\.|vm\.|vt\.)?tiktok\.com/i.test(url);
}
/** Chuyển đổi URL TikTok sang tnktok.com để Discord tự động hiển thị trình phát video */
function convertToTnktok(url) {
    return url.replace(/(www\.)?(tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com)/i, (match, p1, p2) => {
        return p2.replace('tiktok.com', 'tnktok.com');
    });
}
/** Kiểm tra xem link CDN đính kèm của Discord đã hết hạn (hoặc sắp hết hạn) chưa */
function isDiscordCdnUrlExpired(url) {
    if (!url)
        return true;
    try {
        const parsedUrl = new URL(url);
        const exHex = parsedUrl.searchParams.get('ex');
        if (!exHex)
            return false;
        const exSec = parseInt(exHex, 16);
        if (isNaN(exSec))
            return false;
        // Nếu còn ít hơn 5 phút (300 giây) thì coi như hết hạn để refresh sớm
        return exSec < (Date.now() / 1000) + 300;
    }
    catch {
        return false;
    }
}
async function loadWarmupVideosCache(client) {
    try {
        if (!config_1.WARMUP_CHANNEL_ID) {
            console.warn("[WARMUP] WARMUP_CHANNEL_ID chưa được cấu hình trong .env.");
            return;
        }
        const channel = await client.channels.fetch(config_1.WARMUP_CHANNEL_ID).catch(() => null);
        if (!channel || !channel.isTextBased()) {
            console.error(`[WARMUP LỖI] Không tìm thấy kênh lưu trữ video với ID: ${config_1.WARMUP_CHANNEL_ID}`);
            return;
        }
        const dbVideos = await (0, database_1.getWarmupVideos)();
        if (dbVideos.length === 0) {
            exports.globalWarmupCache = [];
            console.log("[WARMUP] Không có dữ liệu video nào trong cơ sở dữ liệu.");
            return;
        }
        const textChannel = channel;
        let allMessages = [];
        let lastId = undefined;
        let fetchCount = 0;
        const maxFetches = 3; // Chỉ quét 300 tin nhắn gần nhất lúc khởi động để tránh rate limit và khởi động siêu tốc
        while (fetchCount < maxFetches) {
            const options = { limit: 100 };
            if (lastId)
                options.before = lastId;
            const fetched = await textChannel.messages.fetch(options).catch(() => null);
            if (!fetched || fetched.size === 0)
                break;
            allMessages = allMessages.concat(Array.from(fetched.values()));
            lastId = fetched.last()?.id;
            fetchCount++;
            if (fetched.size < 100)
                break;
        }
        const messageMap = new Map();
        for (const msg of allMessages) {
            const attachment = msg.attachments.first();
            if (attachment && attachment.url) {
                messageMap.set(msg.id, { url: attachment.url, fileName: attachment.name || 'video.mp4' });
            }
        }
        const newCache = [];
        for (const video of dbVideos) {
            // Video YouTube/external: lấy URL thẳng từ DB, không cần scan Discord message
            if (video.videoType === 'youtube' || video.videoType === 'external') {
                if (video.videoUrl) {
                    newCache.push({
                        id: video.id || "",
                        title: video.title,
                        description: video.description || "",
                        category: video.category,
                        videoUrl: video.videoUrl,
                        videoType: video.videoType,
                        addedBy: video.addedBy || "",
                        fileName: ""
                    });
                }
                continue;
            }
            // Video Discord: tìm URL từ messageMap (nếu có trong 300 tin nhắn gần nhất)
            const data = messageMap.get(video.messageId);
            // Nạp video vào cache. Nếu chưa quét thấy URL ở đợt tải nhanh, ta sẽ lazy-load khi phát.
            newCache.push({
                id: video.id || "",
                title: video.title,
                description: video.description || "",
                category: video.category,
                videoUrl: data?.url || "", // Để trống nếu không tìm thấy trong đợt quét nhanh
                videoType: 'discord',
                addedBy: video.addedBy || "",
                fileName: data?.fileName || video.fileName || "video.mp4",
                messageId: video.messageId
            });
        }
        exports.globalWarmupCache = newCache;
        console.log(`[WARMUP] Đã nạp thành công ${exports.globalWarmupCache.length}/${dbVideos.length} video warmup vào RAM Cache.`);
    }
    catch (error) {
        console.error("[WARMUP CACHE LỖI] Lỗi nghiêm trọng khi nạp cache video:", error);
    }
}
async function sendVideoToUser(interaction, video, client, rows) {
    const emoji = getCategoryEmoji(video.category);
    const updatedEmbed = new discord_js_1.EmbedBuilder()
        .setTitle(`🎬 ĐANG XEM: ${video.title.toUpperCase()}`)
        .setDescription(video.description || "Khởi động giải trí cùng BotToan!")
        .addFields({ name: "📂 Thể loại", value: `${emoji} \`${video.category}\``, inline: true }, { name: "👤 Đóng góp bởi", value: video.addedBy ? `<@${video.addedBy}>` : "Ẩn danh", inline: true })
        .setColor(video.videoType === 'youtube' ? 0xFF0000 : 0x9B59B6)
        .setFooter({ text: "Bạn có thể tiếp tục chọn video khác từ menu bên dưới", iconURL: client.user?.displayAvatarURL() })
        .setTimestamp();
    if (video.videoType === 'youtube') {
        const ytId = getYouTubeId(video.videoUrl);
        if (ytId) {
            updatedEmbed.setThumbnail(`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`);
        }
    }
    // Bước 1: Dùng deferUpdate() để báo đang xử lý và tránh lỗi hết hạn interaction
    try {
        await interaction.deferUpdate();
    }
    catch {
        return;
    }
    // Cập nhật embed hiển thị thông tin bài đang phát lên tin nhắn gốc chứa menu
    await interaction.editReply({
        content: `⏳ Đang phát video **${video.title}** ở tin nhắn mới phía dưới...`,
        embeds: [updatedEmbed],
        components: rows,
        files: []
    }).catch(() => { });
    // Lazy load URL của video Discord nếu chưa có URL hoặc link cũ bị hết hạn CDN
    let videoUrl = video.videoUrl;
    let fileName = video.fileName || 'video.mp4';
    if (video.videoType === 'discord' && (!videoUrl || isDiscordCdnUrlExpired(videoUrl)) && video.messageId) {
        try {
            const channel = await client.channels.fetch(config_1.WARMUP_CHANNEL_ID).catch(() => null);
            if (channel) {
                const msg = await channel.messages.fetch(video.messageId).catch(() => null);
                const attachment = msg?.attachments.first();
                if (attachment && attachment.url) {
                    videoUrl = attachment.url;
                    fileName = attachment.name || fileName;
                    // Cập nhật ngược lại vào RAM cache để các lần sau không cần fetch nữa
                    video.videoUrl = attachment.url;
                    video.fileName = attachment.name || video.fileName;
                }
            }
        }
        catch (e) {
            console.error("[WARMUP LAZY LOAD LỖI] Lỗi lazy load video URL:", e);
        }
    }
    // Nếu vẫn không tìm thấy videoUrl (file đã bị xóa hẳn khỏi Discord)
    if (video.videoType === 'discord' && !videoUrl) {
        // Tự động xóa khỏi Database và RAM Cache để dọn dẹp dữ liệu rác
        try {
            await (0, database_1.deleteWarmupVideo)(video.id);
            exports.globalWarmupCache = exports.globalWarmupCache.filter(v => v.id !== video.id);
            console.log(`[WARMUP AUTO-CLEAN] Đã tự động xóa video hỏng khỏi DB: ID = ${video.id}, Tiêu đề = ${video.title}`);
        }
        catch (dbErr) {
            console.error("[WARMUP] Lỗi tự động dọn dẹp video hỏng khỏi DB:", dbErr);
        }
        await interaction.editReply({
            content: `❌ **Không thể phát video này!** File đính kèm trên Discord của video này đã bị xóa hoặc không thể truy cập.\n*Bot đã tự động dọn dẹp và xóa video này khỏi danh sách.*`,
            embeds: [],
            components: []
        }).catch(() => { });
        return;
    }
    // Bước 2: Quản lý tin nhắn phát video để tránh spam (xóa tin cũ trong kênh)
    const channelId = interaction.channelId;
    const oldMsgId = exports.activeVideoMessages.get(channelId);
    if (oldMsgId) {
        try {
            const channel = await client.channels.fetch(channelId).catch(() => null);
            if (channel) {
                const oldMsg = await channel.messages.fetch(oldMsgId).catch(() => null);
                if (oldMsg)
                    await oldMsg.delete().catch(() => { });
            }
        }
        catch { }
    }
    // Tạo các nút điều hướng
    const prevButton = new discord_js_1.ButtonBuilder()
        .setCustomId(`warmup:nav:prev:${video.id}:${video.category.toLowerCase()}`)
        .setLabel('◀️ Video trước')
        .setStyle(discord_js_1.ButtonStyle.Primary);
    const randomButton = new discord_js_1.ButtonBuilder()
        .setCustomId(`warmup:nav:random:${video.id}:${video.category.toLowerCase()}`)
        .setLabel('🎲 Ngẫu nhiên')
        .setStyle(discord_js_1.ButtonStyle.Secondary);
    const nextButton = new discord_js_1.ButtonBuilder()
        .setCustomId(`warmup:nav:next:${video.id}:${video.category.toLowerCase()}`)
        .setLabel('Video sau ▶️')
        .setStyle(discord_js_1.ButtonStyle.Primary);
    const row = new discord_js_1.ActionRowBuilder().addComponents(prevButton, randomButton, nextButton);
    // Bước 3: Gửi tin nhắn mới chứa video/YouTube URL để Discord tự render video player tuyệt đối chính xác
    try {
        let newMsg;
        if (video.videoType === 'youtube' || video.videoType === 'external') {
            newMsg = await interaction.channel.send({
                content: `🎥 **${video.title.toUpperCase()}** (${getCategoryEmoji(video.category)} \`${video.category}\`)\n${videoUrl}`,
                components: [row]
            });
        }
        else {
            const MAX_SIZE = 24 * 1024 * 1024;
            const response = await fetch(videoUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BotToan-Discord/1.0)' }
            });
            if (!response.ok)
                throw new Error(`HTTP ${response.status}`);
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            if (buffer.length > MAX_SIZE)
                throw new Error(`FILE_TOO_LARGE`);
            const attachment = new discord_js_1.AttachmentBuilder(buffer, { name: fileName });
            newMsg = await interaction.channel.send({
                content: `🎥 **${video.title.toUpperCase()}** (${getCategoryEmoji(video.category)} \`${video.category}\`)`,
                files: [attachment],
                components: [row]
            });
        }
        if (newMsg) {
            exports.activeVideoMessages.set(channelId, newMsg.id);
        }
        // Xóa thông báo "đang phát" khỏi tin nhắn menu để giữ giao diện sạch đẹp
        await interaction.editReply({
            content: '',
            embeds: [updatedEmbed],
            components: rows
        }).catch(() => { });
    }
    catch (err) {
        console.warn(`[WARMUP] Gặp lỗi đính kèm file, fallback gửi link CDN: ${err.message}`);
        // Fallback gửi link CDN thô kèm các nút
        const fallbackMsg = await interaction.channel.send({
            content: `🎥 **${video.title.toUpperCase()}** (${getCategoryEmoji(video.category)} \`${video.category}\`)\n${videoUrl}`,
            components: [row]
        }).catch(() => null);
        if (fallbackMsg) {
            exports.activeVideoMessages.set(channelId, fallbackMsg.id);
        }
        await interaction.editReply({
            content: '',
            embeds: [updatedEmbed],
            components: rows
        }).catch(() => { });
    }
}
async function handleWarmupCommand(message, rawInput, client) {
    const args = rawInput.trim().split(/\s+/);
    const subCommand = args[1] ? args[1].toLowerCase() : '';
    const isAdmin = message.member?.permissions.has(discord_js_1.PermissionFlagsBits.Administrator);
    // 1. ADD VIDEO
    if (subCommand === 'add') {
        if (!isAdmin) {
            await message.reply("❌ **ĐÉO CÓ QUYỀN!** Lệnh thêm video warmup chỉ dành cho Admin đẹp trai/xinh gái thôi nhé! 😤").catch(() => { });
            return;
        }
        const rest = rawInput.replace(/^(warmup|video)\s+add\s*/i, '').trim();
        if (!rest) {
            await message.reply("❌ **Sai cú pháp!** Hãy gõ theo mẫu:\n" +
                "`@BotToan warmup add Tiêu đề | Mô tả | Thể loại`\n" +
                "*(Kèm file video đính kèm HOAC thêm link YouTube vào Mô tả)*\n" +
                "*(Thể loại: Gaming / Meme / Music / Tiktok / Dance / General hoặc tự nhập)*").catch(() => { });
            return;
        }
        const parts = rest.split('|');
        const title = parts[0] ? parts[0].trim() : '';
        const description = parts[1] ? parts[1].trim() : '';
        let category = parts[2] ? parts[2].trim() : 'General';
        // Kiểm tra xem có URL trong phần còn lại không
        // Ưu tiên: tìm URL trong part[3], sau đó tìm trong toàn bộ nội dung
        let inputUrl = null;
        let videoType = 'external';
        const urlSearchText = parts.slice(3).join('|').trim() || rest;
        const urlMatch = urlSearchText.match(/(https?:\/\/[^\s|]+)/i);
        if (urlMatch) {
            inputUrl = urlMatch[1].trim();
            if (isYouTubeUrl(inputUrl)) {
                videoType = 'youtube';
            }
            else {
                videoType = 'external';
                // Tự động tối ưu hóa link TikTok sang tnktok
                if (isTikTokUrl(inputUrl)) {
                    inputUrl = convertToTnktok(inputUrl);
                    if (category === 'General') {
                        category = 'TikTok của Trang Anh';
                    }
                }
            }
        }
        // Nếu không có URL và không có file đính kèm thì báo lỗi
        const attachment = message.attachments.first();
        if (!inputUrl && !attachment) {
            await message.reply("❌ **Thiếu nội dung video!** Bạn cần một trong hai:\n" +
                "📎 Upload file video (MP4/WebM) kèm theo tin nhắn\n" +
                "📺 Hoặc thêm link (YouTube, Tiktok, Facebook, link video...) vào cuối lệnh:\n" +
                "`@BotToan warmup add Tiêu đề | Mô tả | General | https://...`").catch(() => { });
            return;
        }
        // Chuẩn hóa category
        const validCategories = Object.keys(exports.CATEGORY_EMOJIS);
        const matchedCat = validCategories.find(c => c.toLowerCase() === category.toLowerCase());
        if (matchedCat) {
            category = matchedCat;
        }
        else if (category) {
            category = category.split(/\s+/).map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
        }
        else {
            category = 'General';
        }
        if (!title) {
            await message.reply("❌ **Lỗi:** Tiêu đề video không được bỏ trống!").catch(() => { });
            return;
        }
        // === LUONG 1: THÊM VIDEO QUA ĐƯỜNG LINK (YOUTUBE HOẶC LIÊN KẾT NGOÀI) ===
        if (inputUrl) {
            const isYt = videoType === 'youtube';
            const linkTypeName = isYt ? 'YouTube' : 'liên kết ngoài';
            const processingMsg = await message.reply(`⏳ **Đang lưu video ${linkTypeName} vào Database...**`).catch(() => null);
            try {
                const dbVideo = await (0, database_1.addWarmupVideo)({
                    title,
                    description,
                    category,
                    messageId: "",
                    videoUrl: inputUrl,
                    videoType: videoType,
                    fileName: "",
                    fileSize: 0,
                    addedBy: message.author.id
                });
                exports.globalWarmupCache.unshift({
                    id: dbVideo.id || "",
                    title: dbVideo.title,
                    description: dbVideo.description || "",
                    category: dbVideo.category,
                    videoUrl: inputUrl,
                    videoType: videoType,
                    addedBy: dbVideo.addedBy || "",
                    fileName: ""
                });
                const catEmoji = getCategoryEmoji(category);
                let embedThumbnail = '';
                if (isYt) {
                    const ytId = getYouTubeId(inputUrl);
                    if (ytId) {
                        embedThumbnail = `\n🎞️ Thumbnail: https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
                    }
                }
                await processingMsg?.edit(`✅ **Thêm video thành công!**\n` +
                    `🎬 Tiêu đề: **${title}**\n` +
                    `🆔 ID Database: \`${dbVideo.id}\` *(Dùng để xóa khi cần)*\n` +
                    `📺 Link: ${inputUrl}\n` +
                    `📂 Thể loại: ${catEmoji} **${category}**\n` +
                    `📝 Mô tả: ${description || '*(Không có)*'}\n` +
                    `👤 Đăng bởi: <@${message.author.id}>` +
                    embedThumbnail).catch(() => { });
            }
            catch (error) {
                console.error(`Lỗi khi thêm video ${linkTypeName}:`, error);
                await processingMsg?.edit(`❌ Lỗi khi lưu video: ${error.message || error}`).catch(() => { });
            }
            return;
        }
        // === LUONG 2: THÊM VIDEO FILE ĐÍNH KÈM ===
        const isVideo = attachment.contentType?.startsWith('video/') ||
            /\.(mp4|webm|mov|mkv|avi|flv|m4v)$/i.test(attachment.name || '');
        if (!isVideo) {
            await message.reply("❌ **File không hợp lệ!** Chỉ chấp nhận file video (MP4, WebM, MOV, v.v.).").catch(() => { });
            return;
        }
        if (!config_1.WARMUP_CHANNEL_ID) {
            await message.reply("❌ **Cấu hình lỗi:** Bot chưa được thiết lập `WARMUP_CHANNEL_ID` trong cấu hình!").catch(() => { });
            return;
        }
        const sizeMB = (attachment.size / (1024 * 1024)).toFixed(2);
        const processingMsg = await message.reply(`⏳ **Đang tải video lên Discord CDN và cập nhật Database...**\n📁 File: \`${attachment.name}\` (${sizeMB} MB) — Vui lòng đợi!`).catch(() => null);
        try {
            const storageChannel = await client.channels.fetch(config_1.WARMUP_CHANNEL_ID).catch(() => null);
            if (!storageChannel) {
                await processingMsg?.edit("❌ Không thể kết nối tới kênh lưu trữ ẩn của bot!").catch(() => { });
                return;
            }
            const sentMsg = await storageChannel.send({
                content: `🎥 **Video:** ${title}\n📂 **Thể loại:** ${category}\n📝 **Mô tả:** ${description || 'Không có'}\n👤 **Đăng bởi:** <@${message.author.id}>`,
                files: [attachment.url]
            }).catch((err) => { console.error("Lỗi gửi file tới kênh lưu trữ ẩn:", err); return null; });
            if (!sentMsg) {
                await processingMsg?.edit("❌ Gửi tệp lên kênh ẩn thất bại! File có thể quá lớn hoặc bot thiếu quyền.").catch(() => { });
                return;
            }
            const freshUrl = sentMsg.attachments.first()?.url || attachment.url;
            const freshFileName = sentMsg.attachments.first()?.name || attachment.name || 'video.mp4';
            const dbVideo = await (0, database_1.addWarmupVideo)({
                title, description, category,
                messageId: sentMsg.id,
                videoType: 'discord',
                fileName: attachment.name || 'video.mp4',
                fileSize: attachment.size || 0,
                addedBy: message.author.id
            });
            exports.globalWarmupCache.unshift({
                id: dbVideo.id || "",
                title: dbVideo.title,
                description: dbVideo.description || "",
                category: dbVideo.category,
                videoUrl: freshUrl,
                videoType: 'discord',
                addedBy: dbVideo.addedBy || "",
                fileName: freshFileName,
                messageId: dbVideo.messageId
            });
            const catEmoji = getCategoryEmoji(category);
            await processingMsg?.edit(`✅ **Thêm video thành công!**\n` +
                `🎬 Tiêu đề: **${title}**\n` +
                `🆔 ID Database: \`${dbVideo.id}\` *(Dùng ID này để xóa khi cần)*\n` +
                `🎥 Video: **${title}**\n` +
                `📂 Thể loại: ${catEmoji} **${category}**\n` +
                `📝 Mô tả: ${description || '*(Không có)*'}\n` +
                `👤 Đăng bởi: <@${message.author.id}>`).catch(() => { });
        }
        catch (error) {
            console.error("Lỗi khi thêm video warmup:", error);
            await processingMsg?.edit(`❌ Đã xảy ra lỗi khi thêm video: ${error.message || error}`).catch(() => { });
        }
        return;
    }
    // 2. DELETE VIDEO
    if (subCommand === 'delete' || subCommand === 'remove' || subCommand === 'xoa') {
        if (!isAdmin) {
            await message.reply("❌ **ĐÉO CÓ QUYỀN!** Quyền xóa video warmup chỉ dành cho Admin thôi cưng!").catch(() => { });
            return;
        }
        const targetId = rawInput.replace(/^(warmup|video)\s+(delete|remove|xoa)\s*/i, '').trim();
        if (!targetId) {
            await message.reply("❌ **Thiếu ID!** Cú pháp: `@BotToan warmup delete <ID_Database hoặc Message_ID>`").catch(() => { });
            return;
        }
        const dbVideos = await (0, database_1.getWarmupVideos)();
        // Hỗ trợ tìm kiếm theo cả ID Database và Message ID để xóa!
        const video = dbVideos.find(v => v.id === targetId || v.messageId === targetId);
        if (!video) {
            await message.reply("❌ Không tìm thấy video nào có ID Database hoặc Message ID này trong Database!").catch(() => { });
            return;
        }
        const processingMsg = await message.reply(`⏳ Đang xóa video **${video.title}**...`).catch(() => null);
        try {
            const actualDbId = video.id || targetId;
            const success = await (0, database_1.deleteWarmupVideo)(actualDbId);
            if (success) {
                if (video.messageId && config_1.WARMUP_CHANNEL_ID) {
                    const storageChannel = await client.channels.fetch(config_1.WARMUP_CHANNEL_ID).catch(() => null);
                    if (storageChannel) {
                        const msgToDelete = await storageChannel.messages.fetch(video.messageId).catch(() => null);
                        if (msgToDelete)
                            await msgToDelete.delete().catch(() => { });
                    }
                }
                exports.globalWarmupCache = exports.globalWarmupCache.filter(v => v.id !== actualDbId);
                await processingMsg?.edit(`✅ Đã xóa video **${video.title}** khỏi hệ thống thành công!`).catch(() => { });
            }
            else {
                await processingMsg?.edit("❌ Lỗi khi thực hiện xóa bản ghi trong cơ sở dữ liệu.").catch(() => { });
            }
        }
        catch (error) {
            console.error("Lỗi khi xóa video:", error);
            await processingMsg?.edit(`❌ Gặp lỗi khi xóa video: ${error.message || error}`).catch(() => { });
        }
        return;
    }
    // 2.5 EDIT/MOVE VIDEO
    if (subCommand === 'edit' || subCommand === 'move' || subCommand === 'sua' || subCommand === 'move_folder') {
        if (!isAdmin) {
            await message.reply("❌ **ĐÉO CÓ QUYỀN!** Quyền chỉnh sửa/di chuyển video warmup chỉ dành cho Admin thôi cưng! 😤").catch(() => { });
            return;
        }
        const rest = rawInput.replace(/^(warmup|video)\s+(edit|move|sua|move_folder)\s*/i, '').trim();
        if (!rest) {
            await message.reply("❌ **Sai cú pháp!** Hãy gõ theo mẫu:\n" +
                "`@BotToan warmup edit [ID] | [Tiêu đề mới] | [Mô tả mới] | [Thể loại mới]`\n" +
                "*(Để trống phần nào nếu muốn giữ nguyên, ví dụ: `@BotToan warmup edit <ID> | | | Meme` để chuyển thể loại sang Meme)*").catch(() => { });
            return;
        }
        const parts = rest.split('|');
        const targetId = parts[0] ? parts[0].trim() : '';
        if (!targetId) {
            await message.reply("❌ **Lỗi:** Vui lòng cung cấp ID video cần chỉnh sửa!").catch(() => { });
            return;
        }
        const dbVideos = await (0, database_1.getWarmupVideos)();
        const video = dbVideos.find(v => v.id === targetId || v.messageId === targetId);
        if (!video) {
            await message.reply("❌ Không tìm thấy video nào có ID Database hoặc Message ID này trong Database!").catch(() => { });
            return;
        }
        const newTitle = parts[1] ? parts[1].trim() : '';
        const newDescription = parts[2] ? parts[2].trim() : '';
        let newCategory = parts[3] ? parts[3].trim() : '';
        const updateData = {};
        if (newTitle)
            updateData.title = newTitle;
        if (newDescription)
            updateData.description = newDescription;
        if (newCategory) {
            // Chuẩn hóa category
            const validCategories = Object.keys(exports.CATEGORY_EMOJIS);
            const matchedCat = validCategories.find(c => c.toLowerCase() === newCategory.toLowerCase());
            if (matchedCat) {
                newCategory = matchedCat;
            }
            else {
                newCategory = newCategory.split(/\s+/).map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
            }
            updateData.category = newCategory;
        }
        if (Object.keys(updateData).length === 0) {
            await message.reply("⚠️ Bạn chưa nhập thông tin nào mới để chỉnh sửa cả!").catch(() => { });
            return;
        }
        const processingMsg = await message.reply(`⏳ Đang cập nhật thông tin video **${video.title}**...`).catch(() => null);
        try {
            const actualDbId = video.id || targetId;
            const updatedVideo = await (0, database_1.updateWarmupVideo)(actualDbId, updateData);
            if (updatedVideo) {
                // Cập nhật lại RAM Cache
                const cacheIdx = exports.globalWarmupCache.findIndex(v => v.id === actualDbId);
                if (cacheIdx !== -1) {
                    exports.globalWarmupCache[cacheIdx] = {
                        ...exports.globalWarmupCache[cacheIdx],
                        ...updateData
                    };
                }
                // Cập nhật lại thông tin hiển thị trên Discord tin nhắn lưu trữ nếu có
                if (video.messageId && config_1.WARMUP_CHANNEL_ID) {
                    const storageChannel = await client.channels.fetch(config_1.WARMUP_CHANNEL_ID).catch(() => null);
                    if (storageChannel) {
                        const msgToEdit = await storageChannel.messages.fetch(video.messageId).catch(() => null);
                        if (msgToEdit) {
                            const displayTitle = updatedVideo.title;
                            const displayCategory = updatedVideo.category;
                            const displayDesc = updatedVideo.description || 'Không có';
                            await msgToEdit.edit({
                                content: `🎥 **Video:** ${displayTitle}\n📂 **Thể loại:** ${displayCategory}\n📝 **Mô tả:** ${displayDesc}\n👤 **Đăng bởi:** <@${updatedVideo.addedBy || ''}>`
                            }).catch(() => { });
                        }
                    }
                }
                const oldCat = video.category;
                const newCat = updatedVideo.category;
                const isMoved = oldCat !== newCat;
                let successMessage = `✅ **Cập nhật thông tin video thành công!**\n` +
                    `🆔 ID: \`${actualDbId}\`\n` +
                    `🎬 Tiêu đề: **${updatedVideo.title}**\n` +
                    `📂 Thể loại: **${updatedVideo.category}**\n` +
                    `📝 Mô tả: ${updatedVideo.description || '*(Không có)*'}`;
                if (isMoved) {
                    successMessage += `\n📦 *Đã di chuyển video từ thể loại \`${oldCat}\` sang \`${newCat}\`*`;
                }
                await processingMsg?.edit(successMessage).catch(() => { });
            }
            else {
                await processingMsg?.edit("❌ Lỗi khi thực hiện cập nhật bản ghi trong cơ sở dữ liệu.").catch(() => { });
            }
        }
        catch (error) {
            console.error("Lỗi khi chỉnh sửa video:", error);
            await processingMsg?.edit(`❌ Gặp lỗi khi chỉnh sửa video: ${error.message || error}`).catch(() => { });
        }
        return;
    }
    // 3. LIST VIDEOS
    if (subCommand === 'list' || subCommand === 'danhsach' || subCommand === 'ds') {
        const dbVideos = await (0, database_1.getWarmupVideos)();
        if (dbVideos.length === 0) {
            await message.reply("📂 **Kho video hiện tại đang trống rỗng!**").catch(() => { });
            return;
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(`📂 DANH SÁCH VIDEO WARMUP (${dbVideos.length} video)`)
            .setColor(0x8E44AD)
            .setFooter({ text: "Dùng ID để xóa: @BotToan warmup delete <ID>", iconURL: client.user?.displayAvatarURL() })
            .setTimestamp();
        let desc = '';
        for (let i = 0; i < dbVideos.length; i++) {
            const v = dbVideos[i];
            const sizeMB = v.fileSize ? (v.fileSize / (1024 * 1024)).toFixed(1) : "?.?";
            const emoji = getCategoryEmoji(v.category);
            const line = `**${i + 1}.** ${emoji} **${v.title}**\n   ID: \`${v.id}\` • ${v.category} • ${sizeMB}MB\n`;
            if (desc.length + line.length < 3800) {
                desc += line;
            }
            else {
                desc += `\n*...và ${dbVideos.length - i} video khác không hiển thị được*`;
                break;
            }
        }
        embed.setDescription(desc || '*Không có video*');
        await message.reply({ embeds: [embed] }).catch(() => { });
        return;
    }
    // 4. RELOAD CACHE
    if (subCommand === 'reload' || subCommand === 'refresh') {
        if (!isAdmin) {
            await message.reply("❌ Lệnh này chỉ dành cho Admin!").catch(() => { });
            return;
        }
        const processingMsg = await message.reply("🔄 Đang quét kênh Discord và nạp lại RAM Cache...").catch(() => null);
        await loadWarmupVideosCache(client);
        await processingMsg?.edit(`✅ Đã làm mới RAM Cache thành công! Hiện có **${exports.globalWarmupCache.length}** video trong bộ nhớ.`).catch(() => { });
        return;
    }
    // 5. HIỂN THỊ SELECT MENU ĐỂ XEM VIDEO (2 THANH CHỌN + TÌM KIẾM)
    const defaultCategories = ['Gaming', 'Meme', 'Music', 'Tiktok', 'Dance', 'General'];
    // Hàm chuẩn hóa thể loại
    const normalizeCategoryName = (cat) => {
        const trimmed = cat.trim();
        const matched = defaultCategories.find(c => c.toLowerCase() === trimmed.toLowerCase());
        if (matched)
            return matched;
        // Viết hoa chữ cái đầu mỗi từ
        return trimmed.split(/\s+/).map(word => {
            if (!word)
                return '';
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }).join(' ');
    };
    // Tạo danh sách độc nhất (case-insensitive) của tất cả các thể loại trong cache
    const uniqueCacheCategoriesMap = new Map(); // lowercase -> normalized
    for (const v of exports.globalWarmupCache) {
        if (v.category) {
            const norm = normalizeCategoryName(v.category);
            uniqueCacheCategoriesMap.set(norm.toLowerCase(), norm);
        }
    }
    const categoriesInCache = Array.from(uniqueCacheCategoriesMap.values());
    const allCategories = Array.from(new Set([
        ...defaultCategories,
        ...categoriesInCache
    ]));
    let filteredCache = exports.globalWarmupCache;
    let filterLabel = '';
    let selectedCategoryValue = 'all';
    const searchQuery = args.slice(1).join(' ').trim().toLowerCase();
    if (searchQuery) {
        // Kiểm tra xem từ khóa gõ vào có trùng khớp với thể loại nào không (lọc theo thể loại nhanh)
        const matchedCat = allCategories.find(c => c.toLowerCase() === searchQuery);
        if (matchedCat) {
            filteredCache = exports.globalWarmupCache.filter(v => v.category.toLowerCase() === matchedCat.toLowerCase());
            filterLabel = ` — Thể loại: ${getCategoryEmoji(matchedCat)} ${matchedCat}`;
            selectedCategoryValue = matchedCat.toLowerCase();
        }
        else {
            // Tìm kiếm tự do theo từ khóa
            filteredCache = exports.globalWarmupCache.filter(v => v.title.toLowerCase().includes(searchQuery) ||
                v.description.toLowerCase().includes(searchQuery) ||
                v.category.toLowerCase().includes(searchQuery));
            filterLabel = ` — Tìm kiếm: "${searchQuery}"`;
        }
    }
    if (exports.globalWarmupCache.length === 0) {
        await message.reply("📂 **Kho video warmup hiện tại đang trống!** Admin vui lòng dùng lệnh `@BotToan warmup add` để thêm video trước nhé!").catch(() => { });
        return;
    }
    if (filteredCache.length === 0) {
        await message.reply(`📂 **Không tìm thấy video nào khớp với từ khóa/thể loại: "${searchQuery}"**\n👉 Thử gõ \`@BotToan warmup\` để xem tất cả.`).catch(() => { });
        return;
    }
    // Lọc danh sách thể loại có chứa video thực tế trong cache
    const activeCategories = allCategories.filter(cat => exports.globalWarmupCache.some(v => v.category.toLowerCase() === cat.toLowerCase()));
    // --- Xây dựng Thanh 1: Danh sách Thể loại (Giới hạn tối đa 25 options của Discord Select Menu) ---
    // Tìm thể loại hiện tại đang được chọn (nếu có) để ưu tiên giữ lại trong menu hiển thị
    const targetCategory = activeCategories.find(c => c.toLowerCase() === selectedCategoryValue);
    // Tạo danh sách tối đa 24 thể loại để chừa 1 slot cho "Tất cả thể loại" (25 tổng cộng)
    const displayedCategories = [];
    if (targetCategory) {
        displayedCategories.push(targetCategory);
    }
    for (const cat of activeCategories) {
        if (displayedCategories.length >= 24)
            break;
        if (targetCategory && cat.toLowerCase() === targetCategory.toLowerCase())
            continue;
        displayedCategories.push(cat);
    }
    const categoryOptions = [
        new discord_js_1.StringSelectMenuOptionBuilder()
            .setLabel('🌟 Tất cả thể loại')
            .setDescription('Hiển thị tất cả video hiện có')
            .setValue('all')
            .setDefault(selectedCategoryValue === 'all')
    ];
    for (const cat of displayedCategories) {
        const emoji = getCategoryEmoji(cat);
        categoryOptions.push(new discord_js_1.StringSelectMenuOptionBuilder()
            .setLabel(`${emoji} ${cat}`)
            .setDescription(`Xem các video thuộc thể loại ${cat}`)
            .setValue(cat.toLowerCase())
            .setDefault(selectedCategoryValue === cat.toLowerCase()));
    }
    const categoryMenuCustomId = 'warmup_category_' + message.id;
    const videoMenuCustomId = 'warmup_video_' + message.id;
    const prevBtnId = 'warmup_prev_' + message.id;
    const nextBtnId = 'warmup_next_' + message.id;
    let currentCategoryId = selectedCategoryValue;
    let currentPage = 0;
    // Helper build components dynamically supporting pagination
    const getComponents = (categoryId, page) => {
        // 1. Category Select Menu
        const newCategoryOptions = categoryOptions.map(opt => {
            const isSelected = opt.data.value === categoryId;
            return discord_js_1.StringSelectMenuOptionBuilder.from(opt).setDefault(isSelected);
        });
        const categorySelectMenu = new discord_js_1.StringSelectMenuBuilder()
            .setCustomId(categoryMenuCustomId)
            .setPlaceholder('📁 Bước 1: Chọn thể loại video muốn xem...')
            .addOptions(newCategoryOptions);
        const rowCat = new discord_js_1.ActionRowBuilder().addComponents(categorySelectMenu);
        // 2. Video Select Menu (sliced to page)
        let categoryVideos = exports.globalWarmupCache;
        if (categoryId !== 'all') {
            categoryVideos = exports.globalWarmupCache.filter(v => v.category.toLowerCase() === categoryId.toLowerCase());
        }
        const totalVideos = categoryVideos.length;
        const totalPages = Math.ceil(totalVideos / 25);
        const startIdx = page * 25;
        const pageVideos = categoryVideos.slice(startIdx, startIdx + 25);
        const newVideoOptions = pageVideos.map(video => {
            const emoji = getCategoryEmoji(video.category);
            const safeTitle = `${emoji} ${video.title}`.slice(0, 95);
            const safeDesc = `${video.description || 'Khởi động giải trí trước trận cùng BotToan!'}`.slice(0, 95);
            return new discord_js_1.StringSelectMenuOptionBuilder()
                .setLabel(safeTitle)
                .setDescription(safeDesc)
                .setValue(video.id);
        });
        const placeholderText = newVideoOptions.length > 0
            ? `🎬 Bước 2: Chọn video${totalPages > 1 ? ` (Trang ${page + 1}/${totalPages})` : ''}...`
            : '❌ Không có video trong thể loại này';
        const videoSelectMenu = new discord_js_1.StringSelectMenuBuilder()
            .setCustomId(videoMenuCustomId)
            .setPlaceholder(placeholderText)
            .addOptions(newVideoOptions.length > 0 ? newVideoOptions : [
            new discord_js_1.StringSelectMenuOptionBuilder().setLabel('Không có video').setValue('none')
        ])
            .setDisabled(newVideoOptions.length === 0);
        const rowVid = new discord_js_1.ActionRowBuilder().addComponents(videoSelectMenu);
        const rows = [rowCat, rowVid];
        // 3. Pagination row
        if (totalPages > 1) {
            const prevButton = new discord_js_1.ButtonBuilder()
                .setCustomId(prevBtnId)
                .setLabel('⬅️ Trang trước')
                .setStyle(discord_js_1.ButtonStyle.Primary)
                .setDisabled(page === 0);
            const pageIndicator = new discord_js_1.ButtonBuilder()
                .setCustomId('warmup_page_indicator')
                .setLabel(`Trang ${page + 1}/${totalPages}`)
                .setStyle(discord_js_1.ButtonStyle.Secondary)
                .setDisabled(true);
            const nextButton = new discord_js_1.ButtonBuilder()
                .setCustomId(nextBtnId)
                .setLabel('Trang sau ➡️')
                .setStyle(discord_js_1.ButtonStyle.Primary)
                .setDisabled(page >= totalPages - 1);
            const rowPag = new discord_js_1.ActionRowBuilder().addComponents(prevButton, pageIndicator, nextButton);
            rows.push(rowPag);
        }
        return rows;
    };
    let currentRows = getComponents(currentCategoryId, currentPage);
    // Xây dựng embed mô tả ban đầu
    let initVideos = exports.globalWarmupCache;
    if (currentCategoryId !== 'all') {
        initVideos = exports.globalWarmupCache.filter(v => v.category.toLowerCase() === currentCategoryId.toLowerCase());
    }
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle(`🎬 KHO VIDEO GIẢI TRÍ BOTTOAN${filterLabel}`)
        .setDescription(`Chào mừng bạn đến với rạp chiếu phim mini của **BotToan**! 🍿\n\n` +
        `🔍 **Tìm nhanh:** Bạn có thể gõ \`@BotToan warmup [từ khóa]\` để lọc video siêu tốc.\n\n` +
        `📊 Hiện có: **${initVideos.length} video** thuộc lựa chọn hiện tại.\n\n` +
        `👇 **Lựa chọn theo các bước bên dưới:** Chọn Thể loại trước rồi chọn Video muốn xem nhé!`)
        .setColor(0x8E44AD)
        .setFooter({ text: "Hệ thống phát video độc lập • BotToan Warmup", iconURL: client.user?.displayAvatarURL() })
        .setTimestamp();
    const menuMsg = await message.reply({
        embeds: [embed],
        components: currentRows
    }).catch(() => null);
    if (!menuMsg)
        return;
    const collector = menuMsg.createMessageComponentCollector({
        filter: (i) => i.customId === categoryMenuCustomId ||
            i.customId === videoMenuCustomId ||
            i.customId === prevBtnId ||
            i.customId === nextBtnId,
        time: 300000 // 5 phút
    });
    collector.on('collect', async (interaction) => {
        if (interaction.customId === categoryMenuCustomId) {
            currentCategoryId = interaction.values[0];
            currentPage = 0; // Reset trang khi đổi thể loại
            const updatedRows = getComponents(currentCategoryId, currentPage);
            currentRows = updatedRows;
            const embedTitle = currentCategoryId === 'all' ? 'TẤT CẢ THỂ LOẠI' : currentCategoryId.toUpperCase();
            let categoryVideos = exports.globalWarmupCache;
            if (currentCategoryId !== 'all') {
                categoryVideos = exports.globalWarmupCache.filter(v => v.category.toLowerCase() === currentCategoryId.toLowerCase());
            }
            const updatedSearchEmbed = discord_js_1.EmbedBuilder.from(embed)
                .setTitle(`🎬 KHO VIDEO GIẢI TRÍ BOTTOAN — ${embedTitle}`)
                .setDescription(`Chào mừng bạn đến với rạp chiếu phim mini của **BotToan**! 🍿\n\n` +
                `📊 Đang hiển thị các video của thể loại: **${embedTitle}** (${categoryVideos.length} video)\n\n` +
                `👇 **Hãy chọn video từ menu bên dưới** để bắt đầu thưởng thức!`);
            await interaction.update({
                embeds: [updatedSearchEmbed],
                components: currentRows
            }).catch(() => { });
        }
        else if (interaction.customId === prevBtnId) {
            if (currentPage > 0) {
                currentPage--;
                currentRows = getComponents(currentCategoryId, currentPage);
                await interaction.update({
                    components: currentRows
                }).catch(() => { });
            }
        }
        else if (interaction.customId === nextBtnId) {
            let categoryVideos = exports.globalWarmupCache;
            if (currentCategoryId !== 'all') {
                categoryVideos = exports.globalWarmupCache.filter(v => v.category.toLowerCase() === currentCategoryId.toLowerCase());
            }
            const totalPages = Math.ceil(categoryVideos.length / 25);
            if (currentPage < totalPages - 1) {
                currentPage++;
                currentRows = getComponents(currentCategoryId, currentPage);
                await interaction.update({
                    components: currentRows
                }).catch(() => { });
            }
        }
        else if (interaction.customId === videoMenuCustomId) {
            const selectedId = interaction.values[0];
            if (selectedId === 'none') {
                await interaction.reply({ content: "❌ Không có video nào để phát!", ephemeral: true }).catch(() => { });
                return;
            }
            const video = exports.globalWarmupCache.find(v => v.id === selectedId);
            if (!video) {
                await interaction.reply({ content: "❌ Không tìm thấy video! Thử `@BotToan warmup reload` để làm mới.", ephemeral: true }).catch(() => { });
                return;
            }
            await sendVideoToUser(interaction, video, client, currentRows);
        }
    });
    collector.on('end', async () => {
        try {
            const disabledRows = getComponents(currentCategoryId, currentPage).map((row) => {
                const newRow = new discord_js_1.ActionRowBuilder();
                row.components.forEach((comp) => {
                    if (comp instanceof discord_js_1.StringSelectMenuBuilder) {
                        newRow.addComponents(discord_js_1.StringSelectMenuBuilder.from(comp).setDisabled(true));
                    }
                    else if (comp instanceof discord_js_1.ButtonBuilder) {
                        newRow.addComponents(discord_js_1.ButtonBuilder.from(comp).setDisabled(true));
                    }
                });
                return newRow;
            });
            await menuMsg.edit({
                components: disabledRows
            }).catch(() => { });
        }
        catch { }
    });
}
/**
 * Phát video tiếp theo/trước đó/ngẫu nhiên từ các nút điều hướng trên tin nhắn video
 */
async function playVideoFromNavigation(interaction, video, client) {
    const channelId = interaction.channelId;
    // Phản hồi ngay lập tức để tránh quá hạn Discord interaction
    try {
        await interaction.deferUpdate().catch(() => { });
    }
    catch { }
    // Xóa tin nhắn video cũ ngay lập tức để tránh rác kênh chat
    try {
        await interaction.message.delete().catch(() => { });
    }
    catch { }
    // Lazy load URL của video Discord nếu cần thiết (hết hạn hoặc chưa có)
    let videoUrl = video.videoUrl;
    let fileName = video.fileName || 'video.mp4';
    if (video.videoType === 'discord' && (!videoUrl || isDiscordCdnUrlExpired(videoUrl)) && video.messageId) {
        try {
            const channel = await client.channels.fetch(config_1.WARMUP_CHANNEL_ID).catch(() => null);
            if (channel) {
                const msg = await channel.messages.fetch(video.messageId).catch(() => null);
                const attachment = msg?.attachments.first();
                if (attachment && attachment.url) {
                    videoUrl = attachment.url;
                    fileName = attachment.name || fileName;
                    video.videoUrl = attachment.url;
                    video.fileName = attachment.name || video.fileName;
                }
            }
        }
        catch (e) {
            console.error("[WARMUP NAV LAZY LOAD LỖI] Lỗi lazy load video URL:", e);
        }
    }
    if (video.videoType === 'discord' && !videoUrl) {
        try {
            await (0, database_1.deleteWarmupVideo)(video.id);
            exports.globalWarmupCache = exports.globalWarmupCache.filter(v => v.id !== video.id);
        }
        catch { }
        await interaction.channel.send({
            content: `❌ **Không thể phát video này!** File đính kèm trên Discord của video này đã bị xóa hoặc không thể truy cập.\n*Bot đã tự động dọn dẹp và xóa video này khỏi danh sách.*`,
        }).then((m) => setTimeout(() => m.delete().catch(() => { }), 5000)).catch(() => { });
        return;
    }
    // Tạo các nút điều hướng mới cho video tiếp theo
    const prevButton = new discord_js_1.ButtonBuilder()
        .setCustomId(`warmup:nav:prev:${video.id}:${video.category.toLowerCase()}`)
        .setLabel('◀️ Video trước')
        .setStyle(discord_js_1.ButtonStyle.Primary);
    const randomButton = new discord_js_1.ButtonBuilder()
        .setCustomId(`warmup:nav:random:${video.id}:${video.category.toLowerCase()}`)
        .setLabel('🎲 Ngẫu nhiên')
        .setStyle(discord_js_1.ButtonStyle.Secondary);
    const nextButton = new discord_js_1.ButtonBuilder()
        .setCustomId(`warmup:nav:next:${video.id}:${video.category.toLowerCase()}`)
        .setLabel('Video sau ▶️')
        .setStyle(discord_js_1.ButtonStyle.Primary);
    const row = new discord_js_1.ActionRowBuilder().addComponents(prevButton, randomButton, nextButton);
    try {
        let newMsg;
        if (video.videoType === 'youtube' || video.videoType === 'external') {
            newMsg = await interaction.channel.send({
                content: `🎥 **${video.title.toUpperCase()}** (${getCategoryEmoji(video.category)} \`${video.category}\`)\n${videoUrl}`,
                components: [row]
            });
        }
        else {
            const MAX_SIZE = 24 * 1024 * 1024;
            const response = await fetch(videoUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BotToan-Discord/1.0)' }
            });
            if (!response.ok)
                throw new Error(`HTTP ${response.status}`);
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            if (buffer.length > MAX_SIZE)
                throw new Error(`FILE_TOO_LARGE`);
            const attachment = new discord_js_1.AttachmentBuilder(buffer, { name: fileName });
            newMsg = await interaction.channel.send({
                content: `🎥 **${video.title.toUpperCase()}** (${getCategoryEmoji(video.category)} \`${video.category}\`)`,
                files: [attachment],
                components: [row]
            });
        }
        if (newMsg) {
            exports.activeVideoMessages.set(channelId, newMsg.id);
        }
    }
    catch (err) {
        console.warn(`[WARMUP NAV] Gặp lỗi đính kèm file, fallback gửi link CDN: ${err.message}`);
        const fallbackMsg = await interaction.channel.send({
            content: `🎥 **${video.title.toUpperCase()}** (${getCategoryEmoji(video.category)} \`${video.category}\`)\n${videoUrl}`,
            components: [row]
        }).catch(() => null);
        if (fallbackMsg) {
            exports.activeVideoMessages.set(channelId, fallbackMsg.id);
        }
    }
}
/**
 * Đăng ký bộ lắng nghe sự kiện tương tác nút bấm chuyển video (Trước/Sau/Ngẫu nhiên)
 */
function registerWarmupCollector(client) {
    client.on('interactionCreate', async (interaction) => {
        const id = interaction.customId;
        if (!id || !id.startsWith('warmup:nav:'))
            return;
        if (interaction.isButton()) {
            const parts = id.split(':');
            const action = parts[2];
            const currentVideoId = parts[3];
            const categoryId = parts.slice(4).join(':');
            let categoryVideos = exports.globalWarmupCache;
            if (categoryId !== 'all') {
                categoryVideos = exports.globalWarmupCache.filter(v => v.category.toLowerCase() === categoryId.toLowerCase());
            }
            if (categoryVideos.length === 0) {
                await interaction.reply({ content: "❌ Không có video nào trong danh sách!", ephemeral: true }).catch(() => { });
                return;
            }
            let targetVideoIdx = categoryVideos.findIndex(v => v.id === currentVideoId);
            let nextVideo;
            if (action === 'next') {
                if (targetVideoIdx === -1 || targetVideoIdx === categoryVideos.length - 1) {
                    nextVideo = categoryVideos[0];
                }
                else {
                    nextVideo = categoryVideos[targetVideoIdx + 1];
                }
            }
            else if (action === 'prev') {
                if (targetVideoIdx === -1 || targetVideoIdx === 0) {
                    nextVideo = categoryVideos[categoryVideos.length - 1];
                }
                else {
                    nextVideo = categoryVideos[targetVideoIdx - 1];
                }
            }
            else if (action === 'random') {
                if (categoryVideos.length <= 1) {
                    nextVideo = categoryVideos[0];
                }
                else {
                    let randIdx;
                    do {
                        randIdx = Math.floor(Math.random() * categoryVideos.length);
                    } while (categoryVideos[randIdx].id === currentVideoId);
                    nextVideo = categoryVideos[randIdx];
                }
            }
            if (nextVideo) {
                await playVideoFromNavigation(interaction, nextVideo, client);
            }
        }
    });
}
