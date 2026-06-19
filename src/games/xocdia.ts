import { Message, ComponentType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { getBalance, updateBalance } from '../database';

/**
 * Bắt đầu sòng Xóc Đĩa cho một người dùng
 */
export async function playXocDia(message: Message) {
    const userId = message.author.id;
    let isProcessing = false;

    // Tự động cấp vốn 100k nếu chưa có hoặc phá sản
    await getBalance(userId);

    const draftMsg = await message.reply("🎲 **ĐANG ĐẬY BÁT XÓC ĐĨA... TRÁNH RA CHO BẤT LÊN NÀO!**");
    const collector = draftMsg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 300000 }); // Sòng tồn tại 5 phút

    const updateBoard = async (interaction?: any, extraMsg = "", colorHex = 0x00AE86) => {
        const balance = await getBalance(userId);

        if (balance < 10) {
            const text = `${extraMsg}\n💸 **CHÁY TÚI!** Mày còn đúng ${balance}k, đéo đủ 1 ván cược. Cờ bạc bác thằng bần con ạ!`;
            const embed = new EmbedBuilder()
                .setTitle("🎰 SÒNG XÓC ĐĨA - CHÁY TÚI")
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
            new ButtonBuilder().setCustomId('xd_chan').setLabel('🔴 Chẵn').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('xd_le').setLabel('⚪ Lẻ').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('xd_nghi').setLabel('🏃 Chốt lãi / Nghỉ').setStyle(ButtonStyle.Primary)
        );

        const embed = new EmbedBuilder()
            .setTitle("🎰 SÒNG XÓC ĐĨA - BOTTOAN")
            .setDescription(`${extraMsg}\n💰 Tài sản của mày: **${balance}k**\n👇 Chọn **Chẵn** hoặc **Lẻ** để cược **10k/ván**:`)
            .setColor(colorHex)
            .setThumbnail(message.author.displayAvatarURL())
            .setFooter({ text: "Mỗi ván cược trị giá 10k" });

        if (interaction) await interaction.update({ embeds: [embed], components: [row] }).catch(()=>{});
        else await draftMsg.edit({ embeds: [embed], components: [row] }).catch(()=>{});
    };

    collector.on('collect', async i => {
        if (i.user.id !== userId) {
            await i.reply({ content: "Đứa nào chơi máy đứa nấy, đừng có bấm ké!", ephemeral: true }).catch(()=>{});
            return;
        }

        if (isProcessing) {
            await i.reply({ content: "Từ từ thôi mày, đang xóc chưa mở bát!", ephemeral: true }).catch(()=>{});
            return;
        }

        if (i.customId === 'xd_nghi') {
            const finalBalance = await getBalance(userId);
            let msg = `🏃 Mày đã xách quần bỏ chạy khỏi sòng xóc đĩa với **${finalBalance}k**. `;
            msg += finalBalance > 100 ? "Ăn non thế là tốt đấy con trai!" : "Lỗ chổng vó mà vẫn chịu nghỉ là dũng cảm đấy!";
            
            const embed = new EmbedBuilder()
                .setTitle("🎰 SÒNG XÓC ĐĨA - NGHỈ CHƠI")
                .setDescription(msg)
                .setColor(0xFFA500)
                .setThumbnail(message.author.displayAvatarURL());

            await i.update({ embeds: [embed], components: [] }).catch(()=>{});
            collector.stop();
            return;
        }

        isProcessing = true;

        try {
            const userBet = i.customId.split('_')[1]; // 'chan' hoặc 'le'
            let balance = await getBalance(userId);
            balance -= 10;
            await updateBalance(userId, balance);

            // Lắc 4 quân vị (Đỏ hoặc Trắng)
            const coins = Array.from({ length: 4 }, () => Math.random() < 0.5 ? "Đỏ" : "Trắng");
            const redCount = coins.filter(c => c === "Đỏ").length;
            const whiteCount = 4 - redCount;

            const isChan = redCount % 2 === 0;
            const actualResult = isChan ? "chan" : "le";
            const actualResultText = isChan ? "CHẴN 🔴" : "LẺ ⚪";

            const coinEmojis = coins.map(c => c === "Đỏ" ? "🔴" : "⚪").join(" ");
            let resultMsg = `🎲 Bát xóc ra: **${coinEmojis}** (${redCount} Đỏ, ${whiteCount} Trắng) -> **${actualResultText}**\n\n`;

            let isWin = userBet === actualResult;
            let finalColor = 0xFF0000;

            if (isWin) {
                const winAmount = 20; // Hoàn cược + ăn 10k
                balance += winAmount;
                await updateBalance(userId, balance);
                resultMsg += `🎉 **Mày đã thắng!** Lụm về **10k**.`;
                finalColor = 0x00FF00;
            } else {
                resultMsg += `💀 **Mày đã thua!** Mất cmn **10k** cược con ${userBet === "chan" ? "Chẵn" : "Lẻ"}.`;
            }

            await updateBoard(i, resultMsg, finalColor);
        } catch (error) {
            console.error("[XÓC ĐĨA LỖI] Lỗi ván xóc:", error);
        } finally {
            isProcessing = false;
        }
    });

    collector.on('end', () => {
        draftMsg.edit({ components: [] }).catch(()=>{});
    });

    await updateBoard();
}
