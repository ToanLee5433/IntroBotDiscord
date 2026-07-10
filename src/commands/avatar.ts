import { Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Client } from 'discord.js';

/**
 * Trả về trang hiển thị Avatar của thành viên
 */
export async function getAvatarPage(targetUser: any, guildMember: any, type: 'global' | 'server'): Promise<{ embeds: EmbedBuilder[], components: ActionRowBuilder<any>[] }> {
    const name = guildMember ? guildMember.displayName : targetUser.username;
    
    let avatarUrl = "";
    let titleType = "";
    
    if (type === 'server' && guildMember) {
        avatarUrl = guildMember.avatarURL({ size: 1024, forceStatic: false }) || targetUser.displayAvatarURL({ size: 1024, forceStatic: false });
        titleType = "Avatar Server";
    } else {
        avatarUrl = targetUser.displayAvatarURL({ size: 1024, forceStatic: false });
        titleType = "Avatar Toàn Cầu";
    }

    const embed = new EmbedBuilder()
        .setTitle(`🖼️ ${titleType.toUpperCase()} CỦA ${name.toUpperCase()}`)
        .setImage(avatarUrl)
        .setColor(0x3498DB)
        .setTimestamp();

    const buttons: any[] = [
        new ButtonBuilder()
            .setLabel("🔗 Mở ảnh gốc")
            .setStyle(ButtonStyle.Link)
            .setURL(avatarUrl)
    ];

    // Kiểm tra xem member có avatar riêng ở server không
    const hasServerAvatar = guildMember && guildMember.avatarURL() !== null;
    if (hasServerAvatar) {
        if (type === 'global') {
            buttons.push(
                new ButtonBuilder()
                    .setCustomId(`avt_server_${targetUser.id}`)
                    .setLabel("🏠 Xem Avatar Server")
                    .setStyle(ButtonStyle.Primary)
            );
        } else {
            buttons.push(
                new ButtonBuilder()
                    .setCustomId(`avt_global_${targetUser.id}`)
                    .setLabel("🌐 Xem Avatar Toàn Cầu")
                    .setStyle(ButtonStyle.Success)
            );
        }
    }

    const row = new ActionRowBuilder().addComponents(buttons);
    return { embeds: [embed], components: [row] };
}

/**
 * Xử lý lệnh lấy Avatar
 */
export async function handleAvatarCommand(message: Message, cleanInput: string) {
    // Cú pháp: @BotToan avatar [@user hoặc id hoặc tên]
    const args = cleanInput.trim().split(/\s+/);
    const potentialArg = args.slice(1).join(' ').trim();
    
    let targetUserId = message.author.id;

    if (potentialArg) {
        // 1. Kiểm tra tag mention dạng <@123456789>
        const mentionMatch = potentialArg.match(/<@!?(\d+)>/);
        if (mentionMatch) {
            targetUserId = mentionMatch[1];
        } else {
            // 2. Kiểm tra ID dạng số thô
            const idMatch = potentialArg.match(/^\d{17,21}$/);
            if (idMatch) {
                targetUserId = idMatch[0];
            } else {
                // 3. Tìm kiếm thành viên trong server theo tên hiển thị
                const nameQuery = potentialArg.toLowerCase();
                const foundMember = message.guild?.members.cache.find(m => 
                    m.displayName.toLowerCase().includes(nameQuery) || 
                    m.user.username.toLowerCase().includes(nameQuery)
                );
                if (foundMember) {
                    targetUserId = foundMember.id;
                } else {
                    await message.reply("❌ **Không tìm thấy thành viên này trong server!**").catch(() => {});
                    return;
                }
            }
        }
    }

    // Lấy thông tin GuildMember & User an toàn
    let guildMember = null;
    try {
        guildMember = await message.guild?.members.fetch(targetUserId);
    } catch (err) {
        // Fallback nếu user đã rời server hoặc không ở trong server
    }

    let targetUser = null;
    if (guildMember) {
        targetUser = guildMember.user;
    } else {
        try {
            targetUser = await message.client.users.fetch(targetUserId);
        } catch (err) {
            await message.reply("❌ **Không tìm thấy người dùng này trên hệ thống Discord!**").catch(() => {});
            return;
        }
    }

    // Mặc định hiển thị Avatar Server nếu có, ngược lại hiển thị Avatar Global
    const defaultType = (guildMember && guildMember.avatarURL() !== null) ? 'server' : 'global';
    const page = await getAvatarPage(targetUser, guildMember, defaultType);
    await message.reply(page).catch(() => {});
}

/**
 * Đăng ký bộ lắng nghe sự kiện tương tác nút bấm chuyển đổi Avatar
 */
export function registerAvatarCollector(client: Client) {
    client.on('interactionCreate', async (interaction: any) => {
        const id = interaction.customId;
        if (!id || !id.startsWith('avt_')) return;

        if (interaction.isButton()) {
            const parts = id.split('_');
            const type = parts[1] as 'global' | 'server';
            const targetUserId = parts[2];

            let guildMember = null;
            try {
                guildMember = await interaction.guild?.members.fetch(targetUserId);
            } catch (err) {}

            let targetUser = null;
            if (guildMember) {
                targetUser = guildMember.user;
            } else {
                try {
                    targetUser = await interaction.client.users.fetch(targetUserId);
                } catch (err) {
                    await interaction.reply({ content: "❌ Người dùng này không tồn tại!", ephemeral: true }).catch(() => {});
                    return;
                }
            }

            const page = await getAvatarPage(targetUser, guildMember, type);
            // Cập nhật giao diện đè lên mượt mà (hỗ trợ tương tác công khai)
            await interaction.update(page).catch(() => {});
        }
    });
}
