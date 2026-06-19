import { Message, ComponentType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { getBalance, updateBalance } from '../database';
import { sleep } from '../utils';

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
            const text = `${extraMsg}\n💸 **CHÁY TÚI!** Mày còn đúng ${balance}k, đéo đủ cược mức tối thiểu. Đi vay tiền đi con ạ!`;
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
                .setPlaceholder(`💵 Mức cược: ${currentBetSize}k (Bấm để chọn)`)
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
            .setDescription(`${extraMsg}\n💰 Tài sản của mày: **${balance}k**\n👇 Chọn mức cược ở menu trên, sau đó chọn 1 linh vật bên dưới để cược:`)
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
            let msg = `🏃 Mày đã xách quần bỏ chạy với **${finalBalance}k**. `;
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
                await i.reply({ content: `Ví còn có ${balance}k mà đòi cược ${currentBetSize}k! Hạ mức cược hoặc đi vay tiền đi.`, ephemeral: true }).catch(()=>{});
                isProcessing = false;
                return;
            }

            // Trừ tiền cược
            balance -= currentBetSize;
            await updateBalance(userId, balance);

            await i.deferUpdate().catch(()=>{});

            // Giai đoạn hiệu ứng xóc bát (4 khung hình lắc)
            for (let step = 0; step < 4; step++) {
                const t = [
                    bauCuaSymbols[Math.floor(Math.random() * 6)],
                    bauCuaSymbols[Math.floor(Math.random() * 6)],
                    bauCuaSymbols[Math.floor(Math.random() * 6)]
                ];
                const box = `╔══════════════════════════════╗\n║    [ ${bauCuaEmojis[t[0]]} ]    [ ${bauCuaEmojis[t[1]]} ]    [ ${bauCuaEmojis[t[2]]} ]    ║\n║        🔄 ĐANG XÓC ĐĨA BẦU CUA...      ║\n╚══════════════════════════════╝`;
                
                const animEmbed = new EmbedBuilder()
                    .setTitle("🎃 BẦU CUA HOÀNG GIA - ĐANG XÓC...")
                    .setDescription(`\`\`\`text\n${box}\n\`\`\``)
                    .setColor(0xFFA500)
                    .setThumbnail(message.author.displayAvatarURL());
                
                await draftMsg.edit({ embeds: [animEmbed], components: [] }).catch(()=>{});
                await sleep(450);
            }

            // Lắc ra kết quả thật
            const result = [
                bauCuaSymbols[Math.floor(Math.random() * 6)],
                bauCuaSymbols[Math.floor(Math.random() * 6)],
                bauCuaSymbols[Math.floor(Math.random() * 6)]
            ];

            // Tính tiền thắng/thua
            let matchCount = result.filter(s => s === betSymbol).length;
            const finalBox = `╔══════════════════════════════╗\n║  ✨  [ ${bauCuaEmojis[result[0]]} ]    [ ${bauCuaEmojis[result[1]]} ]    [ ${bauCuaEmojis[result[2]]} ]  ✨  ║\n╚══════════════════════════════╝`;
            let resultMsg = `🎲 **Bát xóc mở ra:**\n\`\`\`text\n${finalBox}\n\`\`\`\n`;
            let finalColor = 0xFF0000;

            if (matchCount > 0) {
                const winAmount = currentBetSize + (matchCount * currentBetSize); // Hoàn cược + tiền thắng
                balance += winAmount;
                await updateBalance(userId, balance);
                resultMsg += `🎉 **Trúng ${matchCount} nháy!** Mày lụm lãi **${matchCount * currentBetSize}k**.`;
                finalColor = 0x00FF00;
            } else {
                resultMsg += `💀 **Mất cmn ${currentBetSize}k** cược con ${betSymbol}!`;
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
