import { Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { 
    addWCMatch, lockWCMatch, placeWCBet, settleWCMatch, 
    getActiveWCMatches, getWCMatch, getProfile, getBalance, updateBalance,
    getAllWCMatches, updateWCMatch, deleteWCMatch, getUserWCBets, getActiveWCBets
} from '../database';
import { getWCPrediction } from '../services/gemini';
import { sleep, formatMoney, parseMoneyInput, removeAccents } from '../utils';
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
        try {
            const existingConnection = getVoiceConnection(message.guild.id);
            if (existingConnection) {
                try {
                    existingConnection.destroy();
                } catch (err) {}
            }

            const audioPath = path.join(__dirname, '../../audio', 'nhacWC.mp3');
            if (fs.existsSync(audioPath)) {
                audioConnection = joinVoiceChannel({
                    channelId: userVoiceChannel.id,
                    guildId: message.guild.id,
                    adapterCreator: message.guild.voiceAdapterCreator,
                    selfDeaf: false,
                    selfMute: false,
                });
                
                await entersState(audioConnection, VoiceConnectionStatus.Ready, 5000);
                const player = createAudioPlayer();
                player.play(createAudioResource(audioPath));
                audioConnection.subscribe(player);

                player.on('error', err => {
                    console.error("[PENALTY WC AUDIO ERROR]:", err);
                });
            }
        } catch (err) {
            console.error("Lỗi phát nhạc WC penalty:", err);
        }
    }

    const embed = new EmbedBuilder()
        .setTitle("⚽ ĐẤT DIỄN ĐÁ PHẠT ĐỀN - WORLD CUP 2026")
        .setDescription(
            `Đối mặt với thủ môn huyền thoại **BotToan**. Mày có cơ hội sút phạt đền kiếm tiền thưởng!\n` +
            `💰 **Tiền cược:** **${formatMoney(betAmount)}**\n` +
            `👉 Hãy click chọn hướng sút bên dưới trong 30 giây để thực hiện cú sút!${voiceMessage}`
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
            // Trúng cột dọc/xà ngang: Mất tiền cược (không hoàn trả)
            const hitPostMessages = [
                `💥 **Cú sút đi vào lòng đất!** Bạn sút hướng **${playerChoice}**, bóng bay cực căng NHƯNG đập trúng cột dọc dội ngược lại đập thẳng vào mặt bạn! 🤕 Cột dọc cứu thua cho BotToan, bay màu mất sạch **${formatMoney(betAmount)}** cược nhé cưng!`,
                `💥 **Ối dồi ôi!** Cú sút hướng **${playerChoice}** khiến thủ môn BotToan đứng hình chịu chết... NHƯNG bóng đập trúng xà ngang nảy ra ngoài! 😭 Nhân phẩm quá thấp, cột dọc xà ngang gánh còng lưng BotToan rồi. Tiếc nuối mất đi **${formatMoney(betAmount)}**!`,
                `💥 **Trắng tay vì cột dọc!** Bạn sút về hướng **${playerChoice}**, bóng bay trúng cột dọc rồi bay thẳng ra chuồng gà! 🐔 *BotToan khịa:* "Đã nghèo còn gặp cột dọc gánh team. Thôi nạp thêm tiền đi em ơi, mất sạch **${formatMoney(betAmount)}** rồi!"`
            ];
            
            resultTitle = "💥 CỘT DỌC/XÀ NGANG CỨU THUA! (Thua cược)";
            resultDesc = hitPostMessages[Math.floor(Math.random() * hitPostMessages.length)];
            color = 0xF1C40F; // Màu cam cảnh báo
        } else if (playerChoice === botChoice) {
            // Thua cược (mất tiền đã khấu trừ)
            const savedMessages = [
                `🧤 **Bị tóm gọn quả bóng!** Bạn sút hướng **${playerChoice}**, thủ môn BotToan bay người nhẹ nhàng ôm gọn trái bóng như ôm người yêu cũ! 🤡 *Khịa:* "Đá nhẹ thế này thì về quê chăn vịt đi em ơi!", mất sạch **${formatMoney(betAmount)}**!`,
                `🧤 **Bắt bài quá dễ!** Bạn sút hướng **${playerChoice}**, BotToan chỉ cần nhấc nhẹ cái chân là cản phá thành công! 🦵 *Khịa:* "Đọc vị như đọc sách giáo khoa cấp 1. Nộp **${formatMoney(betAmount)}** cống nạp cho nhà cái lẹ đi cưng!"`,
                `🧤 **Hết cứu!** Cú sút hướng **${playerChoice}** quá hiền lành, BotToan bay người cản phá xuất thần! 🧤 *Khịa:* "Sút thế này thì đến thủ môn mù cũng đỡ được. Mất trắng **${formatMoney(betAmount)}** cược nhé bạn yêu!"`
            ];

            resultTitle = "❌ BỊ THỦ MÔN CẢN PHÁ! (Thua cược)";
            resultDesc = savedMessages[Math.floor(Math.random() * savedMessages.length)];
            color = 0xE74C3C;
        } else {
            // Thắng cược (cộng gấp đôi)
            const currentBal = await getBalance(userId);
            await updateBalance(userId, currentBal + (betAmount * 2));

            const goalMessages = [
                `🎉 **VÀOOOOOO! Đỉnh nóc kịch trần!** Bạn sút sang **${playerChoice}**, BotToan bay người ngơ ngác sang **${botChoice}** như kẻ mất sổ gạo! 🤡 Húp trọn **${formatMoney(betAmount * 2)}** cược, uy tín quá em ơi!`,
                `🎉 **Rung lưới ngọt nước!** Cú sút hiểm hóc hướng **${playerChoice}** xé toạc mành lưới trong sự bất lực của BotToan! 🔥 Hốt ngay **${formatMoney(betAmount * 2)}** về ví, hôm nay tổ độ rồi!`,
                `🎉 **Quá đẳng cấp!** Bạn sút hướng **${playerChoice}** đánh lừa hoàn toàn thủ môn BotToan (bay hướng **${botChoice}**)! ⚽ *Tấu hài:* "Bóng bay vào lưới đẹp như tranh vẽ, BotToan chỉ biết đứng nhìn khóc thét!" Thắng cược nhận **${formatMoney(betAmount * 2)}**!`
            ];

            resultTitle = "⚽ VÀOOOOOO! GÔN RUNG LÊN! (Thắng x2)";
            resultDesc = goalMessages[Math.floor(Math.random() * goalMessages.length)];
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
/**
 * Xử lý lệnh World Cup (@BotToan wc, bat, setwc, chungwc, lockwc, editwc, delwc, qlwc)
 */
export async function handleWCCommand(message: Message, rawInput: string) {
    const args = rawInput.trim().split(/\s+/);
    const subCommand = args[0]?.toLowerCase();

    // Lệnh phát nhạc World Cup: @BotToan intro wc hoặc @BotToan wc intro
    const isIntroWC = (subCommand === 'intro' && args[1]?.toLowerCase() === 'wc') || 
                      (subCommand === 'wc' && args[1]?.toLowerCase() === 'intro');
                      
    if (isIntroWC) {
        const userVoiceChannel = message.member?.voice.channel;
        if (!userVoiceChannel) {
            await message.reply("❌ **Bạn phải vào một kênh thoại (voice channel) trước mới nghe nhạc được chứ!**").catch(() => {});
            return;
        }

        if (!message.guild) {
            await message.reply("❌ **Lệnh này chỉ dùng được trong server!**").catch(() => {});
            return;
        }

        const audioPath = path.join(__dirname, '../../audio', 'nhacWC.mp3');
        if (!fs.existsSync(audioPath)) {
            await message.reply("❌ **Không tìm thấy tệp âm thanh `nhacWC.mp3` trong thư mục audio!**").catch(() => {});
            return;
        }

        try {
            // Ngắt kết nối cũ nếu có
            const existingConnection = getVoiceConnection(message.guild.id);
            if (existingConnection) {
                existingConnection.destroy();
            }

            const connection = joinVoiceChannel({
                channelId: userVoiceChannel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
                selfDeaf: false,
                selfMute: false,
            });

            await entersState(connection, VoiceConnectionStatus.Ready, 5000);
            
            const player = createAudioPlayer();
            player.play(createAudioResource(audioPath));
            connection.subscribe(player);

            await message.reply(`🎙️ **Đang phát nhạc World Cup bốc lửa tại kênh thoại \`${userVoiceChannel.name}\`!** ⚽🔥`).catch(() => {});

            player.on(AudioPlayerStatus.Idle, () => {
                player.stop();
                connection.destroy();
            });

            player.on('error', err => {
                console.error("[INTRO WC AUDIO ERROR]:", err);
            });
            
            connection.on('error', err => {
                console.error("[INTRO WC CONNECTION ERROR]:", err);
            });

        } catch (error) {
            console.error("Lỗi khi chạy lệnh intro wc:", error);
            await message.reply("❌ **Gặp lỗi khi kết nối vào kênh thoại để phát nhạc!**").catch(() => {});
        }
        return;
    }

    // 1. Lệnh Đặt Cược: @BotToan bat [mã_trận] [A/B hoặc Tên_Đội] [tiền]
    if (subCommand === 'bat' || subCommand === 'bet') {
        const matchId = args[1]?.toLowerCase();
        const choice = args[2];
        const moneyArg = args[3];

        if (!matchId || !choice || !moneyArg) {
            await message.reply("❌ **Sai cú pháp!** Cú pháp đặt cược: `@BotToan bat [mã_trận] [A/B hoặc Tên_Đội] [số_tiền]`.\nVí dụ:\n- `@BotToan bat v1 A 50k` (đặt 50k vào Đội A)\n- `@BotToan bat v1 Tay Ban Nha 50k` (đặt 50k vào Tây Ban Nha)").catch(() => {});
            return;
        }

        // Lấy thông tin trận đấu để đối chiếu tên đội
        const match = await getWCMatch(matchId);
        if (!match) {
            await message.reply("❌ **Trận đấu này không tồn tại trong hệ thống!**").catch(() => {});
            return;
        }

        let finalChoice: 'A' | 'B' | null = null;
        const upperChoice = choice.toUpperCase();
        
        if (upperChoice === 'A') {
            finalChoice = 'A';
        } else if (upperChoice === 'B') {
            finalChoice = 'B';
        } else {
            // Thử so khớp tên đội (không dấu, không khoảng trắng)
            const cleanChoice = removeAccents(choice).toLowerCase().replace(/\s+/g, '');
            const cleanTeamA = removeAccents(match.teamA).toLowerCase().replace(/\s+/g, '');
            const cleanTeamB = removeAccents(match.teamB).toLowerCase().replace(/\s+/g, '');

            if (cleanChoice === cleanTeamA || cleanTeamA.includes(cleanChoice)) {
                finalChoice = 'A';
            } else if (cleanChoice === cleanTeamB || cleanTeamB.includes(cleanChoice)) {
                finalChoice = 'B';
            }
        }

        if (!finalChoice) {
            await message.reply(`❌ **Cửa đặt cược không hợp lệ!** Chọn cửa \`A\` (${match.teamA}), \`B\` (${match.teamB}) hoặc gõ đúng tên đội bóng nhé cưng!`).catch(() => {});
            return;
        }

        const amount = parseMoneyInput(moneyArg);
        if (amount === null || isNaN(amount) || amount <= 0) {
            await message.reply("❌ **Số tiền đặt cược không hợp lệ!** Ví dụ cược: `50k`, `100k`, `1.5tr`...").catch(() => {});
            return;
        }

        const res = await placeWCBet(message.author.id, matchId, finalChoice, amount);
        await message.reply(res.message).catch(() => {});
        return;
    }

    // 2. Lệnh Admin mở kèo: @BotToan setwc [mã_trận] [Đội_A] vs [Đội_B] | [Kèo_chấp]
    if (subCommand === 'setwc') {
        const isAdmin = message.member?.permissions.has(PermissionFlagsBits.Administrator);
        if (!isAdmin) {
            await message.reply("❌ **ĐÉO CÓ QUYỀN!** Quyền mở kèo chỉ dành cho Admin thôi nhé cưng!").catch(() => {});
            return;
        }

        const cmdText = rawInput.replace(/^setwc\s+/i, '').trim();
        const pipeParts = cmdText.split('|');
        
        const odds = pipeParts[1]?.trim() || "";
        const matchAndTeams = pipeParts[0].trim();

        const firstSpaceIdx = matchAndTeams.indexOf(' ');
        if (firstSpaceIdx === -1 || !odds) {
            await message.reply("❌ **Sai cú pháp!** Cách mở kèo:\n`@BotToan setwc [mã_trận] [Đội_A] vs [Đội_B] | [Kèo_chấp]`\nVí dụ: `@BotToan setwc v1 Tây Ban Nha vs Bỉ | Tây Ban Nha chấp 1 trái`").catch(() => {});
            return;
        }

        const matchId = matchAndTeams.substring(0, firstSpaceIdx).trim().toLowerCase();
        const teamsText = matchAndTeams.substring(firstSpaceIdx).trim();

        const vsParts = teamsText.split(/\s+vs\s+/i);
        if (vsParts.length < 2 || !vsParts[0].trim() || !vsParts[1].trim()) {
            await message.reply("❌ **Sai cú pháp!** Hãy sử dụng từ khóa `vs` để phân tách hai đội.\nVí dụ: `@BotToan setwc v1 Tây Ban Nha vs Bỉ | Tây Ban Nha chấp 1 trái`").catch(() => {});
            return;
        }

        const teamA = vsParts[0].trim();
        const teamB = vsParts[1].trim();

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
            await message.reply("❌ **ĐÉO CÓ QUYỀN!** Quyền khóa cược chỉ dành cho Admin cưng nhé!").catch(() => {});
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
            await message.reply("❌ **ĐÉO CÓ QUYỀN!** Quyền chung tiền chỉ dành cho Admin cưng nhé!").catch(() => {});
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

    // 5. Lệnh Admin chỉnh sửa kèo: @BotToan editwc [mã_trận] [Đội_A] vs [Đội_B] | [Kèo_chấp]
    if (subCommand === 'editwc') {
        const isAdmin = message.member?.permissions.has(PermissionFlagsBits.Administrator);
        if (!isAdmin) {
            await message.reply("❌ **ĐÉO CÓ QUYỀN!** Quyền chỉnh sửa kèo chỉ dành cho Admin thôi nhé cưng!").catch(() => {});
            return;
        }

        const cmdText = rawInput.replace(/^editwc\s+/i, '').trim();
        const pipeParts = cmdText.split('|');
        
        const odds = pipeParts[1]?.trim() || "";
        const matchAndTeams = pipeParts[0].trim();

        const firstSpaceIdx = matchAndTeams.indexOf(' ');
        if (firstSpaceIdx === -1 || !odds) {
            await message.reply("❌ **Sai cú pháp!** Cách sửa kèo:\n`@BotToan editwc [mã_trận] [Đội_A] vs [Đội_B] | [Kèo_chấp]`\nVí dụ: `@BotToan editwc v1 Tây Ban Nha vs Bỉ | Tây Ban Nha chấp 1.25 trái`").catch(() => {});
            return;
        }

        const matchId = matchAndTeams.substring(0, firstSpaceIdx).trim().toLowerCase();
        
        // Kiểm tra xem trận đấu có tồn tại không và trạng thái của nó
        const match = await getWCMatch(matchId);
        if (!match) {
            await message.reply("❌ Trận đấu này không tồn tại trong hệ thống!").catch(() => {});
            return;
        }
        if (match.status !== 'open') {
            await message.reply(`❌ Trận đấu hiện tại đã **${match.status === 'locked' ? 'khóa đặt cược' : 'kết thúc'}**, không được phép chỉnh sửa nữa cưng nhé! 🙄`).catch(() => {});
            return;
        }

        const teamsText = matchAndTeams.substring(firstSpaceIdx).trim();
        const vsParts = teamsText.split(/\s+vs\s+/i);
        if (vsParts.length < 2 || !vsParts[0].trim() || !vsParts[1].trim()) {
            await message.reply("❌ **Sai cú pháp!** Hãy sử dụng từ khóa `vs` để phân tách hai đội.\nVí dụ: `@BotToan editwc v1 Tây Ban Nha vs Bỉ | Tây Ban Nha chấp 1.25 trái`").catch(() => {});
            return;
        }

        const teamA = vsParts[0].trim();
        const teamB = vsParts[1].trim();

        const success = await updateWCMatch(matchId, teamA, teamB, odds);
        if (success) {
            await message.reply(`✅ Cập nhật thành công thông tin trận đấu \`${matchId}\`:\n👉 **${teamA} vs ${teamB}** với tỷ lệ kèo mới: **${odds}**!`).catch(() => {});
        } else {
            await message.reply("❌ Gặp lỗi khi cập nhật trận đấu!").catch(() => {});
        }
        return;
    }

    // 6. Lệnh Admin xóa kèo (Hoàn tiền): @BotToan delwc [mã_trận] hoặc @BotToan xoawc [mã_trận]
    if (subCommand === 'delwc' || subCommand === 'xoawc') {
        const isAdmin = message.member?.permissions.has(PermissionFlagsBits.Administrator);
        if (!isAdmin) {
            await message.reply("❌ **ĐÉO CÓ QUYỀN!** Quyền xóa kèo chỉ dành cho Admin cưng nhé!").catch(() => {});
            return;
        }

        const matchId = args[1]?.toLowerCase();
        if (!matchId) {
            await message.reply("❌ Nhập mã trận cần xóa! Ví dụ: `@BotToan delwc v1`").catch(() => {});
            return;
        }

        const result = await deleteWCMatch(matchId);
        if (result.success) {
            let msg = `🗑️ Đã xóa hoàn toàn trận đấu \`${matchId}\` khỏi hệ thống!`;
            if (result.refundedBetsCount > 0) {
                msg += `\n💰 Đã hoàn trả tiền cược cho **${result.refundedBetsCount}** lượt cược chưa được chung tiền của trận đấu này.`;
            }
            await message.reply(msg).catch(() => {});
        } else {
            await message.reply(result.message || "❌ Không tìm thấy trận đấu hoặc không thể xóa!").catch(() => {});
        }
        return;
    }

    // 7. Lệnh Admin quản lý trận đấu: @BotToan qlwc hoặc @BotToan listwc
    if (subCommand === 'qlwc' || subCommand === 'listwc') {
        const isAdmin = message.member?.permissions.has(PermissionFlagsBits.Administrator);
        if (!isAdmin) {
            await message.reply("❌ **ĐÉO CÓ QUYỀN!** Quyền quản lý kèo chỉ dành cho Admin cưng nhé!").catch(() => {});
            return;
        }

        const matches = await getAllWCMatches();
        if (matches.length === 0) {
            await message.reply("🏟️ **WORLD CUP 2026:** Chưa có trận đấu nào được tạo trong hệ thống. Admin hãy dùng lệnh \`@BotToan setwc\` để tạo kèo.").catch(() => {});
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle("⚙️ BẢNG QUẢN LÝ TRẬN ĐẤU WORLD CUP 2026")
            .setDescription("Danh sách tất cả các trận đấu hiện có trong hệ thống và trạng thái:")
            .setColor(0xE74C3C)
            .setFooter({ text: "BotToan System Manager" })
            .setTimestamp();

        for (const m of matches) {
            let statusText = "";
            if (m.status === 'open') statusText = "🟢 Đang mở đặt cược";
            else if (m.status === 'locked') statusText = "🔒 Đã khóa đặt cược";
            else if (m.status === 'ended') statusText = `🏁 Đã kết thúc (Thắng kèo: **${m.winner === 'HoaKeo' ? 'Hòa Kèo' : (m.winner === 'A' ? m.teamA : m.teamB)}**)`;

            embed.addFields({
                name: `⚽ Trận \`${m.matchId}\`: ${m.teamA} vs ${m.teamB}`,
                value: `• **Trạng thái:** ${statusText}\n• **Cửa A:** ${m.teamA} | **Cửa B:** ${m.teamB}\n• **Kèo chấp:** *${m.odds}*`,
                inline: false
            });
        }

        await message.reply({ embeds: [embed] }).catch(() => {});
        return;
    }

    // 8. Mặc định: Xem bảng cược hiện tại dành cho thành viên (@BotToan wc)
    const authorId = message.author.id;
    const page = await getWCHomePage(authorId);
    await message.reply(page).catch(() => {});
}

/**
 * Trả về trang chủ World Cup dành cho người chơi
 */
export async function getWCHomePage(authorId: string): Promise<{ embeds: EmbedBuilder[], components: ActionRowBuilder<any>[] }> {
    const matches = await getActiveWCMatches();
    
    const embed = new EmbedBuilder()
        .setTitle("🏟️ BẢNG TỶ LỆ CÁ CƯỢC WORLD CUP 2026")
        .setDescription(
            `Chào mừng đến với sòng cá cược World Cup ảo của BotToan!\n` +
            `👉 Hãy dùng dropdown chọn trận đấu để đặt cược hoặc click các nút tra cứu nhanh.`
        )
        .setColor(0xF1C40F)
        .setFooter({ text: "BotToan Bookmaker - World Cup 2026 Edition" })
        .setTimestamp();

    const components: ActionRowBuilder<any>[] = [];

    if (matches.length === 0) {
        embed.setDescription("🏟️ **WORLD CUP 2026:** Hiện chưa có trận đấu nào được mở cược.\nBạn vẫn có thể xem lịch sử cá cược hoặc các cược đang treo bên dưới:");
    } else {
        for (const m of matches) {
            const statusEmoji = m.status === 'open' ? '🟢 Đang mở cược' : '🔒 Đã khóa cược';
            embed.addFields({
                name: `⚽ Trận \`${m.matchId}\`: ${m.teamA} vs ${m.teamB} (${statusEmoji})`,
                value: `• **Cửa A:** ${m.teamA} | **Cửa B:** ${m.teamB}\n• **Kèo chấp:** *${m.odds}*`,
                inline: false
            });
        }

        // Dropdown chọn trận đấu để cược (chỉ lọc trận đang mở cược 'open')
        const openMatches = matches.filter(m => m.status === 'open');
        if (openMatches.length > 0) {
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`wc_select_match_${authorId}`)
                .setPlaceholder("👉 Chọn trận đấu để bắt đầu cược...")
                .addOptions(
                    openMatches.map(m => 
                        new StringSelectMenuOptionBuilder()
                            .setLabel(`Trận ${m.matchId.toUpperCase()}: ${m.teamA} vs ${m.teamB}`)
                            .setDescription(`Kèo chấp: ${m.odds}`)
                            .setValue(m.matchId)
                    )
                );
            components.push(new ActionRowBuilder().addComponents(selectMenu));
        }
    }

    // Nút chức năng chung cho người chơi
    const buttonsRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`wc_btn_history_personal_${authorId}`)
            .setLabel("👤 Lịch sử cược của tôi")
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`wc_btn_active_wagers_${authorId}`)
            .setLabel("📊 Các cược đang treo")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`wc_btn_admin_panel_${authorId}`)
            .setLabel("⚙️ Bảng quản trị")
            .setStyle(ButtonStyle.Secondary)
    );
    components.push(buttonsRow);

    return { embeds: [embed], components };
}

