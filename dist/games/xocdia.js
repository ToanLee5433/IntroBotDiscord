"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.playXocDia = playXocDia;
const discord_js_1 = require("discord.js");
const database_1 = require("../database");
const utils_1 = require("../utils");
/**
 * Bắt đầu sòng Xóc Đĩa cho một người dùng
 */
async function playXocDia(message) {
    const userId = message.author.id;
    const debt = await (0, database_1.getDebt)(userId);
    if (debt >= 500) {
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle("🚫 BỊ CẤM CỬA VÀO SÒNG CASINO")
            .setDescription(`💀 **MÀY ĐANG NỢ KỊCH TRẦN (>= 500K)!**\nHiện tại mày đang nợ ngân hàng BotToan tổng cộng **${(0, utils_1.formatMoney)(debt)}**.\n\nTheo luật **"Nợ là Danh dự"**, mày bị cấm cửa tham gia mọi sòng cờ bạc đỏ đen khi nợ kịch trần (>= 500k)! Mau gõ \`@BotToan tra no het\` để trả nợ rồi mới được chơi tiếp con ạ!`)
            .setColor(0xFF0000)
            .setThumbnail(message.author.displayAvatarURL());
        await message.reply({ embeds: [embed] });
        return;
    }
    let isProcessing = false;
    let currentBetSize = 10; // Mặc định cược 10k
    // Tự động cấp vốn 100k nếu chưa có hoặc phá sản
    await (0, database_1.getBalance)(userId);
    // Khởi tạo tin nhắn TRƯỚC khi add vào activeGamePlayers
    const draftMsg = await message.reply("🎲 **ĐANG ĐẬY BÁT XÓC ĐĨA... TRÁNH RA CHO BẤT LÊN NÀO!**");
    // Chỉ add vào Set SAU khi có collector — đảm bảo luôn được xoá trong collector.on('end')
    utils_1.activeGamePlayers.add(userId);
    const collector = draftMsg.createMessageComponentCollector({ time: 300000 }); // Sòng tồn tại 5 phút
    const updateBoard = async (interaction, extraMsg = "", colorHex = 0x00AE86) => {
        const balance = await (0, database_1.getBalance)(userId);
        if (balance < 10) {
            const text = `${extraMsg}\n💸 **CHÁY TÚI!** Mày còn đúng ${(0, utils_1.formatMoney)(balance)}, đéo đủ cược ván tối thiểu ${(0, utils_1.formatMoney)(10)}. Cờ bạc bác thằng bần con ạ!`;
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle("🎰 SÒNG XÓC ĐĨA - CHÁY TÚI")
                .setDescription(text)
                .setColor(0xFF0000)
                .setThumbnail(message.author.displayAvatarURL())
                .setFooter({ text: "BotToan - Sòng bạc hoàng gia" });
            if (interaction)
                await interaction.update({ embeds: [embed], components: [] }).catch(() => { });
            else
                await draftMsg.edit({ embeds: [embed], components: [] }).catch(() => { });
            collector.stop();
            return;
        }
        const row0 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.StringSelectMenuBuilder()
            .setCustomId('xd_bet_size')
            .setPlaceholder(`💵 Mức cược: ${(0, utils_1.formatMoney)(currentBetSize)} (Bấm để chọn)`)
            .addOptions(new discord_js_1.StringSelectMenuOptionBuilder().setLabel('10k (Min)').setValue('10').setEmoji('🪙'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('20k').setValue('20').setEmoji('💵'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('30k').setValue('30').setEmoji('💸'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('40k').setValue('40').setEmoji('💰'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('50k (Max)').setValue('50').setEmoji('💎')));
        const row1 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId('xd_chan').setLabel('🔴 Chẵn').setStyle(discord_js_1.ButtonStyle.Danger), new discord_js_1.ButtonBuilder().setCustomId('xd_le').setLabel('⚪ Lẻ').setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder().setCustomId('xd_nghi').setLabel('🏃 Chốt lãi / Nghỉ').setStyle(discord_js_1.ButtonStyle.Primary));
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle("🎰 SÒNG XÓC ĐĨA - BOTTOAN")
            .setDescription(`${extraMsg}\n💰 Tài sản của mày: **${(0, utils_1.formatMoney)(balance)}**\n👇 Chọn mức cược ở menu trên, sau đó chọn **Chẵn** hoặc **Lẻ** bên dưới để đặt:`)
            .setColor(colorHex)
            .setThumbnail(message.author.displayAvatarURL())
            .setFooter({ text: "Chẵn: 2 đỏ 2 trắng, 4 đỏ hoặc 4 trắng | Lẻ: 3 đỏ 1 trắng hoặc 3 trắng 1 đỏ." });
        if (interaction) {
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ embeds: [embed], components: [row0, row1] }).catch(() => { });
            }
            else {
                await interaction.update({ embeds: [embed], components: [row0, row1] }).catch(() => { });
            }
        }
        else {
            await draftMsg.edit({ content: "", embeds: [embed], components: [row0, row1] }).catch(() => { });
        }
    };
    collector.on('collect', async (i) => {
        if (i.user.id !== userId) {
            await i.reply({ content: "Đứa nào chơi máy đứa nấy, đừng có bấm ké!", ephemeral: true }).catch(() => { });
            return;
        }
        const banExpires = await (0, database_1.getChatBanExpires)(i.user.id);
        if (banExpires > Date.now()) {
            await i.reply({ content: "🚓 Mày đang bóc lịch trong đồn mà vẫn lén dùng điện thoại đánh bạc à? Cất ngay!", ephemeral: true }).catch(() => { });
            return;
        }
        try {
            // Xử lý thay đổi mức cược
            if (i.isStringSelectMenu() && i.customId === 'xd_bet_size') {
                currentBetSize = parseInt(i.values[0]);
                await i.deferUpdate().catch(() => { });
                await updateBoard();
                return;
            }
            if (!i.isButton())
                return;
            if (isProcessing) {
                await i.reply({ content: "Từ từ thôi mày, đang xóc chưa mở bát!", ephemeral: true }).catch(() => { });
                return;
            }
            if (i.customId === 'xd_nghi') {
                const finalBalance = await (0, database_1.getBalance)(userId);
                let msg = `🏃 Mày đã xách quần bỏ chạy khỏi sòng xóc đĩa với **${(0, utils_1.formatMoney)(finalBalance)}**. `;
                msg += finalBalance > 100 ? "Ăn non thế là tốt đấy con trai!" : "Lỗ chổng vó mà vẫn chịu nghỉ là dũng cảm đấy!";
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle("🎰 SÒNG XÓC ĐĨA - NGHỈ CHƠI")
                    .setDescription(msg)
                    .setColor(0xFFA500)
                    .setThumbnail(message.author.displayAvatarURL());
                await i.update({ embeds: [embed], components: [] }).catch(() => { });
                collector.stop();
                return;
            }
            isProcessing = true;
            try {
                const userBet = i.customId.split('_')[1]; // 'chan' hoặc 'le'
                let balance = await (0, database_1.getBalance)(userId);
                if (balance < currentBetSize) {
                    await i.reply({ content: `Ví còn có ${(0, utils_1.formatMoney)(balance)} mà đòi cược ${(0, utils_1.formatMoney)(currentBetSize)}! Hạ mức cược hoặc đi vay tiền đi.`, ephemeral: true }).catch(() => { });
                    return;
                }
                // Trừ tiền cược
                balance -= currentBetSize;
                await (0, database_1.updateBalance)(userId, balance);
                await i.deferUpdate().catch(() => { });
                // Giai đoạn hiệu ứng xóc bát (3 giây, 1s/khung hình)
                const shakeFrames = [
                    "┌──────────────────────────────┐\n│     ⛩️ XÓC ĐĨA HOÀNG GIA     │\n├──────────────────────────────┤\n│          ___/^^\\___          │\n│         |  LẠCH CẠCH  |      │\n│          \\________/          │\n│         ============         │\n└──────────────────────────────┘",
                    "┌──────────────────────────────┐\n│     ⛩️ XÓC ĐĨA HOÀNG GIA     │\n├──────────────────────────────┤\n│          ___/^^\\___          │\n│         |  CẠCH LẠCH  |      │\n│          \\________/          │\n│         ============         │\n└──────────────────────────────┘",
                    "┌──────────────────────────────┐\n│     ⛩️ XÓC ĐĨA HOÀNG GIA     │\n├──────────────────────────────┤\n│          ___/^^\\___          │\n│         |  🎲 ĐỢI MỞ... |      │\n│          \\________/          │\n│         ============         │\n└──────────────────────────────┘"
                ];
                for (let step = 0; step < 3; step++) {
                    const animEmbed = new discord_js_1.EmbedBuilder()
                        .setTitle("🎰 ĐANG XÓC ĐĨA...")
                        .setDescription(`\`\`\`text\n${shakeFrames[step]}\n\`\`\``)
                        .setColor(0xFFA500)
                        .setThumbnail(message.author.displayAvatarURL());
                    await draftMsg.edit({ embeds: [animEmbed], components: [] }).catch(() => { });
                    await (0, utils_1.sleep)(1000); // 1 giây delay
                }
                // Lắc 4 quân vị (Đỏ hoặc Trắng)
                const coins = Array.from({ length: 4 }, () => Math.random() < 0.5 ? "Đỏ" : "Trắng");
                const redCount = coins.filter(c => c === "Đỏ").length;
                const whiteCount = 4 - redCount;
                const isChan = redCount % 2 === 0;
                const actualResult = isChan ? "chan" : "le";
                const actualResultText = isChan ? "CHẴN 🔴" : "LẺ ⚪";
                const coinEmojis = coins.map(c => c === "Đỏ" ? "🔴" : "⚪").join(" ");
                const plateFrame = `┌──────────────────────────────┐\n│         (ĐĨA MỞ BÁT)         │\n│                              │\n│        ${coinEmojis}         │\n│        ============          │\n└──────────────────────────────┘`;
                let resultMsg = `🎲 **Bát xóc mở ra:**\n\`\`\`text\n${plateFrame}\n\`\`\`\nKết quả: **${actualResultText}** (${redCount} Đỏ - ${whiteCount} Trắng)\n\n`;
                const isWin = userBet === actualResult;
                let finalColor = 0xE74C3C; // Đỏ Ruby
                if (isWin) {
                    const winAmount = currentBetSize * 2; // Hoàn cược + ăn lãi 1:1
                    const latestBalance = await (0, database_1.getBalance)(userId);
                    await (0, database_1.updateBalance)(userId, latestBalance + winAmount);
                    resultMsg += `🎉 **Mày đã thắng!** Húp về **${(0, utils_1.formatMoney)(currentBetSize)}**.`;
                    finalColor = 0x2ECC71; // Xanh Ngọc
                }
                else {
                    resultMsg += `💀 **Mày đã thua!** Mất cmn **${(0, utils_1.formatMoney)(currentBetSize)}** cược con ${userBet === "chan" ? "Chẵn" : "Lẻ"}.`;
                }
                await updateBoard(null, resultMsg, finalColor);
            }
            catch (error) {
                console.error("[XÓC ĐĨA LỖI] Lỗi ván xóc:", error);
            }
            finally {
                isProcessing = false;
            }
        }
        catch (err) {
            console.error("[XÓC ĐĨA LỖI] Lỗi ván Xóc Đĩa:", err);
            isProcessing = false;
            collector.stop();
        }
    });
    collector.on('end', () => {
        // Đảm bảo LUÔN xoá khỏi danh sách đang chơi dù game kết thúc bình thường hay bị lỗi
        utils_1.activeGamePlayers.delete(userId);
        draftMsg.edit({ components: [] }).catch(() => { });
    });
    await updateBoard();
}
