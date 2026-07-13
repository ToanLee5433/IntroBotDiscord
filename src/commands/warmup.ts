import { 
    Message, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder, TextChannel, Client, PermissionFlagsBits,
    AttachmentBuilder
} from 'discord.js';
import { addWarmupVideo, getWarmupVideos, deleteWarmupVideo } from '../database';
import { WARMUP_CHANNEL_ID } from '../config';

// Bản đồ Emoji tương ứng với từng thể loại video
export const CATEGORY_EMOJIS: Record<string, string> = {
    'Gaming': '🎮',
    'Meme': '😂',
    'Music': '🎶',
    'Tiktok': '📱',
    'Dance': '💃',
    'General': '🎬'
};

export interface ICachedWarmupVideo {
    id: string;
    title: string;
    description: string;
    category: string;
    videoUrl: string;
    videoType: string;  // 'discord' | 'youtube' | 'external'
    addedBy: string;
    fileName?: string;
    messageId?: string; // Lưu messageId để lazy load khi phát
}

// RAM Cache lưu trữ tạm thời các video để truy cập cực nhanh
export let globalWarmupCache: ICachedWarmupVideo[] = [];

// Quản lý tin nhắn video đang phát trên từng kênh chat để tự động xóa tin nhắn cũ
export const activeVideoMessages = new Map<string, string>(); // channelId -> messageId

function getCategoryEmoji(category: string): string {
    return (CATEGORY_EMOJIS as any)[category] || '🎬';
}

/** Kiểm tra URL có phải YouTube không */
function isYouTubeUrl(url: string): boolean {
    return /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)/i.test(url);
}

/** Lấy video ID từ YouTube URL (dùng để tạo thumbnail) */
function getYouTubeId(url: string): string | null {
    const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([\w-]{11})/);
    return m ? m[1] : null;
}

export async function loadWarmupVideosCache(client: Client): Promise<void> {
    try {
        if (!WARMUP_CHANNEL_ID) {
            console.warn("[WARMUP] WARMUP_CHANNEL_ID chưa được cấu hình trong .env.");
            return;
        }
        const channel = await client.channels.fetch(WARMUP_CHANNEL_ID).catch(() => null);
        if (!channel || !channel.isTextBased()) {
            console.error(`[WARMUP LỖI] Không tìm thấy kênh lưu trữ video với ID: ${WARMUP_CHANNEL_ID}`);
            return;
        }
        const dbVideos = await getWarmupVideos();
        if (dbVideos.length === 0) {
            globalWarmupCache = [];
            console.log("[WARMUP] Không có dữ liệu video nào trong cơ sở dữ liệu.");
            return;
        }
        const textChannel = channel as TextChannel;
        let allMessages: any[] = [];
        let lastId: string | undefined = undefined;
        let fetchCount = 0;
        const maxFetches = 3; // Chỉ quét 300 tin nhắn gần nhất lúc khởi động để tránh rate limit và khởi động siêu tốc

        while (fetchCount < maxFetches) {
            const options: any = { limit: 100 };
            if (lastId) options.before = lastId;
            const fetched: any = await textChannel.messages.fetch(options).catch(() => null);
            if (!fetched || fetched.size === 0) break;
            allMessages = allMessages.concat(Array.from(fetched.values()));
            lastId = fetched.last()?.id;
            fetchCount++;
            if (fetched.size < 100) break;
        }

        const messageMap = new Map<string, { url: string; fileName: string }>();
        for (const msg of allMessages) {
            const attachment = msg.attachments.first();
            if (attachment && attachment.url) {
                messageMap.set(msg.id, { url: attachment.url, fileName: attachment.name || 'video.mp4' });
            }
        }

        const newCache: ICachedWarmupVideo[] = [];
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
        globalWarmupCache = newCache;
        console.log(`[WARMUP] Đã nạp thành công ${globalWarmupCache.length}/${dbVideos.length} video warmup vào RAM Cache.`);
    } catch (error) {
        console.error("[WARMUP CACHE LỖI] Lỗi nghiêm trọng khi nạp cache video:", error);
    }
}