/**
 * Trả về trang chi tiết trận đấu và lựa chọn cược
 */
export async function getWCMatchDetailPage(matchId: string, authorId: string): Promise<{ embeds: EmbedBuilder[], components: ActionRowBuilder<any>[] }> {
    const match = await getWCMatch(matchId);
    
    if (!match) {
        const errEmbed = new EmbedBuilder()
            .setTitle("❌ Trận đấu không tồn tại")
            .setDescription("Trận đấu này không tồn tại hoặc đã bị xóa khỏi hệ thống.")
            .setColor(0xE74C3C);
        const backBtn = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`wc_btn_back_to_list_${authorId}`)
                .setLabel("🔙 Quay lại danh sách")
                .setStyle(ButtonStyle.Secondary)
        );
        return { embeds: [errEmbed], components: [backBtn] };
    }

    const statusEmoji = match.status === 'open' ? '🟢 Đang mở cược' : (match.status === 'locked' ? '🔒 Đã khóa cược' : '🏁 Đã kết thúc');
    const embed = new EmbedBuilder()
        .setTitle(`⚽ CHI TIẾT TRẬN ĐẤU: ${match.teamA} VS ${match.teamB}`)
        .setDescription(
            `• **Mã trận:** \`${match.matchId}\`\n` +
            `• **Trạng thái:** ${statusEmoji}\n` +
            `• **Kèo chấp:** *${match.odds}*\n` +
            `• **Cửa A:** ${match.teamA} (Ăn tỷ lệ tương ứng)\n` +
            `• **Cửa B:** ${match.teamB} (Ăn tỷ lệ tương ứng)\n\n` +
            `👉 Hãy nhấn nút bên dưới để chọn cửa cược và nhập số tiền cược.`
        )
        .setColor(0x3498DB)
        .setFooter({ text: "BotToan Bookmaker" })
        .setTimestamp();

    const components: ActionRowBuilder<any>[] = [];

    // Chỉ cho cược nếu trận đấu đang mở đặt cược
    if (match.status === 'open') {
        const betRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`wc_btn_bet_A_${matchId}_${authorId}`)
                .setLabel(`Cược ${match.teamA} (Cửa A)`)
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`wc_btn_bet_B_${matchId}_${authorId}`)
                .setLabel(`Cược ${match.teamB} (Cửa B)`)
                .setStyle(ButtonStyle.Danger)
        );
        components.push(betRow);
    }

    const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`wc_btn_back_to_list_${authorId}`)
            .setLabel("🔙 Quay lại danh sách")
            .setStyle(ButtonStyle.Secondary)
    );
    components.push(backRow);

    return { embeds: [embed], components };
}

