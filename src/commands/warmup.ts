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
    addedBy: string;
    fileName?: string;
}

// RAM Cache lưu trữ tạm thời các video để truy cập cực nhanh
export let globalWarmupCache: ICachedWarmupVideo[] = [];

function getCategoryEmoji(category: string): string {
    return (CATEGORY_EMOJIS as any)[category] || '🎬';
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
        while (true) {
            const options: any = { limit: 100 };
            if (lastId) options.before = lastId;
            const fetched: any = await textChannel.messages.fetch(options).catch(() => null);
            if (!fetched || fetched.size === 0) break;
            allMessages = allMessages.concat(Array.from(fetched.values()));
            lastId = fetched.lastKey();
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
            const data = messageMap.get(video.messageId);
            if (data) {
                newCache.push({
                    id: video.id || "",
                    title: video.title,
                    description: video.description || "",
                    category: video.category,
                    videoUrl: data.url,
                    addedBy: video.addedBy || "",
                    fileName: data.fileName || video.fileName || "video.mp4"
                });
            } else {
                console.warn(`[WARMUP CACHE] Không tìm thấy file cho video ID: ${video.id}, messageId: ${video.messageId}`);
            }
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
    row: ActionRowBuilder<StringSelectMenuBuilder>
): Promise<void> {
    const emoji = getCategoryEmoji(video.category);
    const updatedEmbed = new EmbedBuilder()
        .setTitle(`🎬 ĐANG XEM: ${video.title.toUpperCase()}`)
        .setDescription(video.description || "Khởi động giải trí cùng BotToan!")
        .addFields(
            { name: "📂 Thể loại", value: `${emoji} \`${video.category}\``, inline: true },
            { name: "👤 Đóng góp bởi", value: video.addedBy ? `<@${video.addedBy}>` : "Ẩn danh", inline: true }
        )
        .setColor(0x9B59B6)
        .setFooter({ text: "Bạn có thể tiếp tục chọn video khác từ menu bên dưới", iconURL: client.user?.displayAvatarURL() })
        .setTimestamp();

    // Bước 1: Dùng deferUpdate() để Discord biết bot đang xử lý.
    // Điều này cho phép editReply() hoạt động ổn định sau đó.
    try {
        await interaction.deferUpdate();
    } catch {
        // Nếu interaction đã hết hạn (>3 giây), bỏ qua
        return;
    }

    const MAX_SIZE = 24 * 1024 * 1024;

    // Bước 2: Cập nhật ngay embed + thông báo đang tải (không có file)
    await interaction.editReply({
        content: `⏳ Đang tải video **${video.title}** về...`,
        embeds: [updatedEmbed],
        components: [row],
        files: []
    }).catch(() => {});

    try {
        const response = await fetch(video.videoUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BotToan-Discord/1.0)' }
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const contentLength = parseInt(response.headers.get('content-length') || '0');
        if (contentLength > 0 && contentLength > MAX_SIZE) {
            throw new Error(`FILE_TOO_LARGE:${contentLength}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        if (buffer.length > MAX_SIZE) throw new Error(`FILE_TOO_LARGE:${buffer.length}`);

        const safeFileName = video.fileName || 'video.mp4';
        const attachment = new AttachmentBuilder(buffer, { name: safeFileName });

        // Bước 3: Gắn file video trực tiếp vào tin nhắn → Discord render inline player to và đẹp
        await interaction.editReply({
            content: '',
            embeds: [updatedEmbed],
            components: [row],
            files: [attachment]
        });
    } catch (err: any) {
        // Fallback: Gửi link CDN để Discord tự embed (trường hợp file quá lớn hoặc mạng lỗi)
        console.warn(`[WARMUP] Fallback sang link CDN cho "${video.title}": ${err.message}`);
        await interaction.editReply({
            content: video.videoUrl,
            embeds: [updatedEmbed],
            components: [row],
            files: []
        }).catch((e: any) => console.error("[WARMUP] Lỗi fallback CDN:", e));
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
                "*(Thể loại: Gaming / Meme / Music / Tiktok / Dance / General hoặc tự nhập)*\n" +
                "**và đính kèm tệp video (MP4/WebM)**."
            ).catch(() => {});
            return;
        }
        const attachment = message.attachments.first();
        if (!attachment) {
            await message.reply("❌ **Thiếu file đính kèm!** Bạn phải upload đính kèm 1 file video (MP4/WebM) khi chạy lệnh này.").catch(() => {});
            return;
        }
        const isVideo = attachment.contentType?.startsWith('video/') ||
            /\.(mp4|webm|mov|mkv|avi|flv|m4v)$/i.test(attachment.name || '');
        if (!isVideo) {
            await message.reply("❌ **File không hợp lệ!** Chỉ chấp nhận file video (MP4, WebM, MOV, v.v.).").catch(() => {});
            return;
        }
        const parts = rest.split('|');
        const title = parts[0] ? parts[0].trim() : '';
        const description = parts[1] ? parts[1].trim() : '';
        let category = parts[2] ? parts[2].trim() : 'General';
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
        if (!WARMUP_CHANNEL_ID) {
            await message.reply("❌ **Cấu hình lỗi:** Bot chưa được thiết lập `WARMUP_CHANNEL_ID` trong cấu hình!").catch(() => {});
            return;
        }
        const sizeMB = (attachment.size / (1024 * 1024)).toFixed(2);
        const processingMsg = await message.reply(`⏳ **Đang tải video lên Discord CDN và cập nhật Database...**\n📁 File: \`${attachment.name}\` (${sizeMB} MB) — Vui lòng đợi!`).catch(() => null);
        try {
            const storageChannel = await client.channels.fetch(WARMUP_CHANNEL_ID).catch(() => null) as TextChannel;
            if (!storageChannel) {
                await processingMsg?.edit("❌ Không thể kết nối tới kênh lưu trữ ẩn của bot!").catch(() => {});
                return;
            }
            const sentMsg = await storageChannel.send({
                content: `🎥 **Video:** ${title}\n📂 **Thể loại:** ${category}\n📝 **Mô tả:** ${description || 'Không có'}\n👤 **Đăng bởi:** <@${message.author.id}>`,
                files: [attachment.url]
            }).catch((err) => { console.error("Lỗi gửi file tới kênh lưu trữ ẩn:", err); return null; });
            if (!sentMsg) {
                await processingMsg?.edit("❌ Gửi tệp lên kênh ẩn thất bại! File có thể quá lớn hoặc bot thiếu quyền.").catch(() => {});
                return;
            }
            const freshUrl = sentMsg.attachments.first()?.url || attachment.url;
            const freshFileName = sentMsg.attachments.first()?.name || attachment.name || 'video.mp4';
            const dbVideo = await addWarmupVideo({
                title, description, category,
                messageId: sentMsg.id,
                fileName: attachment.name || 'video.mp4',
                fileSize: attachment.size || 0,
                addedBy: message.author.id
            });
            globalWarmupCache.unshift({
                id: dbVideo.id || "",
                title: dbVideo.title,
                description: dbVideo.description || "",
                category: dbVideo.category,
                videoUrl: freshUrl,
                addedBy: dbVideo.addedBy || "",
                fileName: freshFileName
            });
            const catEmoji = getCategoryEmoji(category);
            await processingMsg?.edit(
                `✅ Thêm video thành công!\n` +
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

    // 5. HIỂN THỊ SELECT MENU ĐỂ XEM VIDEO
    let filteredCache = globalWarmupCache;
    let filterLabel = '';
    if (subCommand) {
        const foundCat = Object.keys(CATEGORY_EMOJIS).find(c => c.toLowerCase() === subCommand);
        if (foundCat) {
            filteredCache = globalWarmupCache.filter(v => v.category.toLowerCase() === foundCat.toLowerCase());
            filterLabel = ` — ${getCategoryEmoji(foundCat)} ${foundCat}`;
        } else {
            await message.reply(
                `❓ Lệnh \`${subCommand}\` không hợp lệ!\n\n` +
                `**Các lệnh warmup có sẵn:**\n` +
                `• \`@BotToan warmup\` — Xem video\n` +
                `• \`@BotToan warmup gaming\` — Lọc theo thể loại\n` +
                `• \`@BotToan warmup list\` — Xem danh sách\n` +
                `• \`@BotToan warmup add ...\` *(Admin)* — Thêm video\n` +
                `• \`@BotToan warmup delete <ID>\` *(Admin)* — Xóa video`
            ).catch(() => {});
            return;
        }
    }

    if (globalWarmupCache.length === 0) {
        await message.reply("📂 **Kho video warmup hiện tại đang trống!** Admin vui lòng dùng lệnh `@BotToan warmup add` để thêm video trước nhé!").catch(() => {});
        return;
    }
    if (filteredCache.length === 0) {
        await message.reply("📂 **Không có video nào thuộc thể loại này!** Dùng `@BotToan warmup` để xem tất cả video.").catch(() => {});
        return;
    }

    const options = filteredCache.slice(0, 25).map(video => {
        const emoji = getCategoryEmoji(video.category);
        const safeTitle = `${emoji} ${video.title}`.slice(0, 95);
        const safeDesc = `${video.description || 'Khởi động giải trí trước trận cùng BotToan!'}`.slice(0, 95);
        return new StringSelectMenuOptionBuilder()
            .setLabel(safeTitle)
            .setDescription(safeDesc)
            .setValue(video.id);
    });

    const menuCustomId = 'warmup_select_' + message.id;
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(menuCustomId)
        .setPlaceholder('👉 Bấm vào đây để chọn video muốn xem...')
        .addOptions(options);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    const embed = new EmbedBuilder()
        .setTitle(`🎬 KHO VIDEO GIẢI TRÍ BOTTOAN${filterLabel}`)
        .setDescription(
            `Chào mừng bạn đến với rạp chiếu phim mini của **BotToan**! 🍿\n\n` +
            `📊 Hiển thị **${Math.min(filteredCache.length, 25)}/${filteredCache.length}** video${filterLabel ? ` (đã lọc)` : ''}.\n\n` +
            `👇 **Hãy chọn một video từ menu thả xuống bên dưới** để bắt đầu thưởng thức. Bot sẽ tải video về và phát ngay tại đây!`
        )
        .setColor(0x8E44AD)
        .setFooter({ text: "Hệ thống tải file trực tiếp • BotToan Warmup", iconURL: client.user?.displayAvatarURL() })
        .setTimestamp();

    const menuMsg = await message.reply({
        embeds: [embed],
        components: [row]
    }).catch(() => null);

    if (!menuMsg) return;

    // Mọi người đều có thể chọn video (không chỉ người gọi lệnh)
    const collector = menuMsg.createMessageComponentCollector({
        filter: (i: any) => i.customId === menuCustomId,
        time: 300000
    });

    collector.on('collect', async (interaction: any) => {
        const selectedId = interaction.values[0];
        const video = globalWarmupCache.find(v => v.id === selectedId);
        if (!video) {
            await interaction.reply({ content: "❌ Không tìm thấy video! Thử `@BotToan warmup reload` để làm mới.", ephemeral: true }).catch(() => {});
            return;
        }
        await sendVideoToUser(interaction, video, client, row);
    });

    collector.on('end', async () => {
        try {
            const disabledMenu = StringSelectMenuBuilder.from(selectMenu).setDisabled(true);
            const disabledRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(disabledMenu);
            await menuMsg.edit({ components: [disabledRow] }).catch(() => {});
        } catch {}
    });
}
