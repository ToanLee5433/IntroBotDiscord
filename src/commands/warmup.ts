import { 
    Message, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder, TextChannel, Client, PermissionFlagsBits 
} from 'discord.js';
import { addWarmupVideo, getWarmupVideos, deleteWarmupVideo } from '../database';
import { WARMUP_CHANNEL_ID } from '../config';

// Bản đồ Emoji tương ứng với từng thể loại video
export const CATEGORY_EMOJIS: Record<string, string> = {
    'Gaming': '🎮',
    'Meme': '😂',
    'Music': '🎶',
    'General': '🎬'
};

export interface ICachedWarmupVideo {
    id: string;
    title: string;
    description: string;
    category: string;
    videoUrl: string;
    addedBy: string;
}

// RAM Cache lưu trữ tạm thời các video để truy cập cực nhanh
export let globalWarmupCache: ICachedWarmupVideo[] = [];

/**
 * Tải toàn bộ video từ DB và kênh lưu trữ ẩn vào RAM Cache
 */
export async function loadWarmupVideosCache(client: Client): Promise<void> {
    try {
        if (!WARMUP_CHANNEL_ID) {
            console.warn("[WARMUP] WARMUP_CHANNEL_ID chưa được cấu hình trong .env. Bỏ qua tải cache video.");
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

        // Fetch toàn bộ tin nhắn trong kênh ẩn (hỗ trợ phân trang)
        while (true) {
            const options: any = { limit: 100 };
            if (lastId) {
                options.before = lastId;
            }
            const fetched: any = await textChannel.messages.fetch(options).catch(() => null);
            if (!fetched || fetched.size === 0) break;
            
            allMessages = allMessages.concat(Array.from(fetched.values()));
            lastId = fetched.lastKey();
            
            if (fetched.size < 100) break;
        }

        // Tạo map lưu giữ messageId -> Attachment URL
        const messageMap = new Map<string, string>();
        for (const msg of allMessages) {
            const attachment = msg.attachments.first();
            if (attachment && attachment.url) {
                messageMap.set(msg.id, attachment.url);
            }
        }

        // Tạo cache mới
        const newCache: ICachedWarmupVideo[] = [];
        for (const video of dbVideos) {
            const videoUrl = messageMap.get(video.messageId);
            if (videoUrl) {
                newCache.push({
                    id: video.id || "",
                    title: video.title,
                    description: video.description || "",
                    category: video.category,
                    videoUrl: videoUrl,
                    addedBy: video.addedBy || ""
                });
            } else {
                console.warn(`[WARMUP CACHE] Không tìm thấy tệp đính kèm tương ứng cho video ID: ${video.id}, messageId: ${video.messageId}`);
            }
        }

        globalWarmupCache = newCache;
        console.log(`[WARMUP] Đã nạp thành công ${globalWarmupCache.length}/${dbVideos.length} video warmup vào RAM Cache.`);
    } catch (error) {
        console.error("[WARMUP CACHE LỖI] Lỗi nghiêm trọng khi nạp cache video:", error);
    }
}

/**
 * Xử lý lệnh warmup chính
 */
export async function handleWarmupCommand(message: Message, rawInput: string, client: Client) {
    const args = rawInput.trim().split(/\s+/);
    const subCommand = args[1] ? args[1].toLowerCase() : '';

    const isAdmin = message.member?.permissions.has(PermissionFlagsBits.Administrator);

    // 1. LỆNH PHỤ: ADD VIDEO (Chỉ dành cho Admin)
    if (subCommand === 'add') {
        if (!isAdmin) {
            await message.reply("❌ **ĐÉO CÓ QUYỀN!** Lệnh thêm video warmup chỉ dành cho Admin đẹp trai/xinh gái thôi nhé! 😤").catch(() => {});
            return;
        }

        const rest = rawInput.replace(/^(warmup|video)\s+add\s*/i, '').trim();
        if (!rest) {
            await message.reply("❌ **Sai cú pháp!** Hãy gõ: `@BotToan warmup add Tiêu đề | [Mô tả] | [Thể loại (Gaming/Meme/Music/General)]` và **đính kèm tệp video**.").catch(() => {});
            return;
        }

        const attachment = message.attachments.first();
        if (!attachment) {
            await message.reply("❌ **Thiếu file đính kèm!** Bạn phải upload đính kèm 1 file video (MP4/WebM) khi chạy lệnh này.").catch(() => {});
            return;
        }

        const parts = rest.split('|');
        const title = parts[0] ? parts[0].trim() : '';
        const description = parts[1] ? parts[1].trim() : '';
        let category = parts[2] ? parts[2].trim() : 'General';

        // Chuẩn hóa thể loại
        const validCategories = Object.keys(CATEGORY_EMOJIS);
        const matchedCat = validCategories.find(c => c.toLowerCase() === category.toLowerCase());
        if (matchedCat) {
            category = matchedCat;
        } else {
            category = 'General';
        }

        if (!title) {
            await message.reply("❌ **Lỗi:** Tiêu đề video không được bỏ trống!").catch(() => {});
            return;
        }

        if (!WARMUP_CHANNEL_ID) {
            await message.reply("❌ **Cấu hình lỗi:** Bot chưa được thiết lập `WARMUP_CHANNEL_ID` trong cấu hình hệ thống!").catch(() => {});
            return;
        }

        // Gửi thông báo đang tải lên
        const processingMsg = await message.reply("⏳ **Đang tải video lên Discord CDN và cập nhật Database...** Vui lòng đợi!").catch(() => null);

        try {
            const storageChannel = await client.channels.fetch(WARMUP_CHANNEL_ID).catch(() => null) as TextChannel;
            if (!storageChannel) {
                await processingMsg?.edit("❌ Không thể kết nối tới kênh lưu trữ ẩn của bot. Hãy kiểm tra lại ID kênh!").catch(() => {});
                return;
            }

            // Gửi video tới kênh ẩn để tạo link CDN vĩnh viễn
            const sentMsg = await storageChannel.send({
                content: `🎥 **Video:** ${title}\n📂 **Thể loại:** ${category}\n📝 **Mô tả:** ${description || 'Không có'}\n👤 **Đăng bởi:** <@${message.author.id}>`,
                files: [attachment.url]
            }).catch((err) => {
                console.error("Lỗi gửi file tới kênh lưu trữ ẩn:", err);
                return null;
            });

            if (!sentMsg) {
                await processingMsg?.edit("❌ Gửi tệp lên kênh ẩn thất bại!").catch(() => {});
                return;
            }

            const freshUrl = sentMsg.attachments.first()?.url || attachment.url;

            // Lưu thông tin vào DB
            const dbVideo = await addWarmupVideo({
                title,
                description,
                category,
                messageId: sentMsg.id,
                fileName: attachment.name || 'video.mp4',
                fileSize: attachment.size || 0,
                addedBy: message.author.id
            });

            // Đẩy trực tiếp vào RAM Cache để có hiệu lực ngay lập tức
            globalWarmupCache.unshift({
                id: dbVideo.id || "",
                title: dbVideo.title,
                description: dbVideo.description || "",
                category: dbVideo.category,
                videoUrl: freshUrl,
                addedBy: dbVideo.addedBy || ""
            });

            await processingMsg?.edit(`✅ **Thêm video thành công!**\n🎬 Tiêu đề: **${title}**\n🆔 ID Database: \`${dbVideo.id}\` (Dùng ID này để xóa khi cần).`).catch(() => {});
        } catch (error: any) {
            console.error("Lỗi khi thêm video warmup:", error);
            await processingMsg?.edit(`❌ Đã xảy ra lỗi khi thêm video: ${error.message || error}`).catch(() => {});
        }
        return;
    }

    // 2. LỆNH PHỤ: DELETE VIDEO (Chỉ dành cho Admin)
    if (subCommand === 'delete' || subCommand === 'remove') {
        if (!isAdmin) {
            await message.reply("❌ **ĐÉO CÓ QUYỀN!** Quyền xóa video warmup chỉ dành cho Admin thôi cưng!").catch(() => {});
            return;
        }

        const targetId = rawInput.replace(/^(warmup|video)\s+(delete|remove)\s*/i, '').trim();
        if (!targetId) {
            await message.reply("❌ **Thiếu ID!** Cú pháp: `@BotToan warmup delete <ID_Database>`").catch(() => {});
            return;
        }

        // Tìm video trong DB để lấy messageId
        const dbVideos = await getWarmupVideos();
        const video = dbVideos.find(v => v.id === targetId);

        if (!video) {
            await message.reply("❌ Không tìm thấy video nào có ID này trong Database!").catch(() => {});
            return;
        }

        const processingMsg = await message.reply("⏳ Đang tiến hành xóa dữ liệu...").catch(() => null);

        try {
            // Xóa trong DB
            const success = await deleteWarmupVideo(targetId);
            if (success) {
                // Xóa tin nhắn lưu trữ trong kênh ẩn
                if (video.messageId && WARMUP_CHANNEL_ID) {
                    const storageChannel = await client.channels.fetch(WARMUP_CHANNEL_ID).catch(() => null) as TextChannel;
                    if (storageChannel) {
                        const msgToDelete = await storageChannel.messages.fetch(video.messageId).catch(() => null);
                        if (msgToDelete) {
                            await msgToDelete.delete().catch(() => {});
                        }
                    }
                }

                // Xóa trực tiếp khỏi RAM Cache
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

    // 3. LỆNH PHỤ: LIST VIDEOS (Cho mọi người xem)
    if (subCommand === 'list' || subCommand === 'danhsach') {
        const dbVideos = await getWarmupVideos();
        if (dbVideos.length === 0) {
            await message.reply("📂 **Kho video hiện tại đang trống rỗng!**").catch(() => {});
            return;
        }

        let listText = "📂 **DANH SÁCH VIDEO WARMUP HIỆN CÓ:**\n\n";
        dbVideos.forEach((v, index) => {
            const sizeMB = v.fileSize ? (v.fileSize / (1024 * 1024)).toFixed(2) : "0.00";
            const emoji = CATEGORY_EMOJIS[v.category] || CATEGORY_EMOJIS['General'];
            listText += `${index + 1}. **${v.title}** (ID: \`${v.id}\`)\n   - Thể loại: ${emoji} \`${v.category}\` | Kích thước: \`${sizeMB} MB\`\n`;
        });

        if (listText.length > 2000) {
            listText = listText.slice(0, 1950) + "\n*...và một số video khác*";
        }
        await message.reply(listText).catch(() => {});
        return;
    }

    // 4. LỆNH PHỤ: RELOAD CACHE (Chỉ Admin)
    if (subCommand === 'reload') {
        if (!isAdmin) {
            await message.reply("❌ Lệnh này chỉ dành cho Admin!").catch(() => {});
            return;
        }
        const processingMsg = await message.reply("🔄 Đang quét kênh Discord và nạp lại RAM Cache...").catch(() => null);
        await loadWarmupVideosCache(client);
        await processingMsg?.edit("✅ Đã cập nhật và làm mới RAM Cache video thành công!").catch(() => {});
        return;
    }

    // 5. LỆNH CHÍNH: HIỂN THỊ SELECT MENU ĐỂ XEM VIDEO
    if (globalWarmupCache.length === 0) {
        await message.reply("📂 **Kho video warmup hiện tại đang trống!** Admin vui lòng dùng lệnh `@BotToan warmup add` để thêm video trước nhé!").catch(() => {});
        return;
    }

    // Xây dựng danh sách 25 video gần nhất cho Select Menu (Discord giới hạn tối đa 25 options)
    const options = globalWarmupCache.slice(0, 25).map(video => {
        const emoji = CATEGORY_EMOJIS[video.category] || CATEGORY_EMOJIS['General'];
        
        // Tránh lỗi Discord API crash nếu tiêu đề hoặc mô tả vượt quá 100 ký tự
        const safeTitle = `${emoji} ${video.title}`.slice(0, 95);
        const safeDesc = `${video.description || 'Khởi động giải trí trước trận cùng BotToan!'}`.slice(0, 95);

        return new StringSelectMenuOptionBuilder()
            .setLabel(safeTitle)
            .setDescription(safeDesc)
            .setValue(video.id);
    });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('warmup_select')
        .setPlaceholder('👉 Bấm vào đây để chọn video muốn xem...')
        .addOptions(options);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    const embed = new EmbedBuilder()
        .setTitle("🎬 KHO VIDEO GIẢI TRÍ BOTTOAN")
        .setDescription(
            "Chào mừng bạn đến với rạp chiếu phim mini của **BotToan**! 🍿\n\n" +
            "👇 **Hãy chọn một video từ menu thả xuống bên dưới** để bắt đầu thưởng thức. Video sẽ hiển thị to rõ ràng ngay tại khung chat!"
        )
        .setColor(0x8E44AD)
        .setFooter({ text: "Hệ thống tự động nạp liên kết tươi mới • BotToan Warmup", iconURL: client.user?.displayAvatarURL() })
        .setTimestamp();

    // Gửi tin nhắn chứa select menu
    const menuMsg = await message.reply({
        embeds: [embed],
        components: [row]
    }).catch(() => null);

    if (!menuMsg) return;

    // Thiết lập Collector lắng nghe tương tác từ chính người gọi lệnh
    const filter = (i: any) => i.customId === 'warmup_select' && i.user.id === message.author.id;
    const collector = menuMsg.createMessageComponentCollector({
        filter,
        time: 180000 // Hết hạn sau 3 phút không hoạt động
    });

    collector.on('collect', async (interaction: any) => {
        const selectedId = interaction.values[0];
        const video = globalWarmupCache.find(v => v.id === selectedId);

        if (!video) {
            await interaction.reply({ content: "❌ Không tìm thấy video được chọn trong bộ nhớ đệm!", ephemeral: true }).catch(() => {});
            return;
        }

        const emoji = CATEGORY_EMOJIS[video.category] || CATEGORY_EMOJIS['General'];

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

        // ĐẶC BIỆT LƯU Ý: Để video hiển thị "to và rõ ràng" ở kích thước tối đa trong Discord,
        // chúng ta gửi đường dẫn videoUrl trực tiếp vào trường `content` (nằm ngoài block Embed).
        // Khi bấm đổi video, interaction.update() sẽ thay đổi content thô này,
        // Discord sẽ tự động cập nhật lại trình phát Inline Player cực kỳ mượt mà.
        await interaction.update({
            content: video.videoUrl, // Link URL gửi ở text content ngoài Embed để Discord render to và rõ ràng
            embeds: [updatedEmbed],
            components: [row] // Giữ nguyên menu lựa chọn
        }).catch((err: any) => {
            console.error("Lỗi khi cập nhật giao diện chọn video:", err);
        });
    });

    collector.on('end', async () => {
        // Vô hiệu hóa menu thả xuống khi hết thời gian 3 phút
        const disabledMenu = StringSelectMenuBuilder.from(selectMenu).setDisabled(true);
        const disabledRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(disabledMenu);

        await menuMsg.edit({
            components: [disabledRow]
        }).catch(() => {});
    });
}