async function sendVideoToUser(
    interaction: any,
    video: ICachedWarmupVideo,
    client: Client,
    rows: ActionRowBuilder<StringSelectMenuBuilder>[]
): Promise<void> {
    const emoji = getCategoryEmoji(video.category);
    const updatedEmbed = new EmbedBuilder()
        .setTitle(`🎬 ĐANG XEM: ${video.title.toUpperCase()}`)
        .setDescription(video.description || "Khởi động giải trí cùng BotToan!")
        .addFields(
            { name: "📂 Thể loại", value: `${emoji} \`${video.category}\``, inline: true },
            { name: "👤 Đóng góp bởi", value: video.addedBy ? `<@${video.addedBy}>` : "Ẩn danh", inline: true }
        )
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
    } catch {
        return;
    }

    // Cập nhật embed hiển thị thông tin bài đang phát lên tin nhắn gốc chứa menu
    await interaction.editReply({
        content: `⏳ Đang phát video **${video.title}** ở tin nhắn mới phía dưới...`,
        embeds: [updatedEmbed],
        components: rows,
        files: []
    }).catch(() => {});

    // Lazy load URL của video Discord nếu chưa có URL hoặc link cũ bị hết hạn CDN
    let videoUrl = video.videoUrl;
    let fileName = video.fileName || 'video.mp4';

    if (video.videoType === 'discord' && !videoUrl && video.messageId) {
        try {
            const channel = await client.channels.fetch(WARMUP_CHANNEL_ID).catch(() => null) as TextChannel;
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
        } catch (e) {
            console.error("[WARMUP LAZY LOAD LỖI] Lỗi lazy load video URL:", e);
        }
    }

    // Nếu vẫn không tìm thấy videoUrl (file đã bị xóa hẳn khỏi Discord)
    if (video.videoType === 'discord' && !videoUrl) {
        await interaction.editReply({
            content: `❌ **Không thể phát video này!** File đính kèm trên Discord của video này đã bị xóa hoặc không thể truy cập.`,
            embeds: [],
            components: []
        }).catch(() => {});
        return;
    }

    // Bước 2: Quản lý tin nhắn phát video để tránh spam (xóa tin cũ trong kênh)
    const channelId = interaction.channelId;
    const oldMsgId = activeVideoMessages.get(channelId);
    if (oldMsgId) {
        try {
            const channel = await client.channels.fetch(channelId).catch(() => null) as TextChannel;
            if (channel) {
                const oldMsg = await channel.messages.fetch(oldMsgId).catch(() => null);
                if (oldMsg) await oldMsg.delete().catch(() => {});
            }
        } catch {}
    }

    // Bước 3: Gửi tin nhắn mới chứa video/YouTube URL để Discord tự render video player tuyệt đối chính xác
    try {
        let newMsg;
        if (video.videoType === 'youtube' || video.videoType === 'external') {
            newMsg = await interaction.channel.send({
                content: videoUrl
            });
        } else {
            const MAX_SIZE = 24 * 1024 * 1024;
            const response = await fetch(videoUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BotToan-Discord/1.0)' }
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            if (buffer.length > MAX_SIZE) throw new Error(`FILE_TOO_LARGE`);

            const attachment = new AttachmentBuilder(buffer, { name: fileName });

            newMsg = await interaction.channel.send({
                files: [attachment]
            });
        }

        if (newMsg) {
            activeVideoMessages.set(channelId, newMsg.id);
        }

        // Xóa thông báo "đang phát" khỏi tin nhắn menu để giữ giao diện sạch đẹp
        await interaction.editReply({
            content: '',
            embeds: [updatedEmbed],
            components: rows
        }).catch(() => {});
    } catch (err: any) {
        console.warn(`[WARMUP] Gặp lỗi đính kèm file, fallback gửi link CDN: ${err.message}`);
        // Fallback gửi link CDN thô
        const fallbackMsg = await interaction.channel.send({
            content: videoUrl
        }).catch(() => null);

        if (fallbackMsg) {
            activeVideoMessages.set(channelId, fallbackMsg.id);
        }

        await interaction.editReply({
            content: '',
            embeds: [updatedEmbed],
            components: rows
        }).catch(() => {});
    }
}