/**
 * Trả về trang quản lý của admin (danh sách tất cả các trận)
 */
export async function getWCAdminHomePage(authorId: string): Promise<{ embeds: EmbedBuilder[], components: ActionRowBuilder<any>[] }> {
    const matches = await getAllWCMatches();
    
    const embed = new EmbedBuilder()
        .setTitle("⚙️ BẢNG QUẢN LÝ TRẬN ĐẤU WORLD CUP 2026")
        .setDescription("Danh sách tất cả các trận đấu hiện có trong hệ thống và trạng thái.\n👉 Chọn một trận đấu từ dropdown bên dưới để tiến hành khóa, sửa, xóa hoặc chung tiền.")
        .setColor(0xE74C3C)
        .setFooter({ text: "BotToan System Manager (Admin View)" })
        .setTimestamp();

    const components: ActionRowBuilder<any>[] = [];

    if (matches.length === 0) {
        embed.setDescription("🏟️ **WORLD CUP 2026:** Chưa có trận đấu nào được tạo trên hệ thống.\nAdmin vui lòng sử dụng lệnh `@BotToan setwc` để tạo trận đấu mới.");
    } else {
        for (const m of matches) {
            let statusText = "";
            if (m.status === 'open') statusText = "🟢 Đang mở đặt cược";
            else if (m.status === 'locked') statusText = "🔒 Đã khóa đặt cược";
            else if (m.status === 'ended') statusText = `🏁 Đã kết thúc (Thắng: **${m.winner === 'HoaKeo' ? 'Hòa Kèo' : (m.winner === 'A' ? m.teamA : m.teamB)}**)`;

            embed.addFields({
                name: `⚽ Trận \`${m.matchId}\`: ${m.teamA} vs ${m.teamB}`,
                value: `• **Trạng thái:** ${statusText}\n• **Kèo chấp:** *${m.odds}*`,
                inline: false
            });
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`wc_admin_select_match_${authorId}`)
            .setPlaceholder("⚙️ Chọn trận đấu cần quản lý...")
            .addOptions(
                matches.map(m => 
                    new StringSelectMenuOptionBuilder()
                        .setLabel(`Trận ${m.matchId.toUpperCase()}: ${m.teamA} vs ${m.teamB}`)
                        .setDescription(`Trạng thái: ${m.status}`)
                        .setValue(m.matchId)
                )
            );
        components.push(new ActionRowBuilder().addComponents(selectMenu));
    }

    const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`wc_btn_back_to_list_${authorId}`)
            .setLabel("🔙 Quay lại giao diện người chơi")
            .setStyle(ButtonStyle.Secondary)
    );
    components.push(backRow);

    return { embeds: [embed], components };
}

