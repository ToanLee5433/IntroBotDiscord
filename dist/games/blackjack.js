"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.playBlackjack = playBlackjack;
const discord_js_1 = require("discord.js");
const database_1 = require("../database");
const utils_1 = require("../utils");
const suits = ["♠", "♥", "♦", "♣"];
const values = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
function drawCard() {
    const suit = suits[Math.floor(Math.random() * suits.length)];
    const value = values[Math.floor(Math.random() * values.length)];
    let score = 0;
    if (value === "A") {
        score = 11;
    }
    else if (["J", "Q", "K"].includes(value)) {
        score = 10;
    }
    else {
        score = parseInt(value);
    }
    return { suit, value, score };
}
function calculateScore(hand) {
    let score = hand.reduce((sum, card) => sum + card.score, 0);
    let aceCount = hand.filter(c => c.value === "A").length;
    while (score > 21 && aceCount > 0) {
        score -= 10;
        aceCount -= 1;
    }
    return score;
}
function displayHand(hand, hideSecond = false) {
    if (hideSecond && hand.length >= 2) {
        return `[ ${hand[0].value}${hand[0].suit} ]  [ 🂠 ? ]`;
    }
    return hand.map(c => `[ ${c.value}${c.suit} ]`).join("  ");
}
/**
 * Bắt đầu sòng bài Xì Dách / Blackjack cho một người dùng
 */
