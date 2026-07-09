import { Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, PermissionFlagsBits } from 'discord.js';
import { 
    addWCMatch, lockWCMatch, placeWCBet, settleWCMatch, 
    getActiveWCMatches, getWCMatch, getProfile, getBalance, updateBalance 
} from '../database';
import { getWCPrediction } from '../services/gemini';
import { sleep, formatMoney, parseMoneyInput } from '../utils';
import { 
    joinVoiceChannel, createAudioPlayer, createAudioResource, 
    AudioPlayerStatus, VoiceConnectionStatus, entersState, getVoiceConnection 
} from '@discordjs/voice';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Lệnh Tiên tri World Cup của Gemini AI
 */
export async function handleWCPrediction(message: Message, rawInput: string) {
    // Phân tích đội đấu: "@BotToan tientri Vietnam vs Thailand"
    const content = rawInput.replace(/^(tientri|tien tri|predict)\s*/i, '').trim();
    if (!content) {
        await message.reply("❌ **THIẾU THÔNG TIN!** Gõ tên 2 đội cần tiên tri. Ví dụ: `@BotToan tientri Argentina vs Phap`.").catch(() => {});
        return;
    }

    const parts = content.split(/\s+vs\s+|\s+va\s+|\-/i);
    if (parts.length < 2) {
        await message.reply("❌ **SAI CÚ PHÁP!** Phải ghi rõ 2 đội đấu (Ví dụ: `Argentina vs Phap` hoặc `Duc - Tay Ban Nha`).").catch(() => {});
        return;
    }

    const teamA = parts[0].trim();
    const teamB = parts[1].trim();

    // Lấy đại từ nhân xưng giới tính từ DB
    const profile = await getProfile(message.author.id).catch(() => null);
    let pronoun = "thí chủ";
    if (profile && profile.gender) {
        if (profile.gender === "Nam") {
            pronoun = "thằng báo thủ này";
        } else if (profile.gender === "Nữ") {
            pronoun = "con báo thủ này";
        }
    }

    const statusMsg = await message.reply(`🔮 **Nhà tiên tri BotToan đang gieo quẻ bóng đêm cho trận đấu ${teamA} vs ${teamB}...**`).catch(() => null);
    await sleep(2500);

    try {
        const prediction = await getWCPrediction(teamA, teamB, pronoun);
        
        const embed = new EmbedBuilder()
            .setTitle(`🔮 TIÊN TRI WORLD CUP: ${teamA} VS ${teamB}`)
            .setDescription(prediction)
            .setColor(0xF1C40F)
            .setThumbnail(message.client.user?.displayAvatarURL() || null)
            .setFooter({ text: "Nhà tiên tri vô tri BotToan - World Cup 2026", iconURL: message.client.user?.displayAvatarURL() })
            .setTimestamp();

        if (statusMsg) await statusMsg.delete().catch(() => {});
        await message.reply({ embeds: [embed] }).catch(() => {});
    } catch (err) {
        console.error("Lỗi tiên tri World Cup:", err);
        if (statusMsg) {
            await statusMsg.edit("❌ **LÔI ĐIỆN TỬ:** Tiên tri đang bị đau bụng, gieo quẻ thất bại!").catch(() => {});
        }
    }
}

/**
 * Trò chơi sút penalty World Cup (@BotToan sut [tiền])
 */
