import { 
    Client, GuildMember, TextChannel, EmbedBuilder, PermissionFlagsBits, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle 
} from 'discord.js';
import { sleep, formatMoney } from '../utils';
import { claimWelcomeGift } from '../database';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Đăng ký sự kiện chào mừng thành viên mới và lắng nghe nút bấm nhận lì xì tân thủ
 */
export function registerWelcomeEvent(client: Client) {
    // 1. LẮNG NGHE THÀNH VIÊN MỚI GIA NHẬP GUILD
    client.on('guildMemberAdd', async (member: GuildMember) => {
        try {
            await sleep(1000); // Chờ 1 giây để Discord load profile ổn định
            
            let freshMember = member;
            try {
                freshMember = await member.guild.members.fetch(member.id);
            } catch (fetchErr) {
                console.warn(`[CHÀO MỪNG WARNING] Không thể fetch thông tin mới nhất của ${member.user.tag}:`, fetchErr);
            }

            const guild = freshMember.guild;
            const me = guild.members.me;
            if (!me) return;
            
            let welcomeChannel: any = null;
            
            // Tìm kênh welcome phù hợp
            const channelKeywords = ['welcome', 'chào-mừng', 'chao-mung', 'nhập-gia', 'nhap-gia', 'lối-vào', 'loi-vao'];
            const targetChannel = guild.channels.cache.find(ch => {
                if (ch.isTextBased() && !ch.isThread() && ch.viewable) {
                    const perms = ch.permissionsFor(me);
                    if (perms && perms.has(PermissionFlagsBits.SendMessages)) {
                        const name = ch.name.toLowerCase();
                        return channelKeywords.some(keyword => name.includes(keyword));
                    }
                }
                return false;
            });

            if (targetChannel) {
                welcomeChannel = targetChannel;
            } else if (guild.systemChannel && guild.systemChannel.viewable) {
                const perms = guild.systemChannel.permissionsFor(me);
                if (perms && perms.has(PermissionFlagsBits.SendMessages)) {
                    welcomeChannel = guild.systemChannel;
                }
            }
            
            if (!welcomeChannel) {
                const generalKeywords = ['general', 'chat-chung', 'chat', 'luận-kiếm', 'luan-kiem'];
                const foundGeneral = guild.channels.cache.find(ch => {
                    if (ch.isTextBased() && !ch.isThread() && ch.viewable) {
                        const perms = ch.permissionsFor(me);
                        if (perms && perms.has(PermissionFlagsBits.SendMessages)) {
                            const name = ch.name.toLowerCase();
                            return generalKeywords.some(keyword => name.includes(keyword));
                        }
                    }
                    return false;
                });
                if (foundGeneral) {
                    welcomeChannel = foundGeneral;
                }
            }

            if (!welcomeChannel) {
                welcomeChannel = guild.channels.cache.find(ch => {
                    if (ch.isTextBased() && !ch.isThread() && ch.viewable) {
                        const perms = ch.permissionsFor(me);
                        return perms !== null && perms.has(PermissionFlagsBits.SendMessages);
                    }
                    return false;
                });
            }
            
            if (!welcomeChannel) {
                console.log(`[CHÀO MỪNG] Không tìm thấy kênh gửi lời chào mừng tại server: ${guild.name}`);
                return;
            }

            const isRoyal = freshMember.id === '1525389831113539586';
            let welcomeEmbed: EmbedBuilder;
            let claimButtonLabel = "🧧 Nhận 100k Tân Thủ!";
            let claimButtonStyle = ButtonStyle.Danger;
            let welcomeContent = `Chào mừng <@${freshMember.id}> đến với sới bạc! 🎉`;
            let hostsTagStr = "";

            if (isRoyal) {
                // Định danh rõ 2 cá nhân đón Nữ Hoàng
                const host1 = guild.members.cache.find(m => m.user.username.toLowerCase() === 'letoanmoon');
                const host2 = guild.members.cache.find(m => m.user.username.toLowerCase() === 'v2d2823');
                
                const host1Tag = host1 ? `<@${host1.id}>` : `@letoanmoon`;
                const host2Tag = host2 ? `<@${host2.id}>` : `@v2d2823`;

                hostsTagStr = `\n\n💂 **Thần dân cận vệ được chỉ định hầu hạ Nữ Hoàng hôm nay:** ${host1Tag} và ${host2Tag}.\nHai đứa khẩn trương dẫn đường dâng kiệu, sơ suất là bị chém đầu thị chúng! ⚔️`;

                // Lấy danh sách các Admin của Guild
                const admins = guild.members.cache.filter(m => !m.user.bot && m.permissions.has(PermissionFlagsBits.Administrator));
                const adminTags = admins.size > 0 
                    ? Array.from(admins.values()).map(m => `<@${m.id}>`).join(" ") 
                    : "@Administrator";

                welcomeContent = `👑 **NỮ HOÀNG VẠN TUẾ! NỮ HOÀNG TỐI CAO CỦA SÒNG BẠC HẠ CỐ LÂM PHÀM!** 👑\n\n📢 Hỡi hàng ngũ Admin, mau mau quỳ gối nghênh đón Nữ Hoàng quyền lực tối thượng: ${adminTags} *(Đứa nào đón tiếp chậm trễ, cắt lương đi tù ngay!)*`;

                welcomeEmbed = new EmbedBuilder()
                    .setTitle(`👑 CUNG NGHÊNH NỮ HOÀNG TỐI CAO - THÁI HẬU SỜI BẠC GIA NHẬP! 👑`)
                    .setDescription(
                        `🙇‍♂️ Kính cẩn nghiêng mình cúi đầu cung nghênh **Nữ Hoàng ${freshMember.user.username}** (<@${freshMember.id}>) đã hạ giá lâm phàm, ghé thăm vương quốc sới bạc hoàng gia **${guild.name}** (thành viên thứ **${guild.memberCount}** của server)!\n\n` +
                        `Người chính là hiện thân của quyền lực, sự thanh lịch và sang trọng tối thượng. Hào quang lấp lánh của Nữ Hoàng chiếu sáng rực rỡ toàn bộ sòng bài, mang lại vinh hạnh vô bờ bến cho thần dân chúng thần! 👸✨\n\n` +
                        `💰 **CỐNG PHẨM HOÀNG GIA:** Nữ Hoàng hãy nhận lấy bảo vật **1 Tỷ VNĐ** tiền mặt hoàng gia từ ngân khố dâng lên để vi hành càn quét sới bạc!` +
                        hostsTagStr
                    )
                    .setColor(0xF1C40F) // Màu vàng Gold hoàng gia cực đỉnh
                    .setThumbnail(freshMember.user.displayAvatarURL({ size: 256, forceStatic: false }))
                    .setImage('attachment://anh_don_tiep.png') // Tham chiếu tới ảnh đính kèm làm banner trong Embed
                    .addFields(
                        { 
                            name: "👑 CỐNG PHẨM HOÀNG GIA (1 TỶ VNĐ)", 
                            value: "Bấm ngay nút xanh hoàng gia ở dưới để dâng ngay **1.000.000.000 VNĐ** từ ngân khố dâng lên Nữ Hoàng tôn kính!", 
                            inline: false 
                        },
                        { 
                            name: "✨ THÁI HẬU VI HÀNH", 
                            value: "Nữ Hoàng có thể gõ `@BotToan help` để kiểm tra giang sơn, xem các thần dân cờ bạc, lô đề hoặc giải trí.", 
                            inline: false 
                        }
                    )
                    .setFooter({ text: "Kính chúc Nữ Hoàng bách chiến bách thắng, thống trị tối cao! • BotToan Royal Guard", iconURL: freshMember.client.user?.displayAvatarURL() })
                    .setTimestamp();

                claimButtonLabel = "👑 Nhận 1 Tỷ Cống Phẩm Nữ Hoàng!";
                claimButtonStyle = ButtonStyle.Success; // Màu xanh lá hoàng tộc
            } else {
                // Chọn 2 "Tiếp viên tiếp đón" ngẫu nhiên cho thành viên thường
                const activeHosts = guild.members.cache.filter(m => !m.user.bot && m.id !== freshMember.id);
                const hostArray = Array.from(activeHosts.values());
                
                if (hostArray.length > 0) {
                    const count = Math.min(hostArray.length, 2);
                    const tempHosts = [...hostArray];
                    const selected: string[] = [];
                    for (let i = 0; i < count; i++) {
                        const idx = Math.floor(Math.random() * tempHosts.length);
                        selected.push(`<@${tempHosts[idx].id}>`);
                        tempHosts.splice(idx, 1);
                    }
                    hostsTagStr = `\n\n🎲 **Tiếp viên sới bạc được chỉ định đón cưng hôm nay:** ${selected.join(" và ")}.\nHai đứa ra dắt khách vào bàn VIP mau lên, không là cắt lương! 🍾`;
                }

                // Danh sách các câu chào mừng mỏ hỗn / khịa bựa ngẫu nhiên
                const welcomeQuotes = [
                    `Chào mừng con giời **${freshMember.user.username}** (<@${freshMember.id}>) đã tự nguyện nhảy hố vào sới bạc **${guild.name}**! Hiện tại bạn là thành viên thứ **${guild.memberCount}**. Chuẩn bị tinh thần bị xiết nợ nát gáo đi nhé cưng! 💸`,
                    `Phát hiện một con cừu non tên **${freshMember.user.username}** (<@${freshMember.id}>) vừa đi lạc vào hang cọp **${guild.name}** (thành viên thứ **${guild.memberCount}**)! Sòng bài đang thiếu chân rửa chén quét nhà, vô bàn ngồi để các ma cũ vặt lông nhanh lên! 🐑`,
                    `Ôi chu cha mạ ơi, lại có thêm một con nợ tiềm năng tên **${freshMember.user.username}** (<@${freshMember.id}>) gia nhập bang hội (thành viên thứ **${guild.memberCount}**)! Nhấn nút nhận 100k vốn khởi nghiệp bên dưới rồi cúng ngay vào sới tài xỉu của sếp Toàn đi con! 🤡`,
                    `Ủa ai đây? Lại là một tấm chiếu mới tên **${freshMember.user.username}** (<@${freshMember.id}>) chưa từng trải vừa gia nhập **${guild.name}** (thành viên thứ **${guild.memberCount}**)! Vào đây học cách trốn nợ ngân hàng rồi bị SWAT xích cổ đi tù nha cưng! 🚔`,
                    `Cảnh báo cấp độ đỏ! Một đối tượng có dấu hiệu báo thủ tên **${freshMember.user.username}** (<@${freshMember.id}>) vừa xâm nhập sới bạc (thành viên thứ **${guild.memberCount}**). BotToan sẽ giám sát ví tiền và độ báo của bạn 24/7! 🚨`
                ];
                const randomQuote = welcomeQuotes[Math.floor(Math.random() * welcomeQuotes.length)];

                welcomeEmbed = new EmbedBuilder()
                    .setTitle(`🚨 PHÁT HIỆN TÂN THỦ MỚI GIA NHẬP BĂNG ĐẢNG! 🚨`)
                    .setDescription(randomQuote + hostsTagStr)
                    .setColor(0xE74C3C)
                    .setThumbnail(freshMember.user.displayAvatarURL({ size: 256, forceStatic: false }))
                    .addFields(
                        { 
                            name: "💰 VỐN KHỞI NGHIỆP CƠ BẢN", 
                            value: "Bấm ngay cái nút đỏ **Nhận 100k Tân Thủ** ở dưới để có tiền đi cúng sòng bạc. Nhớ là chỉ người mới nhận được, ma cũ sờ vào tao đục cho rụng răng! 🤬", 
                            inline: false 
                        },
                        { 
                            name: "📖 CẨM NANG SINH TỒN", 
                            value: "Gõ `@BotToan help` hoặc `@BotToan menu` để xem cẩm nang ăn chơi sa đọa, lô đề cờ bạc, bói toán, ghép đôi của server.", 
                            inline: false 
                        },
                        { 
                            name: "🤖 CHAT AI MỎ HỖN", 
                            value: "Tag `@BotToan [nội dung]` để nói chuyện trực tiếp với AI trợ lý mỏ hỗn. Chuẩn bị sẵn mũ bảo hiểm vì tao khịa cực gắt! 🪖", 
                            inline: false 
                        }
                    )
                    .setFooter({ text: "Chúc bạn may mắn không bị xiết nợ đi tù! • BotToan Casino Guard", iconURL: freshMember.client.user?.displayAvatarURL() })
                    .setTimestamp();
            }

            // Tạo Nút tương tác nhận quà tân thủ
            const claimButton = new ButtonBuilder()
                .setCustomId(`welcome_claim_${freshMember.id}`)
                .setLabel(claimButtonLabel)
                .setStyle(claimButtonStyle);

            // Nút xem hướng dẫn nhanh
            const guideButton = new ButtonBuilder()
                .setCustomId(`welcome_guide`)
                .setLabel("📖 Hướng Dẫn Nhanh")
                .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(claimButton, guideButton);

            // Kiểm tra và đính kèm tệp phương tiện tương ứng
            const files: any[] = [];
            if (isRoyal) {
                const imagePath = path.join(__dirname, '../../assets/anh_don_tiep.png');
                if (fs.existsSync(imagePath)) {
                    files.push({ attachment: imagePath, name: 'anh_don_tiep.png' });
                }
            } else {
                const videoPath = path.join(__dirname, '../../assets/Pewpew_hi_ch_o_c_u.mp4');
                if (fs.existsSync(videoPath)) {
                    files.push(videoPath);
                }
            }

            await welcomeChannel.send({
                content: welcomeContent,
                embeds: [welcomeEmbed],
                components: [row],
                files: files
            });
            
            console.log(`[CHÀO MỪNG] Đã gửi tin nhắn chào mừng và nút bấm lì xì cho ${freshMember.user.tag}`);
            
        } catch (error) {
            console.error("[CHÀO MỪNG LỖI] Lỗi gửi tin nhắn chào mừng thành viên mới:", error);
        }
    });

    // 2. LẮNG NGHE TƯƠNG TÁC NÚT BẤM NHẬN LÌ XÌ VÀ HƯỚNG DẪN
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;
        
        const customId = interaction.customId;
        if (!customId) return;

        // Xử lý nút bấm Hướng Dẫn Nhanh
        if (customId === 'welcome_guide') {
            const guideEmbed = new EmbedBuilder()
                .setTitle("📜 HƯỚNG DẪN SINH TỒN NHANH TRÊN SERVER")
                .setDescription("Chào cưng! Dưới đây là 5 lệnh quyền lực nhất để cày cuốc hoặc tấu hài cùng BotToan:")
                .setColor(0x3498DB)
                .addFields(
                    { name: "1. 💵 Điểm Danh Hàng Ngày", value: "Tag `@BotToan diem danh` hoặc `@BotToan daily` để nhận vốn từ 10k - 50k mỗi ngày.", inline: false },
                    { name: "2. 🏦 Kiểm Tra Ví & Tài Sản", value: "Tag `@BotToan vi` hoặc `@BotToan tai san` để xem số dư và nợ nần đang gánh.", inline: false },
                    { name: "3. 🎲 Casino Đỏ Đen (Tương tác nút)", value: "Tag `@BotToan tai xiu` hoặc `@BotToan blackjack` để bắt đầu sới bạc gỡ nợ.", inline: false },
                    { name: "4. 🤖 Trò Chuyện Với AI Mỏ Hỗn", value: "Tag `@BotToan [nội dung]` để tâm sự mỏng cùng Gemini AI.", inline: false },
                    { name: "5. 📖 Xem Cẩm Nang Chi Tiết", value: "Tag `@BotToan help` để mở cẩm nang đầy đủ tất cả các tính năng.", inline: false }
                )
                .setFooter({ text: "Chúc bạn may mắn không phải bán nhà bán cửa! • BotToan User Guide" })
                .setTimestamp();

            await interaction.reply({
                embeds: [guideEmbed],
                ephemeral: true
            }).catch(() => {});
            return;
        }

        if (!customId.startsWith('welcome_claim_')) return;
        
        const targetUserId = customId.replace('welcome_claim_', '');
        const clickerId = interaction.user.id;
        
        // Chống hôi của
        if (clickerId !== targetUserId) {
            await interaction.reply({
                content: `💀 **TIỀN TÂN THỦ MÀ CŨNG GIÀNH GIẬT HẢ MỌC TÓC ƠI?** Né ra cho người ta nhận, nghèo quá thì gõ \`@BotToan diem danh\` chứ đừng đi cướp giật! 🙄`,
                ephemeral: true
            }).catch(() => {});
            return;
        }
        
        // Thực hiện nhận quà trong database
        await interaction.deferReply({ ephemeral: true });
        
        try {
            const dbResult = await claimWelcomeGift(clickerId);
            
            if (!dbResult.success) {
                await interaction.editReply({ content: dbResult.message }).catch(() => {});
                return;
            }
            
            // Nhận thành công, đổi nút sang disabled xám, giữ nút guide nguyên vẹn
            const isRoyalClick = clickerId === '1525389831113539586';
            const disabledButton = new ButtonBuilder()
                .setCustomId(customId)
                .setLabel(isRoyalClick ? "👑 Đã nhận 1 Tỷ Hoàng Gia!" : "🧧 Đã nhận 100k Tân Thủ!")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true);

            const guideButton = new ButtonBuilder()
                .setCustomId(`welcome_guide`)
                .setLabel("📖 Hướng Dẫn Nhanh")
                .setStyle(ButtonStyle.Primary);
            
            const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(disabledButton, guideButton);
            
            // Sửa tin nhắn gốc để cập nhật nút bấm một cách an toàn
            if (interaction.message && interaction.message.editable) {
                await interaction.message.edit({
                    components: [disabledRow]
                }).catch((err) => console.error("Lỗi khi cập nhật nút bấm chào mừng:", err));
            }
            
            const successFollowUp = isRoyalClick
                ? `${dbResult.message}\n👉 Đức Vua tối cao đã nắm giữ vương quyền tài sản khổng lồ. Chúng thần kính mời Người vi hành càn quét toàn bộ sới bạc hoàng gia!`
                : `${dbResult.message}\n👉 Có vốn rồi, ra bàn tài xỉu hay xóc đĩa làm vài ván gỡ nợ đi cưng!`;

            await interaction.editReply({
                content: successFollowUp
            }).catch(() => {});
            
        } catch (err) {
            console.error("[LÌ XÌ TÂN THỦ LỖI]:", err);
            await interaction.editReply({ content: "❌ Đã xảy ra lỗi hệ thống khi nhận quà. Thử lại sau nhé cưng!" }).catch(() => {});
        }
    });
}