export async function handleWarmupCommand(message: Message, rawInput: string, client: Client) {
    const args = rawInput.trim().split(/\s+/);
    const subCommand = args[1] ? args[1].toLowerCase() : '';
    const isAdmin = message.member?.permissions.has(PermissionFlagsBits.Administrator);

    // 1. ADD VIDEO
    if (subCommand === 'add') {
        if (!isAdmin) {
            await message.reply("❌ **ĐÉO CÓ QUYỀN!** Lệnh thêm video warmup chỉ dành cho Admin đẹp trai/xinh gái thôi nhé! 😤").catch(() => {});
            return;
        }
        const rest = rawInput.replace(/^(warmup|video)\s+add\s*/i, '').trim();
        if (!rest) {
            await message.reply(
                "❌ **Sai cú pháp!** Hãy gõ theo mẫu:\n" +
                "`@BotToan warmup add Tiêu đề | Mô tả | Thể loại`\n" +
                "*(Kèm file video đính kèm HOAC thêm link YouTube vào Mô tả)*\n" +
                "*(Thể loại: Gaming / Meme / Music / Tiktok / Dance / General hoặc tự nhập)*"
            ).catch(() => {});
            return;
        }

        const parts = rest.split('|');
        const title = parts[0] ? parts[0].trim() : '';
        const description = parts[1] ? parts[1].trim() : '';
        let category = parts[2] ? parts[2].trim() : 'General';

        // Kiểm tra xem có YouTube URL trong phần còn lại không
        // Ưu tiên: tìm URL trong part[3], sau đó tìm trong toàn bộ nội dung
        let youtubeUrl: string | null = null;
        const urlSearchText = parts.slice(3).join('|').trim() || rest;
        const urlMatch = urlSearchText.match(/(https?:\/\/[^\s|]+)/i);
        if (urlMatch && isYouTubeUrl(urlMatch[1])) {
            youtubeUrl = urlMatch[1].trim();
        }

        // Nếu không có YouTube URL và không có file đính kèm thì báo lỗi
        const attachment = message.attachments.first();
        if (!youtubeUrl && !attachment) {
            await message.reply(
                "❌ **Thiếu nội dung video!** Bạn cần một trong hai:\n" +
                "📎 Upload file video (MP4/WebM) kèm theo tin nhắn\n" +
                "📺 Hoặc thêm link YouTube vào cuối lệnh:\n" +
                "`@BotToan warmup add Tiêu đề | Mô tả | General | https://youtube.com/watch?v=...`"
            ).catch(() => {});
            return;
        }

        // Chuẩn hóa category
        const validCategories = Object.keys(CATEGORY_EMOJIS);
        const matchedCat = validCategories.find(c => c.toLowerCase() === category.toLowerCase());
        if (matchedCat) {
            category = matchedCat;
        } else if (category) {
            category = category.split(/\s+/).map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
        } else {
            category = 'General';
        }

        if (!title) {
            await message.reply("❌ **Lỗi:** Tiêu đề video không được bỏ trống!").catch(() => {});
            return;
        }

        // === LUONG 1: THÊM VIDEO YOUTUBE ===
        if (youtubeUrl) {
            const processingMsg = await message.reply(`⏳ **Đang lưu video YouTube vào Database...**`).catch(() => null);
            try {
                const dbVideo = await addWarmupVideo({
                    title,
                    description,
                    category,
                    messageId: "",
                    videoUrl: youtubeUrl,
                    videoType: 'youtube',
                    fileName: "",
                    fileSize: 0,
                    addedBy: message.author.id
                });
                globalWarmupCache.unshift({
                    id: dbVideo.id || "",
                    title: dbVideo.title,
                    description: dbVideo.description || "",
                    category: dbVideo.category,
                    videoUrl: youtubeUrl,
                    videoType: 'youtube',
                    addedBy: dbVideo.addedBy || "",
                    fileName: ""
                });
                const catEmoji = getCategoryEmoji(category);
                const ytId = getYouTubeId(youtubeUrl);
                await processingMsg?.edit(
                    `✅ **Thêm video YouTube thành công!**\n` +
                    `🎬 Tiêu đề: **${title}**\n` +
                    `🆔 ID Database: \`${dbVideo.id}\` *(Dùng để xóa khi cần)*\n` +
                    `📺 Link: ${youtubeUrl}\n` +
                    `📂 Thể loại: ${catEmoji} **${category}**\n` +
                    `📝 Mô tả: ${description || '*(Không có)*'}\n` +
                    `👤 Đăng bởi: <@${message.author.id}>` +
                    (ytId ? `\n🎞️ Thumbnail: https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : '')
                ).catch(() => {});
            } catch (error: any) {
                console.error("Lỗi khi thêm video YouTube:", error);
                await processingMsg?.edit(`❌ Lỗi khi lưu video: ${error.message || error}`).catch(() => {});
            }
            return;
        }

        // === LUONG 2: THÊM VIDEO FILE ĐÍNH KÈM ===
        const isVideo = attachment!.contentType?.startsWith('video/') ||
            /\.(mp4|webm|mov|mkv|avi|flv|m4v)$/i.test(attachment!.name || '');
        if (!isVideo) {
            await message.reply("❌ **File không hợp lệ!** Chỉ chấp nhận file video (MP4, WebM, MOV, v.v.).").catch(() => {});
            return;
        }
        if (!WARMUP_CHANNEL_ID) {
            await message.reply("❌ **Cấu hình lỗi:** Bot chưa được thiết lập `WARMUP_CHANNEL_ID` trong cấu hình!").catch(() => {});
            return;
        }
        const sizeMB = (attachment!.size / (1024 * 1024)).toFixed(2);
        const processingMsg = await message.reply(`⏳ **Đang tải video lên Discord CDN và cập nhật Database...**\n📁 File: \`${attachment!.name}\` (${sizeMB} MB) — Vui lòng đợi!`).catch(() => null);
        try {
            const storageChannel = await client.channels.fetch(WARMUP_CHANNEL_ID).catch(() => null) as TextChannel;
            if (!storageChannel) {
                await processingMsg?.edit("❌ Không thể kết nối tới kênh lưu trữ ẩn của bot!").catch(() => {});
                return;
            }
            const sentMsg = await storageChannel.send({
                content: `🎥 **Video:** ${title}\n📂 **Thể loại:** ${category}\n📝 **Mô tả:** ${description || 'Không có'}\n👤 **Đăng bởi:** <@${message.author.id}>`,
                files: [attachment!.url]
            }).catch((err) => { console.error("Lỗi gửi file tới kênh lưu trữ ẩn:", err); return null; });
            if (!sentMsg) {
                await processingMsg?.edit("❌ Gửi tệp lên kênh ẩn thất bại! File có thể quá lớn hoặc bot thiếu quyền.").catch(() => {});
                return;
            }
            const freshUrl = sentMsg.attachments.first()?.url || attachment!.url;
            const freshFileName = sentMsg.attachments.first()?.name || attachment!.name || 'video.mp4';
            const dbVideo = await addWarmupVideo({
                title, description, category,
                messageId: sentMsg.id,
                videoType: 'discord',
                fileName: attachment!.name || 'video.mp4',
                fileSize: attachment!.size || 0,
                addedBy: message.author.id
            });
            globalWarmupCache.unshift({
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
            await processingMsg?.edit(
                `✅ **Thêm video thành công!**\n` +
                `🎬 Tiêu đề: **${title}**\n` +
                `🆔 ID Database: \`${dbVideo.id}\` *(Dùng ID này để xóa khi cần)*\n` +
                `🎥 Video: **${title}**\n` +
                `📂 Thể loại: ${catEmoji} **${category}**\n` +
                `📝 Mô tả: ${description || '*(Không có)*'}\n` +
                `👤 Đăng bởi: <@${message.author.id}>`
            ).catch(() => {});
        } catch (error: any) {
            console.error("Lỗi khi thêm video warmup:", error);
            await processingMsg?.edit(`❌ Đã xảy ra lỗi khi thêm video: ${error.message || error}`).catch(() => {});
        }
        return;
    }

    // 2. DELETE VIDEO
    if (subCommand === 'delete' || subCommand === 'remove' || subCommand === 'xoa') {
        if (!isAdmin) {
            await message.reply("❌ **ĐÉO CÓ QUYỀN!** Quyền xóa video warmup chỉ dành cho Admin thôi cưng!").catch(() => {});
            return;
        }
        const targetId = rawInput.replace(/^(warmup|video)\s+(delete|remove|xoa)\s*/i, '').trim();
        if (!targetId) {
            await message.reply("❌ **Thiếu ID!** Cú pháp: `@BotToan warmup delete <ID_Database>`").catch(() => {});
            return;
        }
        const dbVideos = await getWarmupVideos();
        const video = dbVideos.find(v => v.id === targetId);
        if (!video) {
            await message.reply("❌ Không tìm thấy video nào có ID này trong Database!").catch(() => {});
            return;
        }
        const processingMsg = await message.reply(`⏳ Đang xóa video **${video.title}**...`).catch(() => null);
        try {
            const success = await deleteWarmupVideo(targetId);
            if (success) {
                if (video.messageId && WARMUP_CHANNEL_ID) {
                    const storageChannel = await client.channels.fetch(WARMUP_CHANNEL_ID).catch(() => null) as TextChannel;
                    if (storageChannel) {
                        const msgToDelete = await storageChannel.messages.fetch(video.messageId).catch(() => null);
                        if (msgToDelete) await msgToDelete.delete().catch(() => {});
                    }
                }
                globalWarmupCache = globalWarmupCache.filter(v => v.id !== targetId);
                await processingMsg?.edit(`✅ Đã xóa video **${video.title}** khỏi hệ thống thành công!`).catch(() => {});
            } else {
                await processingMsg?.edit("❌ Lỗi khi thực hiện xóa bản ghi trong cơ sở dữ liệu.").catch(() => {});
            }
        } catch (error: any) {
            console.error("Lỗi khi xóa video:", error);
            await processingMsg?.edit(`❌ Gặp lỗi khi xóa video: ${error.message || error}`).catch(() => {});
        }
        return;
    }

    // 3. LIST VIDEOS
    if (subCommand === 'list' || subCommand === 'danhsach' || subCommand === 'ds') {
        const dbVideos = await getWarmupVideos();
        if (dbVideos.length === 0) {
            await message.reply("📂 **Kho video hiện tại đang trống rỗng!**").catch(() => {});
            return;
        }
        const embed = new EmbedBuilder()
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
            } else {
                desc += `\n*...và ${dbVideos.length - i} video khác không hiển thị được*`;
                break;
            }
        }
        embed.setDescription(desc || '*Không có video*');
        await message.reply({ embeds: [embed] }).catch(() => {});
        return;
    }

    // 4. RELOAD CACHE
    if (subCommand === 'reload' || subCommand === 'refresh') {
        if (!isAdmin) {
            await message.reply("❌ Lệnh này chỉ dành cho Admin!").catch(() => {});
            return;
        }
        const processingMsg = await message.reply("🔄 Đang quét kênh Discord và nạp lại RAM Cache...").catch(() => null);
        await loadWarmupVideosCache(client);
        await processingMsg?.edit(`✅ Đã làm mới RAM Cache thành công! Hiện có **${globalWarmupCache.length}** video trong bộ nhớ.`).catch(() => {});
        return;
    }

    // 5. HIỂN THỊ SELECT MENU ĐỂ XEM VIDEO (2 THANH CHỌN + TÌM KIẾM)
    const categoriesInCache = Array.from(new Set(globalWarmupCache.map(v => v.category)));
    const defaultCategories = ['Gaming', 'Meme', 'Music', 'Tiktok', 'Dance', 'General'];
    const allCategories = Array.from(new Set([...defaultCategories, ...categoriesInCache]));

    let filteredCache = globalWarmupCache;
    let filterLabel = '';
    let selectedCategoryValue = 'all';

    const searchQuery = args.slice(1).join(' ').trim().toLowerCase();
    if (searchQuery) {
        // Kiểm tra xem từ khóa gõ vào có trùng khớp với thể loại nào không (lọc theo thể loại nhanh)
        const matchedCat = allCategories.find(c => c.toLowerCase() === searchQuery);
        if (matchedCat) {
            filteredCache = globalWarmupCache.filter(v => v.category.toLowerCase() === matchedCat.toLowerCase());
            filterLabel = ` — Thể loại: ${getCategoryEmoji(matchedCat)} ${matchedCat}`;
            selectedCategoryValue = matchedCat.toLowerCase();
        } else {
            // Tìm kiếm tự do theo từ khóa
            filteredCache = globalWarmupCache.filter(v => 
                v.title.toLowerCase().includes(searchQuery) || 
                v.description.toLowerCase().includes(searchQuery) ||
                v.category.toLowerCase().includes(searchQuery)
            );
            filterLabel = ` — Tìm kiếm: "${searchQuery}"`;
        }
    }

    if (globalWarmupCache.length === 0) {
        await message.reply("📂 **Kho video warmup hiện tại đang trống!** Admin vui lòng dùng lệnh `@BotToan warmup add` để thêm video trước nhé!").catch(() => {});
        return;
    }
    if (filteredCache.length === 0) {
        await message.reply(`📂 **Không tìm thấy video nào khớp với từ khóa/thể loại: "${searchQuery}"**\n👉 Thử gõ \`@BotToan warmup\` để xem tất cả.`).catch(() => {});
        return;
    }

    // --- Xây dựng Thanh 1: Danh sách Thể loại ---
    const categoryOptions = [
        new StringSelectMenuOptionBuilder()
            .setLabel('🌟 Tất cả thể loại')
            .setDescription('Hiển thị tất cả video hiện có')
            .setValue('all')
            .setDefault(selectedCategoryValue === 'all')
    ];

    for (const cat of allCategories) {
        // Chỉ hiện thể loại nếu có video thuộc thể loại đó trong cache
        const hasVideo = globalWarmupCache.some(v => v.category.toLowerCase() === cat.toLowerCase());
        if (hasVideo) {
            const emoji = getCategoryEmoji(cat);
            categoryOptions.push(
                new StringSelectMenuOptionBuilder()
                    .setLabel(`${emoji} ${cat}`)
                    .setDescription(`Xem các video thuộc thể loại ${cat}`)
                    .setValue(cat.toLowerCase())
                    .setDefault(selectedCategoryValue === cat.toLowerCase())
            );
        }
    }

    const categoryMenuCustomId = 'warmup_category_' + message.id;
    const categorySelect = new StringSelectMenuBuilder()
        .setCustomId(categoryMenuCustomId)
        .setPlaceholder('📁 Bước 1: Chọn thể loại video muốn xem...')
        .addOptions(categoryOptions);

    // --- Xây dựng Thanh 2: Danh sách Video tương ứng ---
    const buildVideoOptions = (videos: ICachedWarmupVideo[]) => {
        return videos.slice(0, 25).map(video => {
            const emoji = getCategoryEmoji(video.category);
            const safeTitle = `${emoji} ${video.title}`.slice(0, 95);
            const safeDesc = `${video.description || 'Khởi động giải trí trước trận cùng BotToan!'}`.slice(0, 95);
            return new StringSelectMenuOptionBuilder()
                .setLabel(safeTitle)
                .setDescription(safeDesc)
                .setValue(video.id);
        });
    };

    const videoOptions = buildVideoOptions(filteredCache);
    const videoMenuCustomId = 'warmup_video_' + message.id;
    const videoSelect = new StringSelectMenuBuilder()
        .setCustomId(videoMenuCustomId)
        .setPlaceholder(videoOptions.length > 0 ? '🎬 Bước 2: Chọn video muốn xem...' : '❌ Không có video trong thể loại này')
        .addOptions(videoOptions.length > 0 ? videoOptions : [
            new StringSelectMenuOptionBuilder().setLabel('Không có video').setValue('none')
        ])
        .setDisabled(videoOptions.length === 0);

    const rowCategory = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(categorySelect);
    const rowVideo = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(videoSelect);

    const embed = new EmbedBuilder()
        .setTitle(`🎬 KHO VIDEO GIẢI TRÍ BOTTOAN${filterLabel}`)
        .setDescription(
            `Chào mừng bạn đến với rạp chiếu phim mini của **BotToan**! 🍿\n\n` +
            `🔍 **Tìm nhanh:** Bạn có thể gõ \`@BotToan warmup [từ khóa]\` để lọc video siêu tốc.\n\n` +
            `👇 **Lựa chọn theo 2 bước bên dưới:** Chọn Thể loại trước rồi chọn Video muốn xem nhé!`
        )
        .setColor(0x8E44AD)
        .setFooter({ text: "Hệ thống phát video độc lập • BotToan Warmup", iconURL: client.user?.displayAvatarURL() })
        .setTimestamp();

    const menuMsg = await message.reply({
        embeds: [embed],
        components: [rowCategory, rowVideo]
    }).catch(() => null);

    if (!menuMsg) return;

    const collector = menuMsg.createMessageComponentCollector({
        filter: (i: any) => i.customId === categoryMenuCustomId || i.customId === videoMenuCustomId,
        time: 300000 // 5 phút
    });

    let currentCategoryId = selectedCategoryValue;
    let currentRows = [rowCategory, rowVideo];

    collector.on('collect', async (interaction: any) => {
        if (interaction.customId === categoryMenuCustomId) {
            currentCategoryId = interaction.values[0];

            // Lọc lại danh sách video theo category đã chọn
            let categoryVideos = globalWarmupCache;
            if (currentCategoryId !== 'all') {
                categoryVideos = globalWarmupCache.filter(v => v.category.toLowerCase() === currentCategoryId.toLowerCase());
            }

            const newVideoOptions = buildVideoOptions(categoryVideos);
            const newVideoSelect = new StringSelectMenuBuilder()
                .setCustomId(videoMenuCustomId)
                .setPlaceholder(newVideoOptions.length > 0 ? '🎬 Bước 2: Chọn video muốn xem...' : '❌ Không có video trong thể loại này')
                .addOptions(newVideoOptions.length > 0 ? newVideoOptions : [
                    new StringSelectMenuOptionBuilder().setLabel('Không có video').setValue('none')
                ])
                .setDisabled(newVideoOptions.length === 0);

            // Cập nhật lại trạng thái default được chọn trong menu thể loại
            const newCategoryOptions = categoryOptions.map(opt => {
                const isSelected = opt.data.value === currentCategoryId;
                return StringSelectMenuOptionBuilder.from(opt).setDefault(isSelected);
            });
            const newCategorySelect = new StringSelectMenuBuilder()
                .setCustomId(categoryMenuCustomId)
                .setPlaceholder('📁 Bước 1: Chọn thể loại video muốn xem...')
                .addOptions(newCategoryOptions);

            const newRowCategory = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(newCategorySelect);
            const newRowVideo = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(newVideoSelect);
            currentRows = [newRowCategory, newRowVideo];

            const embedTitle = currentCategoryId === 'all' ? 'TẤT CẢ THỂ LOẠI' : currentCategoryId.toUpperCase();
            const updatedSearchEmbed = EmbedBuilder.from(embed)
                .setTitle(`🎬 KHO VIDEO GIẢI TRÍ BOTTOAN — ${embedTitle}`)
                .setDescription(
                    `Chào mừng bạn đến với rạp chiếu phim mini của **BotToan**! 🍿\n\n` +
                    `📊 Đang hiển thị các video của thể loại: **${embedTitle}**\n\n` +
                    `👇 **Hãy chọn video từ menu bên dưới** để bắt đầu thưởng thức!`
                );

            await interaction.update({
                embeds: [updatedSearchEmbed],
                components: currentRows
            }).catch(() => {});

        } else if (interaction.customId === videoMenuCustomId) {
            const selectedId = interaction.values[0];
            if (selectedId === 'none') {
                await interaction.reply({ content: "❌ Không có video nào để phát!", ephemeral: true }).catch(() => {});
                return;
            }

            const video = globalWarmupCache.find(v => v.id === selectedId);
            if (!video) {
                await interaction.reply({ content: "❌ Không tìm thấy video! Thử `@BotToan warmup reload` để làm mới.", ephemeral: true }).catch(() => {});
                return;
            }

            await sendVideoToUser(interaction, video, client, currentRows);
        }
    });

    collector.on('end', async () => {
        try {
            const disabledCategory = StringSelectMenuBuilder.from(categorySelect).setDisabled(true);
            const disabledVideo = StringSelectMenuBuilder.from(videoSelect).setDisabled(true);
            const disabledRowCategory = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(disabledCategory);
            const disabledRowVideo = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(disabledVideo);
            await menuMsg.edit({
                components: [disabledRowCategory, disabledRowVideo]
            }).catch(() => {});
        } catch {}
    });
}