export async function playWCPenalty(message: Message, rawInput: string) {
    if (!message.guild) {
        await message.reply("❌ Lệnh này chỉ dùng được trong server thôi nha cưng!").catch(() => {});
        return;
    }

    // Phân tích tiền cược
    const arg = rawInput.replace(/^(sut|penalty)\s*/i, '').trim();
    let betAmount = arg ? parseMoneyInput(arg) : 20; // mặc định 20k

    if (betAmount === null || isNaN(betAmount) || betAmount <= 0) {
        betAmount = 20;
    }

    // Giới hạn tiền cược từ 10k - 50k
    if (betAmount < 10 || betAmount > 50) {
        await message.reply("❌ **Giới hạn cược sút phạt đền:** Từ **10k** đến **50k** thôi cưng!").catch(() => {});
        return;
    }

    const userId = message.author.id;
    const balance = await getBalance(userId);

    if (balance < betAmount) {
        await message.reply(`❌ **Nghèo mà đòi đá phạt đền!** Số dư của bạn chỉ còn **${formatMoney(balance)}**, không đủ để đặt cược **${formatMoney(betAmount)}**!`).catch(() => {});
        return;
    }

    // Khấu trừ tiền cược trước để đảm bảo chống cheat
    await updateBalance(userId, balance - betAmount);

    let audioConnection: any = null;
    let voiceMessage = "";

    const userVoiceChannel = message.member?.voice.channel;
    if (userVoiceChannel) {
        const existingConnection = getVoiceConnection(message.guild.id);
        if (existingConnection) {
            voiceMessage = "\n\n🎙️ *Anh đang bận sang phòng kia làm trọng tài rồi, sút không nhạc nhé cưng!*";
        } else {
            try {
                const audioPath = path.join(__dirname, '../../audio', 'nhacWC.mp3');
                if (fs.existsSync(audioPath)) {
                    audioConnection = joinVoiceChannel({
                        channelId: userVoiceChannel.id,
                        guildId: message.guild.id,
                        adapterCreator: message.guild.voiceAdapterCreator,
                    });
                    
                    await entersState(audioConnection, VoiceConnectionStatus.Ready, 5000);
                    const player = createAudioPlayer();
                    player.play(createAudioResource(audioPath));
                    audioConnection.subscribe(player);
                }
            } catch (err) {
                console.error("Lỗi phát nhạc WC penalty:", err);
            }
        }
    }

    const embed = new EmbedBuilder()
        .setTitle("⚽ ĐẤT DIỄN ĐÁ PHẠT ĐỀN - WORLD CUP 2026")
        .setDescription(
            `Đối mặt với thủ môn huyền thoại **BotToan**. Mày có cơ hội sút phạt đền kiếm tiền thưởng!\n` +
            `💰 **Tiền cược:** **${formatMoney(betAmount)}**\n` +
            `👉 Hãy click chọn hướng sút bên dưới trong 30 giây để bóp cò!${voiceMessage}`
        )
        .setColor(0x2ECC71)
        .setThumbnail(message.author.displayAvatarURL());

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('pen_left').setLabel('⚽ Sút Trái').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('pen_center').setLabel('⚽ Sút Giữa').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('pen_right').setLabel('⚽ Sút Phải').setStyle(ButtonStyle.Danger)
    );

    const gameMsg = await message.reply({ embeds: [embed], components: [row] }).catch(() => null);
    if (!gameMsg) return;

    const collector = gameMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 30000
    });

    collector.on('collect', async (interaction) => {
        if (interaction.user.id !== userId) {
            await interaction.reply({ content: "❌ **Không phải quả phạt đền của bạn!** Để cho đồng bọn tự thực hiện loạt sút! 🙄", ephemeral: true }).catch(() => {});
            return;
        }

        await interaction.deferUpdate().catch(() => {});
        collector.stop('shot');

        const buttonId = interaction.customId;
        let playerChoice = "";
        if (buttonId === 'pen_left') playerChoice = "Trái";
        else if (buttonId === 'pen_center') playerChoice = "Giữa";
        else playerChoice = "Phải";

        // Vô hiệu hóa nút bấm ngay lập tức
        const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('pen_left').setLabel('⚽ Sút Trái').setStyle(ButtonStyle.Primary).setDisabled(true),
            new ButtonBuilder().setCustomId('pen_center').setLabel('⚽ Sút Giữa').setStyle(ButtonStyle.Success).setDisabled(true),
            new ButtonBuilder().setCustomId('pen_right').setLabel('⚽ Sút Phải').setStyle(ButtonStyle.Danger).setDisabled(true)
        );

        // Ngắt kết nối voice ngay khi sút xong
        if (audioConnection) {
            try {
                audioConnection.destroy();
            } catch (err) {}
        }

        // Chọn hướng bay ngẫu nhiên của thủ môn
        const directions = ["Trái", "Giữa", "Phải"];
        const botChoice = directions[Math.floor(Math.random() * directions.length)];

        // Tỉ lệ 10% sút đập cột dọc/xà ngang dội ra
        const isHitPost = Math.random() < 0.10;

        let resultTitle = "";
        let resultDesc = "";
        let color = 0x00FF00;

        if (isHitPost) {
            // Hoàn trả 100% tiền cược
            const currentBal = await getBalance(userId);
            await updateBalance(userId, currentBal + betAmount);

            resultTitle = "🔔 CỘT DỌC/XÀ NGANG DỘI RA! (Hoàn tiền 100%)";
            resultDesc = `💥 Bùm! Loạt sút của bạn hướng về phía **${playerChoice}** đã dội trúng cột dọc dội ra ngoài!\nThủ môn BotToan chỉ biết đứng nhìn thở phào nhẹ nhõm.\n💰 Tòa trả lại **${formatMoney(betAmount)}** tiền cược cho bạn.`;
            color = 0xF1C40F;
        } else if (playerChoice === botChoice) {
            // Thua cược (mất tiền đã khấu trừ)
            resultTitle = "❌ BỊ THỦ MÔN CẢN PHÁ! (Thua cược)";
            resultDesc = `🧤 Ôi không! Bạn sút về hướng **${playerChoice}**, và thủ môn BotToan đã xuất thần bay người cản phá thành công!\n💬 *Lời khịa:* "Sút thế thì chỉ có đi chăn bò thôi em ơi!"\n💸 Bạn mất sạch **${formatMoney(betAmount)}** cược.`;
            color = 0xE74C3C;
        } else {
            // Thắng cược (cộng gấp đôi)
            const currentBal = await getBalance(userId);
            await updateBalance(userId, currentBal + (betAmount * 2));

            resultTitle = "⚽ VÀOOOOOO! GÔN RUNG LÊN! (Thắng x2)";
            resultDesc = `🎉 Tuyệt cú mèo! Bạn sút sang **${playerChoice}** trong khi thủ môn BotToan bay người sang **${botChoice}**!\nLưới đã rung lên bần bật trong tiếng hò reo vang dội của khán giả World Cup!\n💰 Bạn thắng cược và húp về **${formatMoney(betAmount * 2)}**!`;
            color = 0x2ECC71;
        }

        const resultEmbed = new EmbedBuilder()
            .setTitle(resultTitle)
            .setDescription(resultDesc)
            .setColor(color)
            .addFields(
                { name: "🎯 Hướng sút của bạn", value: `**${playerChoice}**`, inline: true },
                { name: "🧤 Thủ môn BotToan bay", value: `**${botChoice}**`, inline: true }
            )
            .setThumbnail(message.author.displayAvatarURL())
            .setFooter({ text: "Sút penalty sòng bạc World Cup 2026" });

        await gameMsg.edit({ embeds: [resultEmbed], components: [disabledRow] }).catch(() => {});
    });

    collector.on('end', async (collected, reason) => {
        if (reason === 'time') {
            if (audioConnection) {
                try {
                    audioConnection.destroy();
                } catch (err) {}
            }
            
            const timeoutRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('pen_left').setLabel('Sút Trái').setStyle(ButtonStyle.Primary).setDisabled(true),
                new ButtonBuilder().setCustomId('pen_center').setLabel('Sút Giữa').setStyle(ButtonStyle.Success).setDisabled(true),
                new ButtonBuilder().setCustomId('pen_right').setLabel('Sút Phải').setStyle(ButtonStyle.Danger).setDisabled(true)
            );

            const timeoutEmbed = new EmbedBuilder()
                .setTitle("⏰ QUÁ HẠN SÚT PHẠT ĐỀN")
                .setDescription(`⏰ Hết giờ! Bạn đã suy nghĩ quá lâu (30 giây) để thực hiện cú sút.\nThủ môn BotToan đã nhặt bóng đi về và tịch thu **${formatMoney(betAmount)}** tiền cược của bạn làm phí sân cỏ.`)
                .setColor(0x7F8C8D);

            await gameMsg.edit({ embeds: [timeoutEmbed], components: [timeoutRow] }).catch(() => {});
        }
    });
}