/**
 * Trả về trang console điều khiển của Admin cho một trận đấu cụ thể
 */
export async function getWCAdminConsole(matchId: string, authorId: string): Promise<{ embeds: EmbedBuilder[], components: ActionRowBuilder<any>[] }> {
    const match = await getWCMatch(matchId);
    
    if (!match) {
        const errEmbed = new EmbedBuilder()
            .setTitle("❌ Trận đấu không tồn tại")
            .setDescription("Trận đấu này không tồn tại hoặc đã bị xóa khỏi hệ thống.")
            .setColor(0xE74C3C);
        const backBtn = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`wc_admin_back_to_panel_${authorId}`)
                .setLabel("🔙 Quay lại bảng quản trị")
                .setStyle(ButtonStyle.Secondary)
        );
        return { embeds: [errEmbed], components: [backBtn] };
    }

    let statusText = "";
    if (match.status === 'open') statusText = "🟢 Đang mở đặt cược";
    else if (match.status === 'locked') statusText = "🔒 Đã khóa đặt cược";
    else if (match.status === 'ended') statusText = `🏁 Đã kết thúc (Thắng: **${match.winner === 'HoaKeo' ? 'Hòa Kèo' : (match.winner === 'A' ? match.teamA : match.teamB)}**)`;

    const embed = new EmbedBuilder()
        .setTitle(`⚙️ CONSOLE QUẢN TRỊ: TRẬN \`${match.matchId.toUpperCase()}\``)
        .setDescription(
            `**Thông tin hiện tại:**\n` +
            `• **Cặp đấu:** **${match.teamA}** vs **${match.teamB}**\n` +
            `• **Kèo chấp:** *${match.odds}*\n` +
            `• **Trạng thái:** ${statusText}\n\n` +
            `👉 Hãy dùng các nút dưới đây để cập nhật trạng thái trận đấu:`
        )
        .setColor(0xE74C3C)
        .setFooter({ text: "BotToan System Manager" })
        .setTimestamp();

    const actionRow = new ActionRowBuilder();

    // Nút Khóa cược (Chỉ bật nếu đang open)
    const lockBtn = new ButtonBuilder()
        .setCustomId(`wc_admin_lock_${matchId}_${authorId}`)
        .setLabel("🔒 Khóa cược")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(match.status !== 'open');

    // Nút Chung tiền (Bật nếu chưa kết thúc)
    const settleBtn = new ButtonBuilder()
        .setCustomId(`wc_admin_settle_menu_${matchId}_${authorId}`)
        .setLabel("🏁 Chung tiền")
        .setStyle(ButtonStyle.Success)
        .setDisabled(match.status === 'ended');

    // Nút Sửa kèo (Bật nếu chưa khóa/kết thúc)
    const editBtn = new ButtonBuilder()
        .setCustomId(`wc_admin_edit_${matchId}_${authorId}`)
        .setLabel("📝 Sửa kèo")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(match.status !== 'open');

    // Nút Xóa kèo (Bật nếu chưa kết thúc)
    const deleteBtn = new ButtonBuilder()
        .setCustomId(`wc_admin_delete_${matchId}_${authorId}`)
        .setLabel("🗑️ Xóa & Hoàn tiền")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(match.status === 'ended');

    actionRow.addComponents(lockBtn, settleBtn, editBtn, deleteBtn);

    const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`wc_admin_back_to_panel_${authorId}`)
            .setLabel("🔙 Quay lại danh sách quản trị")
            .setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [actionRow, backRow] };
}

