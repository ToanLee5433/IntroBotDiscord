import { Message, ComponentType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { getBalance, updateBalance } from '../database';

interface Card {
    suit: string;
    value: string;
    score: number;
}

const suits = ["♠", "♥", "♦", "♣"];
const values = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function drawCard(): Card {
    const suit = suits[Math.floor(Math.random() * suits.length)];
    const value = values[Math.floor(Math.random() * values.length)];
    let score = 0;
    
    if (value === "A") {
        score = 11;
    } else if (["J", "Q", "K"].includes(value)) {
        score = 10;
    } else {
        score = parseInt(value);
    }
    
    return { suit, value, score };
}

function calculateScore(hand: Card[]): number {
    let score = hand.reduce((sum, card) => sum + card.score, 0);
    let aceCount = hand.filter(c => c.value === "A").length;
    while (score > 21 && aceCount > 0) {
        score -= 10;
        aceCount -= 1;
    }
    return score;
}

function displayHand(hand: Card[], hideSecond = false): string {
    if (hideSecond && hand.length >= 2) {
        return `\`[${hand[0].value}${hand[0].suit}]\` \`[??]\``;
    }
    return hand.map(c => `\`[${c.value}${c.suit}]\``).join(" ");
}

/**
 * Bắt đầu sòng bài Xì Dách / Blackjack cho một người dùng
 */
export async function playBlackjack(message: Message) {
    const userId = message.author.id;
    let isProcessing = false;

    // Phí vào bàn là 20k
    let balance = await getBalance(userId);
    if (balance < 20) {
        const embed = new EmbedBuilder()
            .setTitle("🃏 SÒNG BÀI BLACKJACK - CHÁY TÚI")
            .setDescription(`💸 **ĐÉO ĐỦ TIỀN VÀO BÀN!** Mày chỉ còn **${balance}k**.\nLệ phí cược Blackjack tối thiểu là **20k**. Chơi bầu cua kiếm thêm đi con ạ!`)
            .setColor(0xFF0000)
            .setThumbnail(message.author.displayAvatarURL());
        await message.reply({ embeds: [embed] });
        return;
    }

    // Trừ tiền cược đầu bàn
    balance -= 20;
    await updateBalance(userId, balance);

    // Phát bài ban đầu
    const playerHand: Card[] = [drawCard(), drawCard()];
    const dealerHand: Card[] = [drawCard(), drawCard()];

    const draftMsg = await message.reply("🃏 **ĐANG CHIA BÀI BLACKJACK... NHÌN BÀI CHO KĨ!**");
    const collector = draftMsg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 300000 }); // Phiên chơi tối đa 5 phút

    const updateBoard = async (interaction?: any, extraMsg = "", isEnded = false, colorHex = 0x00AE86) => {
        const currentBalance = await getBalance(userId);
        const playerScore = calculateScore(playerHand);
        const dealerScore = isEnded ? calculateScore(dealerHand) : dealerHand[0].score + (dealerHand[1].value === "A" ? 11 : dealerHand[1].score); // Chỉ show điểm lá 1

        const embed = new EmbedBuilder()
            .setTitle("🃏 BÀN CHƠI BLACKJACK - BOTTOAN")
            .setColor(colorHex)
            .setThumbnail(message.author.displayAvatarURL())
            .addFields(
                { name: "🂴 Bài Của Mày", value: `${displayHand(playerHand)} (Tổng điểm: **${playerScore}**)`, inline: false },
                { name: "🂺 Bài Của Nhà Cái (BotToan)", value: isEnded ? `${displayHand(dealerHand)} (Tổng điểm: **${calculateScore(dealerHand)}**)` : `${displayHand(dealerHand, true)} (Lá ngửa: **${dealerHand[0].score}**)`, inline: false }
            )
            .setDescription(extraMsg || `💰 Tài sản còn lại: **${currentBalance}k**\nLệ phí cược ván này: **20k**`)
            .setFooter({ text: isEnded ? "Trận đấu kết thúc" : "Rút thêm bài (Hit) hoặc Dằn bài (Stand)" });

        if (isEnded) {
            if (interaction) await interaction.update({ embeds: [embed], components: [] }).catch(()=>{});
            else await draftMsg.edit({ embeds: [embed], components: [] }).catch(()=>{});
            collector.stop();
            return;
        }

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('bj_hit').setLabel('🃏 Rút bài (Hit)').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('bj_stand').setLabel('🛑 Dằn bài (Stand)').setStyle(ButtonStyle.Danger)
        );

        if (interaction) await interaction.update({ embeds: [embed], components: [row] }).catch(()=>{});
        else await draftMsg.edit({ embeds: [embed], components: [row] }).catch(()=>{});
    };

    collector.on('collect', async i => {
        if (i.user.id !== userId) {
            await i.reply({ content: "Đứa nào chơi máy đứa nấy, đừng có bấm ké!", ephemeral: true }).catch(()=>{});
            return;
        }

        if (isProcessing) {
            await i.reply({ content: "Từ từ thôi mày, đang xào bài!", ephemeral: true }).catch(()=>{});
            return;
        }

        isProcessing = true;

        const action = i.customId;

        if (action === 'bj_hit') {
            playerHand.push(drawCard());
            const playerScore = calculateScore(playerHand);

            if (playerScore > 21) {
                // Người chơi bị QUẮC (Bust)
                isProcessing = false;
                await updateBoard(i, "💀 **MÀY BỊ QUẮC RỒI!** Điểm vượt quá 21. Nhà cái lụm cmn **20k** cược.", true, 0xFF0000);
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
            let colorHex = 0x00FF00;
            let currentBal = await getBalance(userId);

            if (dealerScore > 21) {
                // Nhà cái bị Quắc
                currentBal += 40; // Trả cược + thắng 20k
                await updateBalance(userId, currentBal);
                finalMsg = "🎉 **NHÀ CÁI BỊ QUẮC!** Mày đã thắng và ăn **20k**.";
                colorHex = 0x00FF00;
            } else if (playerScore > dealerScore) {
                // Người chơi điểm cao hơn
                currentBal += 40;
                await updateBalance(userId, currentBal);
                finalMsg = `🎉 **MÀY THẮNG!** Điểm của mày (${playerScore}) cao hơn nhà cái (${dealerScore}). Húp **20k**.`;
                colorHex = 0x00FF00;
            } else if (playerScore < dealerScore) {
                // Nhà cái điểm cao hơn
                finalMsg = `💀 **MÀY THUA!** Điểm nhà cái (${dealerScore}) cao hơn mày (${playerScore}). Mất **20k**.`;
                colorHex = 0xFF0000;
            } else {
                // Hòa (Push)
                currentBal += 20; // Hoàn tiền cược
                await updateBalance(userId, currentBal);
                finalMsg = `🤝 **HÒA NHAU!** Cả hai cùng đạt **${playerScore}** điểm. Hoàn trả **20k** cược.`;
                colorHex = 0xFFA500;
            }

            isProcessing = false;
            await updateBoard(i, finalMsg, true, colorHex);
        }
    });

    collector.on('end', async () => {
        // Đảm bảo nút bấm bị dọn dẹp nếu người chơi ngâm quá 5 phút
        draftMsg.edit({ components: [] }).catch(()=>{});
    });

    // Check ngay lập tức nếu người chơi có BlackJack 21 điểm từ đầu
    const initialScore = calculateScore(playerHand);
    if (initialScore === 21) {
        let currentBal = await getBalance(userId);
        currentBal += 40; // Trả cược + thắng 20k
        await updateBalance(userId, currentBal);
        await updateBoard(null, "🎉 **BLACKJACK 21 ĐIỂM!** Mày trúng độc đắc ăn luôn **20k**!", true, 0x00FF00);
        return;
    }

    await updateBoard();
}