/**
 * Xử lý lệnh World Cup (@BotToan wc, bat, setwc, chungwc, lockwc)
 */
export async function handleWCCommand(message: Message, rawInput: string) {
    const args = rawInput.trim().split(/\s+/);
    const subCommand = args[0]?.toLowerCase();

    // 1. Lệnh Đặt Cược: @BotToan bat [mã_trận] [A/B] [tiền]
    if (subCommand === 'bat' || subCommand === 'bet') {
        const matchId = args[1]?.toLowerCase();
        const choice = args[2]?.toUpperCase(); // A hoặc B
        const moneyArg = args[3];

        if (!matchId || !choice || !moneyArg) {
            await message.reply("❌ **Sai cú pháp!** Cú pháp đặt cược: `@BotToan bat [mã_trận] [A/B] [số_tiền]`.\nVí dụ: `@BotToan bat v1 A 50k` (đặt 50k vào Đội A của trận v1).").catch(() => {});
            return;
        }

        if (choice !== 'A' && choice !== 'B') {
            await message.reply("❌ **Cửa đặt cược không hợp lệ!** Chọn cửa `A` (Đội A) hoặc `B` (Đội B) thôi cưng!").catch(() => {});
            return;
        }

        const amount = parseMoneyInput(moneyArg);
        if (amount === null || isNaN(amount) || amount <= 0) {
            await message.reply("❌ **Số tiền đặt cược không hợp lệ!** Ví dụ cược: `50k`, `100k`, `1.5tr`...").catch(() => {});
            return;
        }

        const res = await placeWCBet(message.author.id, matchId, choice, amount);
        await message.reply(res.message).catch(() => {});
        return;
    }

    // 2. Lệnh Admin mở kèo: @BotToan setwc [mã_trận] [Đội A] [Đội B] [Tỉ lệ kèo]
    if (subCommand === 'setwc') {
        const isAdmin = message.member?.permissions.has(PermissionFlagsBits.Administrator);
        if (!isAdmin) {
            await message.reply("❌ **ĐÉO CÓ QUYỀN!** Quyền mở kèo chỉ dành cho Admin thôi nhé cưng!").catch(() => {});
            return;
        }

        const matchId = args[1]?.toLowerCase();
        const teamA = args[2];
        const teamB = args[3];
        const odds = args.slice(4).join(" "); // Kèo chấp, tỷ lệ

        if (!matchId || !teamA || !teamB || !odds) {
            await message.reply("❌ **Sai cú pháp!** Cách mở kèo: `@BotToan setwc [mã_trận] [Đội_A] [Đội_B] [Kèo_chấp_chi_tiết]`.\nVí dụ: `@BotToan setwc v1 Argentina Phap Argentina chấp nửa trái`.").catch(() => {});
            return;
        }

        const success = await addWCMatch(matchId, teamA, teamB, odds);
        if (success) {
            await message.reply(`✅ Mở cược thành công trận đấu **${teamA} vs ${teamB}** (Mã trận: \`${matchId}\`) với tỷ lệ kèo: **${odds}**!`).catch(() => {});
        } else {
            await message.reply("❌ Gặp lỗi khi lưu trận đấu vào cơ sở dữ liệu!").catch(() => {});
        }
        return;
    }

    // 3. Lệnh Admin khóa kèo: @BotToan lockwc [mã_trận]
    if (subCommand === 'lockwc') {
        const isAdmin = message.member?.permissions.has(PermissionFlagsBits.Administrator);
        if (!isAdmin) {
            await message.reply("❌ **ĐÉO CÓ QUYỀN!**").catch(() => {});
            return;
        }

        const matchId = args[1]?.toLowerCase();
        if (!matchId) {
            await message.reply("❌ Nhập mã trận cần khóa cược!").catch(() => {});
            return;
        }

        const success = await lockWCMatch(matchId);
        if (success) {
            await message.reply(`🔒 Đã khóa cửa đặt cược của trận đấu \`${matchId}\` thành công! Cấm đặt thêm cược mới.`).catch(() => {});
        } else {
            await message.reply("❌ Không tìm thấy trận đấu này để khóa!").catch(() => {});
        }
        return;
    }

    // 4. Lệnh Admin chung tiền cược: @BotToan chungwc [mã_trận] [A/B/HoaKeo]
    if (subCommand === 'chungwc' || subCommand === 'chung') {
        const isAdmin = message.member?.permissions.has(PermissionFlagsBits.Administrator);
        if (!isAdmin) {
            await message.reply("❌ **ĐÉO CÓ QUYỀN!**").catch(() => {});
            return;
        }

        const matchId = args[1]?.toLowerCase();
        const winner = args[2]?.toUpperCase(); // A hoặc B hoặc HOAKEO

        if (!matchId || !winner || (winner !== 'A' && winner !== 'B' && winner !== 'HOAKEO')) {
            await message.reply("❌ **Sai cú pháp!** Cú pháp: `@BotToan chungwc [mã_trận] [A / B / HoaKeo]`.\nVí dụ: `@BotToan chungwc v1 A` (Chung tiền cược cho Đội A thắng kèo) hoặc `@BotToan chungwc v1 HoaKeo` (Hòa kèo, hoàn tiền 100%).").catch(() => {});
            return;
        }

        const result = await settleWCMatch(matchId, winner as 'A' | 'B' | 'HoaKeo');
        await message.reply(result.message).catch(() => {});
        return;
    }

    // 5. Mặc định: Xem bảng cược hiện tại (@BotToan wc)
    const matches = await getActiveWCMatches();
    if (matches.length === 0) {
        await message.reply("🏟️ **WORLD CUP 2026:** Hiện chưa có trận đấu nào được mở cược. Admin ơi mở cược mau đi chứ!").catch(() => {});
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle("🏟️ BẢNG TỶ LỆ CÁ CƯỢC WORLD CUP 2026")
        .setDescription(
            `Chào mừng đến với sòng cá cược World Cup ảo của BotToan!\n` +
            `👉 Hãy dùng lệnh cược: \`@BotToan bat [mã_trận] [A/B] [tiền]\` để bắt kèo.`
        )
        .setColor(0xF1C40F)
        .setFooter({ text: "BotToan Bookmaker - World Cup 2026 Edition" })
        .setTimestamp();

    for (const m of matches) {
        const statusEmoji = m.status === 'open' ? '🟢 Đang mở' : '🔒 Đã khóa cược';
        embed.addFields({
            name: `⚽ Trận \`${m.matchId}\`: ${m.teamA} vs ${m.teamB} (${statusEmoji})`,
            value: `• **Cửa A:** ${m.teamA} | **Cửa B:** ${m.teamB}\n• **Kèo chấp:** *${m.odds}*`,
            inline: false
        });
    }

    await message.reply({ embeds: [embed] }).catch(() => {});
}