async function playBlackjack(message) {
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
    // Phí vào bàn là 20k
    let balance = await (0, database_1.getBalance)(userId);
    if (balance < 20) {
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle("🃏 SÒNG BÀI BLACKJACK - CHÁY TÚI")
            .setDescription(`💸 **ĐÉO ĐỦ TIỀN VÀO BÀN!** Mày chỉ còn **${(0, utils_1.formatMoney)(balance)}**.\nLệ phí cược Blackjack tối thiểu là **${(0, utils_1.formatMoney)(20)}**. Đi điểm danh hoặc vay tiền đi con ạ!`)
            .setColor(0xFF0000)
            .setThumbnail(message.author.displayAvatarURL());
        await message.reply({ embeds: [embed] });
        return;
    }
    // Trừ tiền cược đầu bàn
    balance -= 20;
    await (0, database_1.updateBalance)(userId, balance);
    const draftMsg = await message.reply("🃏 **ĐANG XÀO BÀI... CHUẨN BỊ CHIA BÀI!**");
    // Chỉ add vào Set SAU khi draftMsg tồn tại — đảm bảo luôn được xoá trong collector.on('end')
    utils_1.activeGamePlayers.add(userId);
    const collector = draftMsg.createMessageComponentCollector({ time: 300000 }); // Phiên chơi tối đa 5 phút
    // Hiệu ứng chia bài trễ 1 giây
    const dealAnimEmbed = new discord_js_1.EmbedBuilder()
        .setTitle("🃏 ĐANG CHIA BÀI BLACKJACK...")
        .setDescription("```text\n┌──────────────────────────────┐\n│      🃏 CASINO BLACKJACK 🃏  │\n├──────────────────────────────┤\n│  Dealer: [ 🂠 ] [ 🂠 ]         │\n│  Mày:    [ 🂠 ] [ 🂠 ]         │\n│                              │\n│   👉 ĐANG PHÁT BÀI...        │\n└──────────────────────────────┘\n```")
        .setColor(0xFFA500)
        .setThumbnail(message.author.displayAvatarURL());
    await draftMsg.edit({ embeds: [dealAnimEmbed] }).catch(() => { });
    await (0, utils_1.sleep)(1000); // Trễ 1 giây để tránh Rate Limit và tăng độ hồi hộp
    // Phát bài ban đầu
    const playerHand = [drawCard(), drawCard()];
    const dealerHand = [drawCard(), drawCard()];
    const updateBoard = async (interaction, extraMsg = "", isEnded = false, colorHex = 0x00AE86) => {
        const currentBalance = await (0, database_1.getBalance)(userId);
        const playerScore = calculateScore(playerHand);
        const dealerScoreDisplay = isEnded ? `${calculateScore(dealerHand)} đ` : `Ngửa: ${dealerHand[0].score} đ`;
        const boardASCII = `┌──────────────────────────────┐\n` +
            `│     🃏 CASINO BLACKJACK 🃏   │\n` +
            `├──────────────────────────────┤\n` +
            `│ 🕴️ Nhà cái:  ${displayHand(dealerHand, !isEnded)}\n` +
            `│             (${dealerScoreDisplay})\n` +
            `├──────────────────────────────┤\n` +
            `│ 👤 Mày:     ${displayHand(playerHand)}\n` +
            `│             (${playerScore} đ)\n` +
            `└──────────────────────────────┘`;
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle("🃏 BÀN CHƠI BLACKJACK - BOTTOAN")
            .setColor(colorHex)
            .setThumbnail(message.author.displayAvatarURL())
            .setDescription(`\`\`\`text\n${boardASCII}\n\`\`\`\n${extraMsg || `💰 Tài sản còn lại: **${(0, utils_1.formatMoney)(currentBalance)}**\nLệ phí cược ván này: **${(0, utils_1.formatMoney)(20)}**`}`)
            .setFooter({ text: isEnded ? "Trận đấu kết thúc" : "Rút thêm bài (Hit) hoặc Dằn bài (Stand)" });
        if (isEnded) {
            if (interaction)
                await interaction.update({ embeds: [embed], components: [] }).catch(() => { });
            else
                await draftMsg.edit({ embeds: [embed], components: [] }).catch(() => { });
            collector.stop();
            return;
        }
        const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId('bj_hit').setLabel('🃏 Rút bài (Hit)').setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder().setCustomId('bj_stand').setLabel('🛑 Dằn bài (Stand)').setStyle(discord_js_1.ButtonStyle.Danger));
        if (interaction) {
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ embeds: [embed], components: [row] }).catch(() => { });
            }
            else {
                await interaction.update({ embeds: [embed], components: [row] }).catch(() => { });
            }
        }
        else {
            await draftMsg.edit({ embeds: [embed], components: [row] }).catch(() => { });
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
        if (isProcessing) {
            await i.reply({ content: "Từ từ thôi mày, đang rút bài!", ephemeral: true }).catch(() => { });
            return;
        }
        isProcessing = true;
        try {
            const action = i.customId;
            if (action === 'bj_hit') {
                playerHand.push(drawCard());
                const playerScore = calculateScore(playerHand);
                if (playerScore > 21) {
                    // Người chơi bị QUẮC (Bust)
                    isProcessing = false;
                    await updateBoard(i, `💀 **MÀY BỊ QUẮC RỒI!** Điểm vượt quá 21. Nhà cái lụm cmn **${(0, utils_1.formatMoney)(20)}** cược.`, true, 0xE74C3C);
                    return;
                }
                isProcessing = false;
                await updateBoard(i);
            }
            else if (action === 'bj_stand') {
                // Lượt của Nhà Cái (BotToan) rút bài. Nhà Cái rút cho đến khi >= 17 điểm.
                let dealerScore = calculateScore(dealerHand);
                while (dealerScore < 17) {
                    dealerHand.push(drawCard());
                    dealerScore = calculateScore(dealerHand);
                }
                const playerScore = calculateScore(playerHand);
                let finalMsg = "";
                let colorHex = 0x2ECC71;
                let currentBal = await (0, database_1.getBalance)(userId);
                if (dealerScore > 21) {
                    // Nhà cái bị Quắc
                    currentBal += 40; // Trả cược + thắng 20k
                    await (0, database_1.updateBalance)(userId, currentBal);
                    finalMsg = `🎉 **NHÀ CÁI BỊ QUẮC!** Mày đã thắng và ăn **${(0, utils_1.formatMoney)(20)}**.`;
                    colorHex = 0x2ECC71;
                }
                else if (playerScore > dealerScore) {
                    // Người chơi điểm cao hơn
                    currentBal += 40;
                    await (0, database_1.updateBalance)(userId, currentBal);
                    finalMsg = `🎉 **MÀY THẮNG!** Điểm của mày (${playerScore}) cao hơn nhà cái (${dealerScore}). Húp **${(0, utils_1.formatMoney)(20)}**.`;
                    colorHex = 0x2ECC71;
                }
                else if (playerScore < dealerScore) {
                    // Nhà cái điểm cao hơn
                    finalMsg = `💀 **MÀY THUA!** Điểm nhà cái (${dealerScore}) cao hơn mày (${playerScore}). Mất **${(0, utils_1.formatMoney)(20)}**.`;
                    colorHex = 0xE74C3C;
                }
                else {
                    // Hòa (Push)
                    currentBal += 20; // Hoàn tiền cược
                    await (0, database_1.updateBalance)(userId, currentBal);
                    finalMsg = `🤝 **HÒA NHAU!** Cả hai cùng đạt **${playerScore}** điểm. Hoàn trả **${(0, utils_1.formatMoney)(20)}** cược.`;
                    colorHex = 0xFFA500;
                }
                isProcessing = false;
                await updateBoard(i, finalMsg, true, colorHex);
            }
        }
        catch (err) {
            console.error("[BLACKJACK LỖI] Lỗi trong lúc chơi:", err);
            isProcessing = false;
            collector.stop();
        }
    });
    collector.on('end', async () => {
        utils_1.activeGamePlayers.delete(userId);
        draftMsg.edit({ components: [] }).catch(() => { });
    });
    // Check ngay lập tức nếu người chơi có BlackJack 21 điểm từ đầu
    const initialScore = calculateScore(playerHand);
    if (initialScore === 21) {
        let currentBal = await (0, database_1.getBalance)(userId);
        currentBal += 40; // Trả cược + thắng 20k
        await (0, database_1.updateBalance)(userId, currentBal);
        await updateBoard(null, `🎉 **BLACKJACK 21 ĐIỂM!** Mày trúng độc đắc ăn luôn **${(0, utils_1.formatMoney)(20)}**!`, true, 0x2ECC71);
        collector.stop();
        return;
    }
    try {
        await updateBoard();
    }
    catch (err) {
        console.error("[BLACKJACK LỖI] Lỗi cập nhật bảng cược ban đầu:", err);
        collector.stop();
    }
}
