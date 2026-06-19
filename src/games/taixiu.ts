import { Message, ComponentType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { getBalance, updateBalance } from '../database';

const diceEmojis = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

/**
 * Bắt đầu sòng Tài Xỉu cho một người dùng
 */
export async function playTaiXiu(message: Message) {
    const userId = message.author.id;
    let isProcessing = false;

    // Tự động cấp vốn 100k nếu chưa có hoặc phá sản
    await getBalance(userId);

    const draftMsg = await message.reply("🎲 **ĐANG LẮC BÁT TÀI XỈU... BẤM CỬA ĐI CÁC CON GIỜI!**");
    const collector = draftMsg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 300000 }); // Sòng tồn tại 5 phút

    const updateBoard = async (interaction?: any, extraMsg = "", colorHex = 0x00AE86) => {
        const balance = await getBalance(userId);

        if (balance < 10) {
            const text = `${extraMsg}\n💸 **CHÁY TÚI!** Mày còn đúng ${balance}k, đéo đủ 1 ván cược. Cờ bạc bác thằng bần con ạ!`;
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

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('tx_tai').setLabel('🔴 Tài (11-17)').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('tx_xiu').setLabel('⚪ Xỉu (4-10)').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('tx_nghi').setLabel('🏃 Chốt lãi / Nghỉ').setStyle(ButtonStyle.Primary)
        );

        const embed = new EmbedBuilder()
            .setTitle("🎲 SÒNG TÀI XỈU - BOTTOAN")
            .setDescription(`${extraMsg}\n💰 Tài sản của mày: **${balance}k**\n👇 Chọn **Tài** hoặc **Xỉu** để cược **10k/ván**:`)
            .setColor(colorHex)
            .setThumbnail(message.author.displayAvatarURL())
            .setFooter({ text: "Lắc 3 xí ngầu. Bộ ba đồng nhất (3 con giống nhau) nhà cái ăn hết." });

        if (interaction) await interaction.update({ embeds: [embed], components: [row] }).catch(()=>{});
        else await draftMsg.edit({ content: "", embeds: [embed], components: [row] }).catch(()=>{});
    };

    collector.on('collect', async i => {
        if (i.user.id !== userId) {
            await i.reply({ content: "Đứa nào chơi máy đứa nấy, đừng có bấm ké!", ephemeral: true }).catch(()=>{});
            return;
        }

        if (isProcessing) {
            await i.reply({ content: "Từ từ thôi mày, đang lắc chưa mở bát!", ephemeral: true }).catch(()=>{});
            return;
        }

        if (i.customId === 'tx_nghi') {
            const finalBalance = await getBalance(userId);
            let msg = `🏃 Mày đã xách quần bỏ chạy khỏi sòng Tài Xỉu với **${finalBalance}k**. `;
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
            balance -= 10;
            await updateBalance(userId, balance);

            // Lắc 3 viên xí ngầu
            const die1 = Math.floor(Math.random() * 6) + 1;
            const die2 = Math.floor(Math.random() * 6) + 1;
            const die3 = Math.floor(Math.random() * 6) + 1;
            const total = die1 + die2 + die3;

            const dieText1 = diceEmojis[die1 - 1];
            const dieText2 = diceEmojis[die2 - 1];
            const dieText3 = diceEmojis[die3 - 1];

            let isTriple = die1 === die2 && die2 === die3;
            let actualResult = "";
            let actualResultText = "";

            if (isTriple) {
                actualResult = "triple";
                actualResultText = `BỘ BA ĐỒNG NHẤT (${die1}-${die2}-${die3}) 💥`;
            } else {
                actualResult = total >= 11 ? "tai" : "xiu";
                actualResultText = total >= 11 ? `TÀI 🔴 (${total} điểm)` : `XỈU ⚪ (${total} điểm)`;
            }

            let resultMsg = `🎲 Bát xóc ra: \` ${dieText1}   ${dieText2}   ${dieText3} \` -> **${actualResultText}**\n\n`;
            let isWin = userBet === actualResult;
            let finalColor = 0xFF0000;

            if (isTriple) {
                resultMsg += `💀 **BÃO RỒI!** Bộ ba đồng nhất xuất hiện. Nhà cái ăn sạch sành sanh! Mày mất **10k**.`;
            } else if (isWin) {
                const winAmount = 20; // Hoàn cược + ăn 10k
                balance += winAmount;
                await updateBalance(userId, balance);
                resultMsg += `🎉 **Mày đã thắng!** Lụm về **10k**.`;
                finalColor = 0x00FF00;
            } else {
                resultMsg += `💀 **Mày đã thua!** Mất cmn **10k** cược con ${userBet === "tai" ? "Tài" : "Xỉu"}.`;
            }

            await updateBoard(i, resultMsg, finalColor);
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
