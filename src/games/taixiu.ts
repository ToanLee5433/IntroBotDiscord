import { Message, ComponentType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { getBalance, updateBalance, getDebt } from '../database';
import { sleep, formatMoney } from '../utils';

const diceEmojis = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

/**
 * Bắt đầu sòng Tài Xỉu cho một người dùng
 */
export async function playTaiXiu(message: Message) {
    const userId = message.author.id;

    const debt = await getDebt(userId);
    if (debt > 0) {
        const embed = new EmbedBuilder()
            .setTitle("🚫 BỊ CẤM CỬA VÀO SÒNG CASINO")
            .setDescription(`💀 **MÀY ĐANG NỢ CHỒNG CHẤT!**\nHiện tại mày đang nợ ngân hàng BotToan tổng cộng **${formatMoney(debt)}**.\n\nTheo luật **"Nợ là Danh dự"**, mày bị cấm cửa tham gia mọi sòng cờ bạc đỏ đen! Mau gõ \`@BotToan tra no het\` để trả nợ rồi mới được chơi tiếp con ạ!`)
            .setColor(0xFF0000)
            .setThumbnail(message.author.displayAvatarURL());
        await message.reply({ embeds: [embed] });
        return;
    }

    let isProcessing = false;
    let currentBetSize = 10; // Mặc định cược 10k

    // Tự động cấp vốn 100k nếu chưa có hoặc phá sản
    await getBalance(userId);

    const draftMsg = await message.reply("🎲 **ĐANG LẮC BÁT TÀI XỈU... BẤM CỬA ĐI CÁC CON GIỜI!**");
    const collector = draftMsg.createMessageComponentCollector({ time: 300000 }); // Sòng tồn tại 5 phút

    const updateBoard = async (interaction?: any, extraMsg = "", colorHex = 0x00AE86) => {
        const balance = await getBalance(userId);

        if (balance < 10) {
            const text = `${extraMsg}\n💸 **CHÁY TÚI!** Mày còn đúng ${formatMoney(balance)}, đéo đủ cược ván tối thiểu ${formatMoney(10)}. Cờ bạc bác thằng bần con ạ!`;
            const embed = new EmbedBuilder()
                .setTitle("🎲 SÒNG TÀI XỈU - CHÁY TÚI")
                .setDescription(text)
                .setColor(0xFF0000)
                .setThumbnail(message.author.displayAvatarURL())
                .setFooter({ text: "BotToan - Sòng bạc hoàng gia" });

            if (interaction) await interaction.update({ embeds: [embed], components: [] }).catch(()=>{});
            else await draftMsg.edit({ embeds: [embed], components: [] }).catch(()=>{});
            collector.stop();
            return;
        }

        const row0 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('tx_bet_size')
                .setPlaceholder(`💵 Mức cược: ${formatMoney(currentBetSize)} (Bấm để chọn)`)
                .addOptions(
                    new StringSelectMenuOptionBuilder().setLabel('10k (Min)').setValue('10').setEmoji('🪙'),
                    new StringSelectMenuOptionBuilder().setLabel('20k').setValue('20').setEmoji('💵'),
                    new StringSelectMenuOptionBuilder().setLabel('30k').setValue('30').setEmoji('💸'),
                    new StringSelectMenuOptionBuilder().setLabel('40k').setValue('40').setEmoji('💰'),
                    new StringSelectMenuOptionBuilder().setLabel('50k (Max)').setValue('50').setEmoji('💎')
                )
        );

        const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('tx_tai').setLabel('🔴 Tài (11-17)').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('tx_xiu').setLabel('⚪ Xỉu (4-10)').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('tx_nghi').setLabel('🏃 Chốt lãi / Nghỉ').setStyle(ButtonStyle.Primary)
        );

        const embed = new EmbedBuilder()
            .setTitle("🎲 SÒNG TÀI XỈU - BOTTOAN")
            .setDescription(`${extraMsg}\n💰 Tài sản của mày: **${formatMoney(balance)}**\n👇 Chọn mức tiền cược ở menu trên, sau đó chọn **Tài** hoặc **Xỉu** bên dưới:`)
            .setColor(colorHex)
            .setThumbnail(message.author.displayAvatarURL())
            .setFooter({ text: "Lắc 3 xí ngầu. Bộ ba đồng nhất (3 con giống nhau) nhà cái ăn hết." });

        if (interaction) {
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ embeds: [embed], components: [row0, row1] }).catch(()=>{});
            } else {
                await interaction.update({ embeds: [embed], components: [row0, row1] }).catch(()=>{});
            }
        } else {
            await draftMsg.edit({ content: "", embeds: [embed], components: [row0, row1] }).catch(()=>{});
        }
    };

    collector.on('collect', async i => {
        if (i.user.id !== userId) {
            await i.reply({ content: "Đứa nào chơi máy đứa nấy, đừng có bấm ké!", ephemeral: true }).catch(()=>{});
            return;
        }

        // Xử lý thay đổi mức cược
        if (i.isStringSelectMenu() && i.customId === 'tx_bet_size') {
            currentBetSize = parseInt(i.values[0]);
            await i.deferUpdate().catch(()=>{});
            await updateBoard();
            return;
        }

        if (!i.isButton()) return;

        if (isProcessing) {
            await i.reply({ content: "Từ từ thôi mày, bát đang lắc chưa mở!", ephemeral: true }).catch(()=>{});
            return;
        }

        if (i.customId === 'tx_nghi') {
            const finalBalance = await getBalance(userId);
            let msg = `🏃 Mày đã xách quần bỏ chạy khỏi sòng Tài Xỉu với **${formatMoney(finalBalance)}**. `;
            msg += finalBalance > 100 ? "Khôn đấy, ăn được tí của ngoại là lủi!" : "Lỗ chổng vó mà vẫn chịu nghỉ là dũng cảm đấy!";
            
            const embed = new EmbedBuilder()
                .setTitle("🎲 SÒNG TÀI XỈU - NGHỈ CHƠI")
                .setDescription(msg)
                .setColor(0xFFA500)
                .setThumbnail(message.author.displayAvatarURL());

            await i.update({ embeds: [embed], components: [] }).catch(()=>{});
            collector.stop();
            return;
        }

        isProcessing = true;

        try {
            const userBet = i.customId.split('_')[1]; // 'tai' hoặc 'xiu'
            let balance = await getBalance(userId);

            if (balance < currentBetSize) {
                await i.reply({ content: `Ví còn có ${formatMoney(balance)} mà đòi cược ${formatMoney(currentBetSize)}! Hạ mức cược hoặc đi vay tiền đi con trai.`, ephemeral: true }).catch(()=>{});
                isProcessing = false;
                return;
            }

            // Trừ tiền cược
            balance -= currentBetSize;
            await updateBalance(userId, balance);

            // Giai đoạn hiệu ứng lắc bát ASCII Terminal (3 giây, 1s/khung hình)
            const shakeFrames = [
                "┌──────────────────────────────┐\n│     🎲 TÀI XỈU CASINO 🎲     │\n├──────────────────────────────┤\n│       [ ⚀ ]  [ ⚂ ]  [ ⚄ ]       │\n│    👉 LẠCH CẠCH LẠCH CẠCH...  │\n└──────────────────────────────┘",
                "┌──────────────────────────────┐\n│     🎲 TÀI XỈU CASINO 🎲     │\n├──────────────────────────────┤\n│       [ ⚁ ]  [ ⚃ ]  [ ⚅ ]       │\n│    👉 XOAY XOAY XOAY XOAY...  │\n└──────────────────────────────┘",
                "┌──────────────────────────────┐\n│     🎲 TÀI XỈU CASINO 🎲     │\n├──────────────────────────────┤\n│       [ ⚄ ]  [ ⚅ ]  [ ⚁ ]       │\n│    🎲 CHUẨN BỊ MỞ BÁT!!!      │\n└──────────────────────────────┘"
            ];

            await i.deferUpdate().catch(()=>{});

            for (let step = 0; step < 3; step++) {
                const animEmbed = new EmbedBuilder()
                    .setTitle("🎲 ĐANG LẮC BÁT TÀI XỈU...")
                    .setDescription(`\`\`\`text\n${shakeFrames[step]}\n\`\`\``)
                    .setColor(0xFFA500)
                    .setThumbnail(message.author.displayAvatarURL());
                
                await draftMsg.edit({ embeds: [animEmbed], components: [] }).catch(()=>{});
                await sleep(1000); // 1 giây delay để tránh Discord Rate Limit
            }

            // Kết quả thật
            const die1 = Math.floor(Math.random() * 6) + 1;
            const die2 = Math.floor(Math.random() * 6) + 1;
            const die3 = Math.floor(Math.random() * 6) + 1;
            const total = die1 + die2 + die3;

            const dieText1 = diceEmojis[die1 - 1];
            const dieText2 = diceEmojis[die2 - 1];
            const dieText3 = diceEmojis[die3 - 1];

            const isTriple = die1 === die2 && die2 === die3;
            let actualResult = "";
            let actualResultText = "";

            if (isTriple) {
                actualResult = "triple";
                actualResultText = `BỘ BA ĐỒNG NHẤT (${die1}-${die2}-${die3}) 💥`;
            } else {
                actualResult = total >= 11 ? "tai" : "xiu";
                actualResultText = total >= 11 ? `TÀI 🔴 (${total} điểm)` : `XỈU ⚪ (${total} điểm)`;
            }

            const boxResult = `┌──────────────────────────────┐\n│     🎲 TÀI XỈU CASINO 🎲     │\n├──────────────────────────────┤\n│  ✨   [ ${dieText1} ]    [ ${dieText2} ]    [ ${dieText3} ]   ✨  │\n└──────────────────────────────┘`;
            let resultMsg = `🎲 **Bát xóc mở ra:**\n\`\`\`text\n${boxResult}\n\`\`\`\nKết quả: **${actualResultText}**\n\n`;
            
            const isWin = userBet === actualResult;
            let finalColor = 0xE74C3C; // Đỏ Ruby

            if (isTriple) {
                resultMsg += `💀 **BÃO RỒI!** Bộ ba đồng nhất xuất hiện. Nhà cái ăn sạch sành sanh! Mày mất **${formatMoney(currentBetSize)}**.`;
            } else if (isWin) {
                const winAmount = currentBetSize * 2; // Hoàn cược + ăn lãi 1:1
                balance += winAmount;
                await updateBalance(userId, balance);
                resultMsg += `🎉 **Mày đã thắng!** Húp về **${formatMoney(currentBetSize)}**.`;
                finalColor = 0x2ECC71; // Xanh Ngọc
            } else {
                resultMsg += `💀 **Mày đã thua!** Mất cmn **${formatMoney(currentBetSize)}** cược con ${userBet === "tai" ? "Tài" : "Xỉu"}.`;
            }

            await updateBoard(null, resultMsg, finalColor);
        } catch (error) {
            console.error("[TÀI XỈU LỖI] Lỗi ván lắc:", error);
        } finally {
            isProcessing = false;
        }
    });

    collector.on('end', () => {
        draftMsg.edit({ components: [] }).catch(()=>{});
    });

    await updateBoard();
}
