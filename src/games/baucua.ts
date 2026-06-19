import { Message, ComponentType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { getBalance, updateBalance, getDebt, getChatBanExpires } from '../database';
import { sleep, formatMoney, activeGamePlayers } from '../utils';

const bauCuaSymbols = ["Bầu", "Cua", "Tôm", "Cá", "Gà", "Nai"];
const bauCuaEmojis: { [key: string]: string } = {
    "Bầu": "🎃", "Cua": "🦀", "Tôm": "🦐", "Cá": "🐟", "Gà": "🐓", "Nai": "🦌"
};

/**
 * Bắt đầu sòng Bầu Cua cho một người dùng
 */
export async function playBauCua(message: Message) {
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
    let currentBetSize = 10; // Mặc định cược 10k per click
    const currentBets: { [symbol: string]: number } = {};
    let selectedCount = 0;
    
    // Tự động cấp vốn 100k nếu chưa có hoặc phá sản
    await getBalance(userId);

        const draftMsg = await message.reply("🎲 **ĐANG TRẢI CHIẾU SÒNG BẦU CUA...**");
    // Chỉ add vào Set SAU khi draftMsg tồn tại — đảm bảo luôn được xoá trong collector.on('end')
    activeGamePlayers.add(userId);
    const collector = draftMsg.createMessageComponentCollector({ time: 300000 }); // Sòng tồn tại 5 phút

    const updateBoard = async (interaction?: any, extraMsg = "", colorHex = 0x00AE86) => {
        const balance = await getBalance(userId);
        
        // Xử lý khi phá sản (dưới 10k không đủ cược VÀ chưa cược gì)
        if (balance < 10 && selectedCount === 0) {
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

        const getSymbolLabel = (symbol: string) => {
            const count = currentBets[symbol] ? currentBets[symbol] / currentBetSize : 0;
            return count > 0 ? `${symbol} (${count} cược)` : symbol;
        };

        const row0 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('bc_bet_size')
                .setPlaceholder(`💵 Mức cược mỗi click: ${formatMoney(currentBetSize)} (Bấm để chọn)`)
                .addOptions(
                    new StringSelectMenuOptionBuilder().setLabel('10k (Min)').setValue('10').setEmoji('🪙'),
                    new StringSelectMenuOptionBuilder().setLabel('20k').setValue('20').setEmoji('💵'),
                    new StringSelectMenuOptionBuilder().setLabel('30k').setValue('30').setEmoji('💸'),
                    new StringSelectMenuOptionBuilder().setLabel('40k').setValue('40').setEmoji('💰'),
                    new StringSelectMenuOptionBuilder().setLabel('50k (Max)').setValue('50').setEmoji('💎')
                )
        );

        const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('bc_Bầu').setLabel(getSymbolLabel('Bầu')).setEmoji('🎃').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('bc_Cua').setLabel(getSymbolLabel('Cua')).setEmoji('🦀').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('bc_Tôm').setLabel(getSymbolLabel('Tôm')).setEmoji('🦐').setStyle(ButtonStyle.Primary)
        );
        const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('bc_Cá').setLabel(getSymbolLabel('Cá')).setEmoji('🐟').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('bc_Gà').setLabel(getSymbolLabel('Gà')).setEmoji('🐓').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('bc_Nai').setLabel(getSymbolLabel('Nai')).setEmoji('🦌').setStyle(ButtonStyle.Success)
        );
        const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('bc_quay').setLabel('🎲 Mở Bát (Quay)').setStyle(ButtonStyle.Success).setDisabled(selectedCount === 0),
            new ButtonBuilder().setCustomId('bc_reset').setLabel('🔄 Hủy cược (Hoàn ví)').setStyle(ButtonStyle.Primary).setDisabled(selectedCount === 0),
            new ButtonBuilder().setCustomId('bc_nghi').setLabel('🏃 Nghỉ chơi / Chốt lãi').setStyle(ButtonStyle.Danger)
        );

        // Hiển thị danh sách cược hiện tại
        let betListText = "";
        if (selectedCount > 0) {
            const bets = Object.keys(currentBets).map(sym => `**${sym}**: ${formatMoney(currentBets[sym])}`).join(", ");
            betListText = `👉 **Đã cược ván này:** ${bets} *(Tổng cược: ${selectedCount}/3 lượt)*\n`;
        } else {
            betListText = `👉 **Đã cược ván này:** *Chưa đặt cược (Click linh vật để đặt)*\n`;
        }

        const embed = new EmbedBuilder()
            .setTitle("🎃 BẦU CUA HOÀNG GIA - BOTTOAN")
            .setDescription(`${extraMsg}\n💰 Tài sản ví hiện tại: **${formatMoney(balance)}**\n${betListText}\n👇 Chọn mức tiền cược mỗi lần click ở menu, đặt tối đa 3 cược ở các nút linh vật, sau đó bấm **Mở Bát** để quay:`)
            .setColor(colorHex)
            .setThumbnail(message.author.displayAvatarURL())
            .setFooter({ text: "Hủy cược để lấy lại tiền cược đã đặt nếu muốn." });

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

        const banExpires = await getChatBanExpires(i.user.id);
        if (banExpires > Date.now()) {
            await i.reply({ content: "🚓 Mày đang bóc lịch trong đồn mà vẫn lén dùng điện thoại đánh bạc à? Cất ngay!", ephemeral: true }).catch(()=>{});
            return;
        }

        try {
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

        // Xử lý nút Nghỉ chơi
        if (i.customId === 'bc_nghi') {
            let balance = await getBalance(userId);
            // Nếu đang cược dở mà nghỉ, hoàn tiền lại ví
            let totalRefund = 0;
            for (const sym of Object.keys(currentBets)) {
                totalRefund += currentBets[sym];
            }
            if (totalRefund > 0) {
                balance += totalRefund;
                await updateBalance(userId, balance);
            }
            
            let msg = `🏃 Mày đã xách quần bỏ chạy khỏi sòng Bầu Cua với **${formatMoney(balance)}**. `;
            msg += balance > 100 ? "Khôn đấy, ăn được của ngoại rồi lủi!" : "Lỗ chổng vó mà vẫn chịu nghỉ là dũng cảm đấy!";
            
            const embed = new EmbedBuilder()
                .setTitle("🎃 BẦU CUA HOÀNG GIA - NGHỈ CHƠI")
                .setDescription(msg)
                .setColor(0xFFA500)
                .setThumbnail(message.author.displayAvatarURL());

            await i.update({ embeds: [embed], components: [] }).catch(()=>{});
            collector.stop();
            return;
        }

        // Xử lý nút Hủy cược
        if (i.customId === 'bc_reset') {
            let balance = await getBalance(userId);
            let totalRefund = 0;
            for (const sym of Object.keys(currentBets)) {
                totalRefund += currentBets[sym];
            }
            if (totalRefund > 0) {
                balance += totalRefund;
                await updateBalance(userId, balance);
            }
            
            // Reset bets
            for (const key of Object.keys(currentBets)) {
                delete currentBets[key];
            }
            selectedCount = 0;

            await i.deferUpdate().catch(()=>{});
            await updateBoard(null, "🔄 Đã hủy toàn bộ cược ván này. Tiền đã hoàn trả lại ví của mày!");
            return;
        }

        // Xử lý nút Mở Bát (Quay)
        if (i.customId === 'bc_quay') {
            if (selectedCount === 0) {
                await i.reply({ content: "Mày phải đặt cược ít nhất 1 cửa mới mở bát được chứ con trai!", ephemeral: true }).catch(()=>{});
                return;
            }

            isProcessing = true;
            await i.deferUpdate().catch(()=>{});

            try {
                // Giai đoạn hiệu ứng xóc bát (3 giây, 1s/khung hình)
                const shakeFrames = [
                    "┌──────────────────────────────┐\n│      🎏 BẦU CUA TRÀ CHIẾU     │\n├──────────────────────────────┤\n│      🎃   -   🦀   -   🦐        │\n│    👉 ĐANG XOAY BẦU CUA...   │\n└──────────────────────────────┘",
                    "┌──────────────────────────────┐\n│      🎏 BẦU CUA TRÀ CHIẾU     │\n├──────────────────────────────┤\n│      🐟   -   ...   -   ...      │\n│    👉 LẮC LẮC LẮC LẮC...     │\n└──────────────────────────────┘",
                    "┌──────────────────────────────┐\n│      🎏 BẦU CUA TRÀ CHIẾU     │\n├──────────────────────────────┤\n│      🦀   -   🐟   -   🐓        │\n│    🎲 CHUẨN BỊ MỞ BÁT!!!      │\n└──────────────────────────────┘"
                ];

                for (let step = 0; step < 3; step++) {
                    const animEmbed = new EmbedBuilder()
                        .setTitle("🎃 BẦU CUA HOÀNG GIA - ĐANG XÓC...")
                        .setDescription(`\`\`\`text\n${shakeFrames[step]}\n\`\`\``)
                        .setColor(0xFFA500)
                        .setThumbnail(message.author.displayAvatarURL());
                    
                    await draftMsg.edit({ embeds: [animEmbed], components: [] }).catch(()=>{});
                    await sleep(1000);
                }

                // Lắc ra kết quả thật
                const result = [
                    bauCuaSymbols[Math.floor(Math.random() * 6)],
                    bauCuaSymbols[Math.floor(Math.random() * 6)],
                    bauCuaSymbols[Math.floor(Math.random() * 6)]
                ];

                // Tính tiền thắng/thua
                let totalWinAmount = 0;
                let winDetails = [];
                let lossDetails = [];

                for (const sym of Object.keys(currentBets)) {
                    const betAmount = currentBets[sym];
                    const matchCount = result.filter(s => s === sym).length;
                    
                    if (matchCount > 0) {
                        const winProfit = matchCount * betAmount;
                        totalWinAmount += (betAmount + winProfit); // Hoàn cược + tiền thắng
                        winDetails.push(`**${sym}** (trúng ${matchCount} nháy: ăn **+${formatMoney(winProfit)}**)`);
                    } else {
                        lossDetails.push(`**${sym}** (mất **-${formatMoney(betAmount)}**)`);
                    }
                }

                let balance = await getBalance(userId);
                balance += totalWinAmount;
                await updateBalance(userId, balance);

                // Tạo chuỗi kết quả xí ngầu
                const finalBox = `┌──────────────────────────────┐\n│      🎏 BẦU CUA TRÀ CHIẾU     │\n├──────────────────────────────┤\n│  ✨   [ ${bauCuaEmojis[result[0]]} ]   [ ${bauCuaEmojis[result[1]]} ]   [ ${bauCuaEmojis[result[2]]} ]   ✨ │\n└──────────────────────────────┘`;
                let resultMsg = `🎲 **Bát xóc mở ra:**\n\`\`\`text\n${finalBox}\n\`\`\`\n`;

                let finalColor = 0xE74C3C; // Mặc định thua (Đỏ Ruby)
                if (winDetails.length > 0) {
                    finalColor = 0x2ECC71; // Thắng (Xanh Ngọc)
                    resultMsg += `🎉 **Thắng cược:** ${winDetails.join(", ")}\n`;
                }
                if (lossDetails.length > 0) {
                    resultMsg += `💀 **Thua cược:** ${lossDetails.join(", ")}\n`;
                }

                const netProfit = totalWinAmount - Object.values(currentBets).reduce((a, b) => a + b, 0);
                if (netProfit > 0) {
                    resultMsg += `\n💰 **Tổng kết ván:** Mày ăn ròng **${formatMoney(netProfit)}**!`;
                } else if (netProfit < 0) {
                    resultMsg += `\n💰 **Tổng kết ván:** Mày lỗ **${formatMoney(Math.abs(netProfit))}**!`;
                } else {
                    resultMsg += `\n💰 **Tổng kết ván:** Hòa vốn!`;
                }

                // Reset cược của ván vừa chơi (MANDATORY RESET)
                for (const key of Object.keys(currentBets)) {
                    delete currentBets[key];
                }
                selectedCount = 0;

                await updateBoard(null, resultMsg, finalColor);
            } catch (error) {
                console.error("[BẦU CUA LỖI] Lỗi trong lượt lắc:", error);
            } finally {
                isProcessing = false;
            }
            return;
        }

        // Xử lý khi nhấn nút đặt cược các cửa Bầu, Cua, Tôm, Cá, Gà, Nai
        const betSymbol = i.customId.split('_')[1];
        if (bauCuaSymbols.includes(betSymbol)) {
            if (selectedCount >= 3) {
                await i.reply({ content: "Mày chỉ được cược tối đa 3 lượt (lần click) mỗi ván thôi!", ephemeral: true }).catch(()=>{});
                return;
            }

            let balance = await getBalance(userId);
            if (balance < currentBetSize) {
                await i.reply({ content: `Ví còn có ${formatMoney(balance)}, đéo đủ đặt thêm mức cược ${formatMoney(currentBetSize)}!`, ephemeral: true }).catch(()=>{});
                return;
            }

            // Trừ tiền cược ngay khi click đặt
            balance -= currentBetSize;
            await updateBalance(userId, balance);

            // Ghi nhận cược
            currentBets[betSymbol] = (currentBets[betSymbol] || 0) + currentBetSize;
            selectedCount++;

            await i.deferUpdate().catch(()=>{});
            await updateBoard(null, `🛒 Đã đặt cược **${formatMoney(currentBetSize)}** vào cửa **${betSymbol}**.`);
        }
        } catch (err) {
            console.error("[BẦU CUA LỖI] Lỗi ván Bầu Cua:", err);
            isProcessing = false;
            collector.stop();
        }
    });

    collector.on('end', () => {
        activeGamePlayers.delete(userId);
        draftMsg.edit({ components: [] }).catch(()=>{});
    });

    await updateBoard();
}