/**
 * Trả về giao diện chọn kết quả thắng cược (Chung tiền) của Admin cho một trận đấu
 */
export async function getWCSettleConsole(matchId: string, authorId: string, disabled: boolean = false): Promise<{ embeds: EmbedBuilder[], components: ActionRowBuilder<any>[] }> {
    const match = await getWCMatch(matchId);
    
    if (!match) {
        const errEmbed = new EmbedBuilder()
            .setTitle("❌ Trận đấu không tồn tại")
            .setDescription("Trận đấu này không tồn tại hoặc đã bị xóa khỏi hệ thống.")
            .setColor(0xE74C3C);
        const backBtn = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`wc_admin_back_to_panel_${authorId}`)
                .setLabel("🔙 Quay lại bảng quản trị")
                .setStyle(ButtonStyle.Secondary)
        );
        return { embeds: [errEmbed], components: [backBtn] };
    }

    const embed = new EmbedBuilder()
        .setTitle(`🏁 CHUNG TIỀN: TRẬN \`${match.matchId.toUpperCase()}\``)
        .setDescription(
            `Vui lòng chọn kết quả thắng cuộc của trận đấu:\n` +
            `⚽ **Cặp đấu:** **${match.teamA}** vs **${match.teamB}**\n` +
            `⭐ **Kèo chấp:** *${match.odds}*\n\n` +
            `⚠️ **Lưu ý:** Việc chung tiền sẽ hoàn tất và lưu kết quả vĩnh viễn, người chơi thắng cược sẽ nhận được tiền cược nhân đôi, người thua mất tiền.`
        )
        .setColor(0x2ECC71)
        .setFooter({ text: "BotToan System Manager" })
        .setTimestamp();

    const settleRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`wc_adm_settle_A_${matchId}_${authorId}`)
            .setLabel(`Thắng cửa A (${match.teamA})`)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`wc_adm_settle_B_${matchId}_${authorId}`)
            .setLabel(`Thắng cửa B (${match.teamB})`)
            .setStyle(ButtonStyle.Danger)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`wc_adm_settle_HOAKEO_${matchId}_${authorId}`)
            .setLabel("Hòa kèo (Hoàn tiền)")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled)
    );

    const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`wc_admin_back_to_match_${matchId}_${authorId}`)
            .setLabel("🔙 Quay lại Console trận")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled)
    );

    return { embeds: [embed], components: [settleRow, backRow] };
}

