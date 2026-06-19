import { Message, ComponentType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { getBalance, updateBalance } from '../database';
import { sleep, formatMoney } from '../utils';

const bauCuaSymbols = ["Bầu", "Cua", "Tôm", "Cá", "Gà", "Nai"];
const bauCuaEmojis: { [key: string]: string } = {
    "Bầu": "🎃", "Cua": "🦀", "Tôm": "🦐", "Cá": "🐟", "Gà": "🐓", "Nai": "🦌"
};

/**
 * Bắt đầu sòng Bầu Cua cho một người dùng
 */
export async function playBauCua(message: Message) {
    const userId = message.author.id;
    let isProcessing = false;
    let currentBetSize = 10; // Mặc định cược 10k
    
    // Tự động cấp vốn 100k nếu chưa có hoặc phá sản
    await getBalance(userId);

    const draftMsg = await message.reply("🎲 **ĐANG TRẢI CHIẾU SÒNG BẦU CUA...**");
    const collector = draftMsg.createMessageComponentCollector({ time: 300000 }); // Sòng tồn tại 5 phút

    const updateBoard = async (interaction?: any, extraMsg = "", colorHex = 0x00AE86) => {
        const balance = await getBalance(userId);
        
        // Xử lý khi phá sản (dưới 10k không đủ cược)
        if (balance < 10) {
            const text = `${extraMsg}\n💸 **CHÁY TÚI!** Mày còn đúng ${formatMoney(balance)}, đéo đủ cược mức tối thiểu. Đi vay tiền đi con ạ!`;
            const embed = new EmbedBuilder()
                .setTitle("🎃 BẦU CUA HOÀNG GIA - CHÁY TÚI")
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
                .setCustomId('bc_bet_size')
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
            new ButtonBuilder().setCustomId('bc_Bầu').setLabel('🎃 Bầu').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('bc_Cua').setLabel('🦀 Cua').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('bc_Tôm').setLabel('🦐 Tôm').setStyle(ButtonStyle.Primary)
        );
        const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('bc_Cá').setLabel('🐟 Cá').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('bc_Gà').setLabel('🐓 Gà').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('bc_Nai').setLabel('🦌 Nai').setStyle(ButtonStyle.Success)
        );
        const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('bc_nghi').setLabel('🏃 Chốt lãi / Nghỉ chơi').setStyle(ButtonStyle.Danger)
        );

        const embed = new EmbedBuilder()
            .setTitle("🎃 BẦU CUA HOÀNG GIA - BOTTOAN")
            .setDescription(`${extraMsg}\n💰 Tài sản của mày: **${formatMoney(balance)}**\n👇 Chọn mức cược ở menu trên, sau đó chọn 1 linh vật bên dưới để cược:`)
            .setColor(colorHex)
            .setThumbnail(message.author.displayAvatarURL())
            .setFooter({ text: "Chọn linh vật để bắt đầu vòng quay." });

        if (interaction) {
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ embeds: [embed], components: [row0, row1, row2, row3] }).catch(()=>{});
            } else {
                await interaction.update({ embeds: [embed], components: [row0, row1, row2, row3] }).catch(()=>{});
            }
        } else {
            await draftMsg.edit({ content: "", embeds: [embed], components: [row0, row1, row2, row3] }).catch(()=>{});
        }
    };

    collector.on('collect', async i => {
        if (i.user.id !== userId) {
            await i.reply({ content: "Đứa nào chơi máy đứa nấy, đừng có bấm ké!", ephemeral: true }).catch(()=>{});
            return;
        }

        // Xử lý thay đổi mức cược
        if (i.isStringSelectMenu() && i.customId === 'bc_bet_size') {
            currentBetSize = parseInt(i.values[0]);
            await i.deferUpdate().catch(()=>{});
            await updateBoard();
            return;
        }

        if (!i.isButton()) return;

        if (isProcessing) {
            await i.reply({ content: "Từ từ thôi mày, đang xóc chưa mở bát!", ephemeral: true }).catch(()=>{});
            return;
        }

        if (i.customId === 'bc_nghi') {
            const finalBalance = await getBalance(userId);
            let msg = `🏃 Mày đã xách quần bỏ chạy với **${formatMoney(finalBalance)}**. `;
            msg += finalBalance > 100 ? "Khôn đấy, ăn được của ngoại rồi lủi!" : "Lỗ chổng vó mà vẫn chịu nghỉ là dũng cảm đấy!";
            
            const embed = new EmbedBuilder()
                .setTitle("🎃 BẦU CUA HOÀNG GIA - NGHỈ CHƠI")
                .setDescription(msg)
                .setColor(0xFFA500)
                .setThumbnail(message.author.displayAvatarURL());

            await i.update({ embeds: [embed], components: [] }).catch(()=>{});
            collector.stop();
            return;
        }

        isProcessing = true;

        try {
            const betSymbol = i.customId.split('_')[1];
            if (!bauCuaSymbols.includes(betSymbol)) {
                isProcessing = false;
                return;
            }

            let balance = await getBalance(userId);
            if (balance < currentBetSize) {
                await i.reply({ content: `Ví còn có ${formatMoney(balance)} mà đòi cược ${formatMoney(currentBetSize)}! Hạ mức cược hoặc đi vay tiền đi.`, ephemeral: true }).catch(()=>{});
                isProcessing = false;
                return;
            }

            // Trừ tiền cược
            balance -= currentBetSize;
            await updateBalance(userId, balance);

            await i.deferUpdate().catch(()=>{});

            // Giai đoạn hiệu ứng xóc bát (3 giây, 1s/khung hình)
            const shakeFrames = [
                "┌──────────────────────────────┐\n│      🎏 BẦU CUA TRÀ CHIẾU     │\n├──────────────────────────────┤\n│      🎃   -   🦀   -   🦐        │\n│    👉 ĐANG XOAY BẦU CUA...   │\n└──────────────────────────────┘",
                "┌──────────────────────────────┐\n│      🎏 BẦU CUA TRÀ CHIẾU     │\n├──────────────────────────────┤\n│      🐟   -   🐓   -   🦌        │\n│    👉 LẮC LẮC LẮC LẮC...     │\n└──────────────────────────────┘",
                "┌──────────────────────────────┐\n│      🎏 BẦU CUA TRÀ CHIẾU     │\n├──────────────────────────────┤\n│      🦀   -   🐟   -   🐓        │\n│    🎲 CHUẨN BỊ MỞ BÁT!!!      │\n└──────────────────────────────┘"
            ];

            for (let step = 0; step < 3; step++) {
                const animEmbed = new EmbedBuilder()
                    .setTitle("🎃 BẦU CUA HOÀNG GIA - ĐANG XÓC...")
                    .setDescription(`\`\`\`text\n${shakeFrames[step]}\n\`\`\``)
                    .setColor(0xFFA500)
                    .setThumbnail(message.author.displayAvatarURL());
                
                await draftMsg.edit({ embeds: [animEmbed], components: [] }).catch(()=>{});
                await sleep(1000); // 1 giây delay để tránh rate limit
            }

            // Lắc ra kết quả thật
            const result = [
                bauCuaSymbols[Math.floor(Math.random() * 6)],
                bauCuaSymbols[Math.floor(Math.random() * 6)],
                bauCuaSymbols[Math.floor(Math.random() * 6)]
            ];

            // Tính tiền thắng/thua
            let matchCount = result.filter(s => s === betSymbol).length;
            const finalBox = `┌──────────────────────────────┐\n│      🎏 BẦU CUA TRÀ CHIẾU     │\n├──────────────────────────────┤\n│  ✨   [ ${bauCuaEmojis[result[0]]} ]   [ ${bauCuaEmojis[result[1]]} ]   [ ${bauCuaEmojis[result[2]]} ]   ✨ │\n└──────────────────────────────┘`;
            let resultMsg = `🎲 **Bát xóc mở ra:**\n\`\`\`text\n${finalBox}\n\`\`\`\n`;
            let finalColor = 0xE74C3C; // Đỏ Ruby

            if (matchCount > 0) {
                const winAmount = currentBetSize + (matchCount * currentBetSize); // Hoàn cược + tiền thắng
                balance += winAmount;
                await updateBalance(userId, balance);
                resultMsg += `🎉 **Trúng ${matchCount} nháy!** Mày lụm lãi **${formatMoney(matchCount * currentBetSize)}**.`;
                finalColor = 0x2ECC71; // Xanh Ngọc
            } else {
                resultMsg += `💀 **Mất cmn ${formatMoney(currentBetSize)}** cược con ${betSymbol}!`;
            }

            await updateBoard(null, resultMsg, finalColor);
        } catch (error) {
            console.error("[BẦU CUA LỖI] Lỗi trong lượt lắc:", error);
        } finally {
            isProcessing = false;
        }
    });

    collector.on('end', () => {
        draftMsg.edit({ components: [] }).catch(()=>{});
    });

    await updateBoard();
}
