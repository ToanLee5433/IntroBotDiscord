import { Message, ComponentType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { getBalance, updateBalance } from '../database';

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
    
    // Tự động cấp vốn 100k nếu chưa có hoặc phá sản
    await getBalance(userId);

    const draftMsg = await message.reply("🎲 **ĐANG TRẢI CHIẾU SÒNG BẦU CUA...**");
    const collector = draftMsg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 300000 }); // Sòng tồn tại 5 phút

    const updateBoard = async (interaction?: any, extraMsg = "", colorHex = 0x00AE86) => {
        const balance = await getBalance(userId);
        
        // Xử lý khi phá sản (dưới 10k không đủ cược)
        if (balance < 10) {
            const text = `${extraMsg}\n💸 **CHÁY TÚI!** Mày còn đúng ${balance}k, đéo đủ 1 ván cược. Cờ bạc bác thằng bần con ạ! (Gõ lệnh gọi tao lần nữa để xin nạp lại 100k).`;
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
            .setDescription(`${extraMsg}\n💰 Tài sản của mày: **${balance}k**\n👇 Chọn 1 con để cược **10k/ván**:`)
            .setColor(colorHex)
            .setThumbnail(message.author.displayAvatarURL())
            .setFooter({ text: "Mỗi ván cược trị giá 10k" });

        if (interaction) await interaction.update({ embeds: [embed], components: [row1, row2, row3] }).catch(()=>{});
        else await draftMsg.edit({ embeds: [embed], components: [row1, row2, row3] }).catch(()=>{});
    };

    collector.on('collect', async i => {
        // Chặn người lạ bấm ké
        if (i.user.id !== userId) {
            await i.reply({ content: "Đứa nào chơi máy đứa nấy, đừng có bấm ké!", ephemeral: true }).catch(()=>{});
            return;
        }

        // Chặn spam khi đang lắc hoặc cập nhật số dư cũ chưa xong
        if (isProcessing) {
            await i.reply({ content: "Từ từ thôi mày, đang lắc xí ngầu chưa xong!", ephemeral: true }).catch(()=>{});
            return;
        }

        // Xử lý nút Nghỉ
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
            // Xử lý cược
            const betSymbol = i.customId.split('_')[1];
            if (!bauCuaSymbols.includes(betSymbol)) {
                isProcessing = false;
                return;
            }

            let balance = await getBalance(userId);
            balance -= 10; // Trừ tiền cược
            await updateBalance(userId, balance);

            // Lắc 3 viên xí ngầu
            const result = [
                bauCuaSymbols[Math.floor(Math.random() * 6)],
                bauCuaSymbols[Math.floor(Math.random() * 6)],
                bauCuaSymbols[Math.floor(Math.random() * 6)]
            ];

            // Tính tiền
            let matchCount = result.filter(s => s === betSymbol).length;
            let resultMsg = `🎲 Vừa lắc ra: **${result.map(s => bauCuaEmojis[s]).join(' - ')}** | `;
            let finalColor = 0xFF0000;

            if (matchCount > 0) {
                const winAmount = 10 + (matchCount * 10); // Trả lại tiền cược + tiền ăn
                balance += winAmount;
                await updateBalance(userId, balance);
                resultMsg += `🎉 Trúng ${matchCount} nháy! Mày lụm **${matchCount * 10}k**.`;
                finalColor = 0x00FF00;
            } else {
                resultMsg += `💀 Mất cmn **10k** cược con ${betSymbol}!`;
            }

            await updateBoard(i, resultMsg, finalColor);
        } catch (error) {
            console.error("[BẦU CUA LỖI] Lỗi trong lượt lắc:", error);
        } finally {
            isProcessing = false;
        }
    });

    collector.on('end', () => {
        // Dọn dẹp hàng nút bấm khi kết thúc phiên chơi
        draftMsg.edit({ components: [] }).catch(()=>{});
    });

    await updateBoard();
}