/**
 * Lắng nghe và xử lý tương tác nút bấm và Modal cược World Cup toàn cục (Stateless & Chống Race Condition)
 */
export function registerWorldCupCollector(client: any) {
    client.on('interactionCreate', async (interaction: any) => {
        const id = interaction.customId;
        if (!id || !id.startsWith('wc_')) return;

        // Trích xuất authorId của lệnh từ customId để chống Race Condition
        if (interaction.isButton() || interaction.isStringSelectMenu()) {
            const parts = id.split('_');
            const lastPart = parts[parts.length - 1];
            const isDiscordId = /^\d{17,21}$/.test(lastPart);
            
            if (isDiscordId && interaction.user.id !== lastPart) {
                await interaction.reply({ 
                    content: "❌ **Đừng bấm ké của người khác!** Vui lòng gõ `@BotToan wc` để tự mở bảng cược riêng của mình cưng nhé! 🙄", 
                    ephemeral: true 
                }).catch(() => {});
                return;
            }
        }

        try {
            // --- A. XỬ LÝ DROPDOWN SELECT MENU ---
            if (interaction.isStringSelectMenu()) {
                const parts = id.split('_');
                const authorId = parts[parts.length - 1];

                // 1. Người chơi chọn trận đấu để xem chi tiết & cược
                if (id.startsWith('wc_select_match_')) {
                    const matchId = interaction.values[0];
                    const page = await getWCMatchDetailPage(matchId, authorId);
                    await interaction.update(page).catch(() => {});
                    return;
                }

                // 2. Admin chọn trận đấu để quản trị
                if (id.startsWith('wc_admin_select_match_')) {
                    const matchId = interaction.values[0];
                    const page = await getWCAdminConsole(matchId, authorId);
                    await interaction.update(page).catch(() => {});
                    return;
                }
            }

            // --- B. XỬ LÝ NÚT BẤM ---
            if (interaction.isButton()) {
                const parts = id.split('_');
                const authorId = parts[parts.length - 1];

                // 1. Quay lại danh sách người chơi (Trang chủ)
                if (id.startsWith('wc_btn_back_to_list_')) {
                    const page = await getWCHomePage(authorId);
                    await interaction.update(page).catch(() => {});
                    return;
                }

                // 2. Click đặt cược cửa A / B (Hiện modal)
                if (id.startsWith('wc_btn_bet_')) {
                    const team = parts[3]; // 'A' hoặc 'B'
                    const matchId = parts[4];

                    const match = await getWCMatch(matchId);
                    if (!match) {
                        await interaction.reply({ content: "❌ Trận đấu này không tồn tại trong hệ thống!", ephemeral: true }).catch(() => {});
                        return;
                    }

                    if (match.status !== 'open') {
                        await interaction.reply({ content: `❌ Trận đấu đã **${match.status === 'locked' ? 'khóa cửa đặt cược' : 'kết thúc'}**, không thể đặt cược nữa cưng nhé!`, ephemeral: true }).catch(() => {});
                        return;
                    }

                    const modal = new ModalBuilder()
                        .setCustomId(`wc_modal_bet_${matchId}_${team}`)
                        .setTitle(`Cược ${team === 'A' ? match.teamA : match.teamB}`);

                    const amountInput = new TextInputBuilder()
                        .setCustomId('bet_amount')
                        .setLabel(`Nhập tiền cược (Ví dụ: 50k, 1tr, 3.000.000)`)
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder("50k, 100k, 1tr, 3.000.000...")
                        .setRequired(true);

                    const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(amountInput);
                    modal.addComponents(firstActionRow);

                    await interaction.showModal(modal).catch(() => {});
                    return;
                }

                // 3. Xem lịch sử đặt cược cá nhân
                if (id.startsWith('wc_btn_history_personal_')) {
                    await interaction.deferReply({ ephemeral: true }).catch(() => {});
                    
                    const userBets = await getUserWCBets(interaction.user.id);
                    if (userBets.length === 0) {
                        await interaction.editReply({ content: "🏟️ Bạn chưa đặt cược bất kỳ trận đấu World Cup nào trên hệ thống!" }).catch(() => {});
                        return;
                    }

                    const embed = new EmbedBuilder()
                        .setTitle("👤 LỊCH SỬ ĐẶT CƯỢC WORLD CUP CỦA BẠN")
                        .setDescription("Danh sách các lượt đặt cược của bạn và trạng thái thanh toán:")
                        .setColor(0x2ECC71)
                        .setFooter({ text: "BotToan Bookmaker - World Cup 2026" })
                        .setTimestamp();

                    for (let i = 0; i < Math.min(userBets.length, 10); i++) {
                        const ub = userBets[i];
                        const m = ub.match;
                        const bet = ub.bet;
                        
                        let matchText = m ? `${m.teamA} vs ${m.teamB}` : `Trận đấu \`${bet.matchId}\` (Đã bị xóa)`;
                        let statusText = "";

                        if (bet.settled) {
                            if (m && m.winner === 'HoaKeo') {
                                statusText = `🟡 **Hòa kèo (Hoàn lại ${formatMoney(bet.amount)})**`;
                            } else if (m && bet.team === m.winner) {
                                statusText = `🟢 **Thắng (+${formatMoney(bet.amount * 2)})**`;
                            } else {
                                statusText = `🔴 **Thua (-${formatMoney(bet.amount)})**`;
                            }
                        } else {
                            statusText = "⏳ **Đang chờ kết quả**";
                        }

                        const choiceName = m ? (bet.team === 'A' ? m.teamA : m.teamB) : bet.team;

                        embed.addFields({
                            name: `⚽ ${matchText} (Mã: \`${bet.matchId}\`)`,
                            value: `• **Lựa chọn:** Cửa ${bet.team} (${choiceName})\n• **Số tiền:** **${formatMoney(bet.amount)}**\n• **Kết quả:** ${statusText}`,
                            inline: false
                        });
                    }

                    if (userBets.length > 10) {
                        embed.addFields({ name: "📊 Lưu ý", value: `*Bạn có tổng cộng **${userBets.length}** lượt cược. Chỉ hiển thị 10 lượt cược gần nhất.*` });
                    }

                    await interaction.editReply({ embeds: [embed] }).catch(() => {});
                    return;
                }

                // 4. Xem các cược đang treo trên server
                if (id.startsWith('wc_btn_active_wagers_')) {
                    await interaction.deferReply({ ephemeral: true }).catch(() => {});
                    
                    const activeBets = await getActiveWCBets();
                    if (activeBets.length === 0) {
                        await interaction.editReply({ content: "🏟️ Hiện tại không có lượt cược nào đang treo trên server!" }).catch(() => {});
                        return;
                    }

                    const embed = new EmbedBuilder()
                        .setTitle("📊 CÁC CƯỢC WORLD CUP ĐANG TREO TRÊN SERVER")
                        .setDescription("Danh sách các con giời đang đặt cược và chờ kết quả:")
                        .setColor(0x3498DB)
                        .setFooter({ text: "BotToan - Sòng bạc hoàng gia" })
                        .setTimestamp();

                    const betsByMatch = new Map<string, typeof activeBets>();
                    for (const ab of activeBets) {
                        const matchKey = ab.match ? `${ab.match.teamA} vs ${ab.match.teamB} (Mã: \`${ab.bet.matchId}\`)` : `Trận đấu \`${ab.bet.matchId}\` (Đã bị xóa)`;
                        if (!betsByMatch.has(matchKey)) {
                            betsByMatch.set(matchKey, []);
                        }
                        betsByMatch.get(matchKey)!.push(ab);
                    }

                    let embedFieldsCount = 0;
                    for (const [matchKey, wagers] of betsByMatch.entries()) {
                        if (embedFieldsCount >= 10) break;
                        
                        let wagersText = "";
                        for (const w of wagers) {
                            const m = w.match;
                            const choiceName = m ? (w.bet.team === 'A' ? m.teamA : m.teamB) : w.bet.team;
                            wagersText += `- <@${w.bet.userId}> cược **${formatMoney(w.bet.amount)}** vào cửa **${choiceName}**\n`;
                        }

                        embed.addFields({
                            name: `⚽ ${matchKey}`,
                            value: wagersText || "*Không có*",
                            inline: false
                        });
                        embedFieldsCount++;
                    }

                    await interaction.editReply({ embeds: [embed] }).catch(() => {});
                    return;
                }

                // 5. Bảng quản trị của Admin (Trang chủ admin)
                if (id.startsWith('wc_btn_admin_panel_')) {
                    const isAdmin = interaction.member?.permissions.has(PermissionFlagsBits.Administrator);
                    if (!isAdmin) {
                        await interaction.reply({ content: "❌ **ĐÉO CÓ QUYỀN!** Bảng quản trị chỉ dành cho Admin của server nhé cưng! 🙄", ephemeral: true }).catch(() => {});
                        return;
                    }

                    const page = await getWCAdminHomePage(authorId);
                    await interaction.update(page).catch(() => {});
                    return;
                }

                // 6. Admin quay lại danh sách quản trị
                if (id.startsWith('wc_admin_back_to_panel_')) {
                    const page = await getWCAdminHomePage(authorId);
                    await interaction.update(page).catch(() => {});
                    return;
                }

                // 7. Admin quay lại Console của trận
                if (id.startsWith('wc_admin_back_to_match_')) {
                    const matchId = parts[5];
                    const page = await getWCAdminConsole(matchId, authorId);
                    await interaction.update(page).catch(() => {});
                    return;
                }

                // 8. Admin Khóa cược trận đấu
                if (id.startsWith('wc_admin_lock_')) {
                    const matchId = parts[3];
                    
                    await interaction.deferReply({ ephemeral: true }).catch(() => {});
                    
                    const success = await lockWCMatch(matchId);
                    if (success) {
                        const page = await getWCAdminConsole(matchId, authorId);
                        await interaction.followUp({ content: `✅ Đã khóa đặt cược trận đấu \`${matchId}\` thành công!`, ephemeral: true }).catch(() => {});
                        // Cập nhật lại UI Console của Admin
                        await interaction.message.edit(page).catch(() => {});
                    } else {
                        await interaction.followUp({ content: "❌ Thất bại: Trận đấu không tồn tại hoặc đã được khóa/kết thúc từ trước!", ephemeral: true }).catch(() => {});
                    }
                    return;
                }

                // 9. Admin hiển thị menu Chọn Đội Thắng cuộc
                if (id.startsWith('wc_admin_settle_menu_')) {
                    const matchId = parts[4];
                    const page = await getWCSettleConsole(matchId, authorId);
                    await interaction.update(page).catch(() => {});
                    return;
                }

                // 10. Admin thực hiện Chung tiền (Settle) thắng cuộc
                if (id.startsWith('wc_adm_settle_')) {
                    const choice = parts[3] as 'A' | 'B' | 'HOAKEO';
                    const matchId = parts[4];

                    // Tinh chỉnh 2: Đặt các nút disabled ngay lập tức chống Double Click
                    const disabledPage = await getWCSettleConsole(matchId, authorId, true);
                    await interaction.update(disabledPage).catch(() => {});

                    // Tiến hành defer reply để ghi DB
                    const followUpMsg = await interaction.followUp({ content: "⏳ Đang tính toán và chuyển tiền thắng cược, vui lòng chờ...", ephemeral: true }).catch(() => {});

                    const res = await settleWCMatch(matchId, choice === 'HOAKEO' ? 'HoaKeo' : choice);
                    
                    if (res.success) {
                        await interaction.webhook.editMessage(followUpMsg.id, { 
                            content: `✅ Chung tiền thành công cho trận \`${matchId}\`!\n• Kết quả: **${choice === 'HOAKEO' ? 'Hòa Kèo' : `Cửa ${choice}`}**\n• Số lượt thanh toán: **${res.payoutsCount}**` 
                        }).catch(() => {});

                        // Cập nhật lại UI Console của trận
                        const page = await getWCAdminConsole(matchId, authorId);
                        await interaction.message.edit(page).catch(() => {});
                    } else {
                        await interaction.webhook.editMessage(followUpMsg.id, { content: `❌ Chung tiền thất bại: ${res.message}` }).catch(() => {});
                        
                        // Rollback trạng thái nút để admin có thể bấm lại
                        const enabledPage = await getWCSettleConsole(matchId, authorId, false);
                        await interaction.message.edit(enabledPage).catch(() => {});
                    }
                    return;
                }

                // 11. Admin bấm Sửa kèo (Hiện modal với giá trị cũ)
                if (id.startsWith('wc_admin_edit_')) {
                    const matchId = parts[3];

                    const match = await getWCMatch(matchId);
                    if (!match) {
                        await interaction.reply({ content: "❌ Trận đấu không tồn tại trong hệ thống!", ephemeral: true }).catch(() => {});
                        return;
                    }

                    if (match.status !== 'open') {
                        await interaction.reply({ content: "❌ Chỉ có thể sửa kèo khi trận đấu đang ở trạng thái mở cược!", ephemeral: true }).catch(() => {});
                        return;
                    }

                    // Tinh chỉnh 3: Điền sẵn dữ liệu cũ (Initial Value) vào các TextInput
                    const modal = new ModalBuilder()
                        .setCustomId(`wc_modal_admin_edit_${matchId}`)
                        .setTitle(`Sửa kèo trận ${matchId.toUpperCase()}`);

                    const teamAInput = new TextInputBuilder()
                        .setCustomId('edit_team_a')
                        .setLabel("Đội A (Ví dụ: Tây Ban Nha)")
                        .setStyle(TextInputStyle.Short)
                        .setValue(match.teamA)
                        .setRequired(true);

                    const teamBInput = new TextInputBuilder()
                        .setCustomId('edit_team_b')
                        .setLabel("Đội B (Ví dụ: Bỉ)")
                        .setStyle(TextInputStyle.Short)
                        .setValue(match.teamB)
                        .setRequired(true);

                    const oddsInput = new TextInputBuilder()
                        .setCustomId('edit_odds')
                        .setLabel("Kèo chấp (Ví dụ: Tây Ban Nha chấp 1.25 trái)")
                        .setStyle(TextInputStyle.Short)
                        .setValue(match.odds)
                        .setRequired(true);

                    modal.addComponents(
                        new ActionRowBuilder<TextInputBuilder>().addComponents(teamAInput),
                        new ActionRowBuilder<TextInputBuilder>().addComponents(teamBInput),
                        new ActionRowBuilder<TextInputBuilder>().addComponents(oddsInput)
                    );

                    await interaction.showModal(modal).catch(() => {});
                    return;
                }

                // 12. Admin Xóa trận đấu & Hoàn tiền cược
                if (id.startsWith('wc_admin_delete_')) {
                    const matchId = parts[3];

                    await interaction.deferReply({ ephemeral: true }).catch(() => {});

                    const result = await deleteWCMatch(matchId);
                    if (result.success) {
                        let msg = `🗑️ Đã xóa hoàn toàn trận đấu \`${matchId}\` khỏi hệ thống!`;
                        if (result.refundedBetsCount > 0) {
                            msg += `\n💰 Đã hoàn trả tiền cược cho **${result.refundedBetsCount}** lượt cược chưa được chung tiền của trận đấu này.`;
                        }
                        await interaction.followUp({ content: msg, ephemeral: true }).catch(() => {});
                        
                        // Cập nhật lại UI về trang chủ Quản lý admin
                        const page = await getWCAdminHomePage(authorId);
                        await interaction.message.edit(page).catch(() => {});
                    } else {
                        await interaction.followUp({ content: `❌ Xóa trận đấu thất bại: ${result.message}`, ephemeral: true }).catch(() => {});
                    }
                    return;
                }
            }

            // --- C. XỬ LÝ SUBMIT MODAL ---
            if (interaction.isModalSubmit()) {
                // 1. Người chơi gửi tiền cược
                if (id.startsWith('wc_modal_bet_')) {
                    const parts = id.split('_');
                    const matchId = parts[3];
                    const team = parts[4] as 'A' | 'B';

                    const betAmountText = interaction.fields.getTextInputValue('bet_amount');
                    const amount = parseMoneyInput(betAmountText);

                    if (amount === null || isNaN(amount) || amount <= 0) {
                        await interaction.reply({ content: "❌ **Số tiền cược không hợp lệ!** Vui lòng nhập số tiền như: `50k`, `100k`, `1tr`...", ephemeral: true }).catch(() => {});
                        return;
                    }

                    // Tác vụ DB lâu -> Defer reply trước
                    await interaction.deferReply({ ephemeral: true }).catch(() => {});

                    const res = await placeWCBet(interaction.user.id, matchId, team, amount);
                    await interaction.editReply({ content: res.message }).catch(() => {});
                    return;
                }

                // 2. Admin gửi Form sửa kèo trận đấu
                if (id.startsWith('wc_modal_admin_edit_')) {
                    const parts = id.split('_');
                    const matchId = parts[4];

                    const teamA = interaction.fields.getTextInputValue('edit_team_a').trim();
                    const teamB = interaction.fields.getTextInputValue('edit_team_b').trim();
                    const odds = interaction.fields.getTextInputValue('edit_odds').trim();

                    if (!teamA || !teamB || !odds) {
                        await interaction.reply({ content: "❌ Các trường thông tin không được bỏ trống!", ephemeral: true }).catch(() => {});
                        return;
                    }

                    await interaction.deferReply({ ephemeral: true }).catch(() => {});

                    const success = await updateWCMatch(matchId, teamA, teamB, odds);
                    if (success) {
                        await interaction.editReply({ content: `✅ Đã sửa đổi kèo đấu \`${matchId}\` thành công!` }).catch(() => {});
                        
                        // Cập nhật lại UI Console của Admin
                        const authorId = interaction.user.id;
                        const page = await getWCAdminConsole(matchId, authorId);
                        await interaction.message.edit(page).catch(() => {});
                    } else {
                        await interaction.editReply({ content: "❌ Sửa kèo thất bại! Trận đấu có thể không tồn tại hoặc đã khóa/kết thúc." }).catch(() => {});
                    }
                    return;
                }
            }
        } catch (error) {
            console.error("[WORLD CUP INTERACTION ERROR]:", error);
            // Cố gắng báo lỗi cho người dùng để tránh treo nút
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: "❌ Đã xảy ra lỗi hệ thống khi xử lý tương tác của bạn!", ephemeral: true }).catch(() => {});
                } else {
                    await interaction.followUp({ content: "❌ Đã xảy ra lỗi hệ thống khi xử lý tương tác của bạn!", ephemeral: true }).catch(() => {});
                }
            } catch (err) {}
        }
    });
}

