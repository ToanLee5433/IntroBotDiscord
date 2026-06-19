import { Message, ComponentType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { getBalance, updateBalance, getDebt, banChat, getChatBanExpires } from '../database';
import { formatMoney, activeGamePlayers, sendToJail } from '../utils';

// @ts-ignore
import { Hand } from 'pokersolver';

interface Card {
    suit: string; // ♠, ♥, ♦, ♣
    value: string; // 2, 3, ..., A
}

interface Player {
    userId: string;
    hand: Card[];
    bullets: number;
    folded: boolean;
    alive: boolean;
}

const suits = ["♠", "♥", "♦", "♣"];
const values = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

function createDeck(): Card[] {
    const deck: Card[] = [];
    for (const suit of suits) {
        for (const value of values) {
            deck.push({ suit, value });
        }
    }
    return deck;
}

function shuffleDeck(deck: Card[]): Card[] {
    const d = [...deck];
    for (let i = d.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
}

function toPokerSolverFormat(card: Card): string {
    const val = card.value === "10" ? "T" : card.value;
    let s = "s";
    if (card.suit === "♥") s = "h";
    else if (card.suit === "♦") s = "d";
    else if (card.suit === "♣") s = "c";
    else if (card.suit === "♠") s = "s";
    return val + s;
}

const prisonChannelId = "1517590846927667230";

/**
 * Khởi động phòng chờ và chạy game Poker Roulette
 */
export async function playPokerRoulette(message: Message, betAmount: number) {
    const creatorId = message.author.id;

    // Kiểm tra nợ của chủ phòng
    const debt = await getDebt(creatorId);
    if (debt > 0) {
        const embed = new EmbedBuilder()
            .setTitle("🚫 BỊ CẤM CỬA VÀO SÒNG CASINO")
            .setDescription(`💀 **MÀY ĐANG NỢ CHỒNG CHẤT!**\nHiện tại mày đang nợ ngân hàng BotToan tổng cộng **${formatMoney(debt)}**.\n\nTheo luật **"Nợ là Danh dự"**, mày bị cấm tham gia sòng cờ bạc Vòng Quay Tử Thần! Mau gõ \`@BotToan tra no het\` để trả nợ rồi mới được tạo phòng chơi con ạ!`)
            .setColor(0xFF0000)
            .setThumbnail(message.author.displayAvatarURL());
        await message.reply({ embeds: [embed] });
        return;
    }

    if (betAmount < 10) {
        await message.reply(`❌ Tiền cược tối thiểu để chơi Poker Roulette là **${formatMoney(10)}**!`);
        return;
    }

    // Kiểm tra ví tiền của người tạo phòng
    let creatorBalance = await getBalance(creatorId);
    if (creatorBalance < betAmount) {
        await message.reply(`❌ **ĐÉO ĐỦ TIỀN LẬP SÒNG!** Mày chỉ còn **${formatMoney(creatorBalance)}**, đéo đủ cược **${formatMoney(betAmount)}**.`);
        return;
    }

    // Khấu trừ tiền cược của người lập phòng
    creatorBalance -= betAmount;
    await updateBalance(creatorId, creatorBalance);

    activeGamePlayers.add(creatorId);

    const sessionPlayers: string[] = [creatorId];
    let isStarted = false;

    const lobbyRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('pr_join').setLabel(`🤝 Tham gia cược ${formatMoney(betAmount)}`).setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('pr_start').setLabel('🔫 Bắt đầu bắn').setStyle(ButtonStyle.Danger)
    );

    const updateLobbyEmbed = () => {
        const playersList = sessionPlayers.map((id, idx) => `**${idx + 1}.** <@${id}>`).join("\n");
        return new EmbedBuilder()
            .setTitle("☠️ SÒNG POKER ROULETTE TỬ THẦN")
            .setDescription(`Chủ phòng <@${creatorId}> đã lập sòng Poker Roulette cực hạn!\n\n💰 **Mức cược:** **${formatMoney(betAmount)}/người**\n👥 **Thành viên tham gia (${sessionPlayers.length}/6):**\n${playersList}\n\n*Yêu cầu tối thiểu 2 người. Chủ phòng nhấn Bắt đầu để tiến hành phát súng và chia bài.*`)
            .setColor(0x8E44AD)
            .setFooter({ text: "Sòng chờ sẽ tự hủy sau 2 phút nếu không bắt đầu" });
    };

    if (!('send' in message.channel)) return;
    const lobbyMsg = await (message.channel as any).send({ 
        embeds: [updateLobbyEmbed()], 
        components: [lobbyRow] 
    });

    const lobbyCollector = lobbyMsg.createMessageComponentCollector({ 
        componentType: ComponentType.Button, 
        time: 120000 
    });

    lobbyCollector.on('collect', async (i: any) => {
        const userId = i.user.id;

        const banExpires = await getChatBanExpires(userId);
        if (banExpires > Date.now()) {
            await i.reply({ content: "🚓 Mày đang bóc lịch trong đồn mà vẫn lén dùng điện thoại đánh bạc à? Cất ngay!", ephemeral: true }).catch(()=>{});
            return;
        }

        try {
            if (i.customId === 'pr_join') {
            if (isStarted) return;

            if (sessionPlayers.includes(userId)) {
                await i.reply({ content: "Mày đã ở trong sòng rồi, chờ chủ phòng bắt đầu đi!", ephemeral: true }).catch(()=>{});
                return;
            }

            if (sessionPlayers.length >= 6) {
                await i.reply({ content: "Sòng đã đầy! Tối đa chỉ 6 người chơi thôi.", ephemeral: true }).catch(()=>{});
                return;
            }

            // Kiểm tra nợ của người muốn tham gia
            const userDebt = await getDebt(userId);
            if (userDebt > 0) {
                await i.reply({ content: `❌ **CẤM ĐỎ ĐEN!** Mày đang nợ BotToan **${formatMoney(userDebt)}**.\nTheo luật **"Nợ là Danh dự"**, trả nợ xong thì mới được tham gia sòng cược con ạ!`, ephemeral: true }).catch(()=>{});
                return;
            }

            // Kiểm tra ví tiền của người muốn tham gia
            let userBalance = await getBalance(userId);
            if (userBalance < betAmount) {
                await i.reply({ content: `Ví mày còn đúng **${formatMoney(userBalance)}**, đéo đủ tiền cược vào sòng!`, ephemeral: true }).catch(()=>{});
                return;
            }

            // Trừ tiền cược
            userBalance -= betAmount;
            await updateBalance(userId, userBalance);

            sessionPlayers.push(userId);
            activeGamePlayers.add(userId);
            await i.reply({ content: `🤝 Mày đã tham gia sòng cược **${formatMoney(betAmount)}**!`, ephemeral: true }).catch(()=>{});
            
            await lobbyMsg.edit({ embeds: [updateLobbyEmbed()] }).catch(()=>{});
        } 
        else if (i.customId === 'pr_start') {
            if (userId !== creatorId) {
                await i.reply({ content: "Chỉ chủ phòng mới được bắt đầu sòng bắn súng!", ephemeral: true }).catch(()=>{});
                return;
            }

            if (sessionPlayers.length < 2) {
                await i.reply({ content: "Đéo đủ tay chơi! Sòng Poker tử thần cần tối thiểu 2 người mới kích hoạt được.", ephemeral: true }).catch(()=>{});
                return;
            }

            isStarted = true;
            lobbyCollector.stop();
            await i.deferUpdate().catch(()=>{});
            await runGame(lobbyMsg, sessionPlayers, betAmount);
        }
        } catch (err) {
            console.error("[POKER LOBBY LỖI]:", err);
        }
    });

    lobbyCollector.on('end', async () => {
        if (!isStarted) {
            // Hoàn tiền cho tất cả mọi người vì sòng bị hủy
            for (const pId of sessionPlayers) {
                activeGamePlayers.delete(pId);
                let bal = await getBalance(pId);
                bal += betAmount;
                await updateBalance(pId, bal);
            }

            const cancelEmbed = new EmbedBuilder()
                .setTitle("☠️ SÒNG POKER ROULETTE - ĐÃ HỦY")
                .setDescription(`Sòng cược của <@${creatorId}> đã tự động hủy do quá 2 phút không bắt đầu.\nHệ thống đã hoàn trả lại **${formatMoney(betAmount)}** cược cho tất cả mọi người.`)
                .setColor(0x7F8C8D);

            await lobbyMsg.edit({ embeds: [cancelEmbed], components: [] }).catch(()=>{});
        }
    });
}

/**
 * Trình chạy chính của Game Poker Roulette
 */
async function runGame(lobbyMsg: Message, userIds: string[], betAmount: number) {
    const totalPot = userIds.length * betAmount;
    
    // Khởi tạo bộ bài và trộn
    const deck = shuffleDeck(createDeck());
    
    // Chia bài tẩy cho người chơi và đặt đạn ban đầu (1 viên)
    const players: Player[] = userIds.map(userId => ({
        userId,
        hand: [deck.pop()!, deck.pop()!],
        bullets: 1,
        folded: false,
        alive: true
    }));

    // Chia bài chung (5 lá, lúc đầu chưa lật)
    const communityCards: Card[] = [
        deck.pop()!,
        deck.pop()!,
        deck.pop()!,
        deck.pop()!,
        deck.pop()!
    ];

    // Trộn ngẫu nhiên thứ tự chơi
    let playOrder = [...players].sort(() => Math.random() - 0.5);
    let activeIndex = 0;
    let currentRound: 'PRE_FLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN' = 'PRE_FLOP';

    let lastLogText = "🎲 **Hệ thống đã phát 2 lá bài tẩy bí mật cho mỗi đấu sĩ!** Bấm nút dưới để xem bài của mình.";
    let turnTimeoutTimer: NodeJS.Timeout | null = null;

    // Định dạng bài viết
    const formatCard = (c: Card) => `\`[ ${c.value}${c.suit} ]\``;
    
    const getCommunityDisplay = () => {
        if (currentRound === 'PRE_FLOP') {
            return `[ 🂠 ] [ 🂠 ] [ 🂠 ] [ 🂠 ] [ 🂠 ]`;
        }
        if (currentRound === 'FLOP') {
            return `${formatCard(communityCards[0])} ${formatCard(communityCards[1])} ${formatCard(communityCards[2])} [ 🂠 ] [ 🂠 ]`;
        }
        if (currentRound === 'TURN') {
            return `${formatCard(communityCards[0])} ${formatCard(communityCards[1])} ${formatCard(communityCards[2])} ${formatCard(communityCards[3])} [ 🂠 ]`;
        }
        return `${formatCard(communityCards[0])} ${formatCard(communityCards[1])} ${formatCard(communityCards[2])} ${formatCard(communityCards[3])} ${formatCard(communityCards[4])}`;
    };

    const getRoundNameVi = () => {
        if (currentRound === 'PRE_FLOP') return "🔫 KHỞI ĐỘNG (PRE-FLOP) - SÚNG 1 VIÊN";
        if (currentRound === 'FLOP') return "🃏 VÒNG FLOP - LẬT 3 LÁ CHUNG - SÚNG 2 VIÊN";
        if (currentRound === 'TURN') return "🃏 VÒNG TURN - LẬT LÁ THỨ 4 - SÚNG 3 VIÊN";
        if (currentRound === 'RIVER') return "🃏 VÒNG RIVER - LẬT LÁ CUỐI CÙNG - SÚNG 4 VIÊN";
        return "🏆 SO BÀI (SHOWDOWN) - CHUNG KẾT";
    };

    const getRoundBullets = () => {
        if (currentRound === 'PRE_FLOP') return 1;
        if (currentRound === 'FLOP') return 2;
        if (currentRound === 'TURN') return 3;
        return 4;
    };

    const getFoldDeathChance = () => {
        if (currentRound === 'PRE_FLOP') return "16.6%";
        if (currentRound === 'FLOP') return "33.3%";
        if (currentRound === 'TURN') return "50.0%";
        return "66.6%";
    };

    const getCallActionLabel = () => {
        if (currentRound === 'RIVER') {
            return "🔫 Chốt kèo lật bài (Súng lên 5 viên)";
        }
        const nextBullets = getRoundBullets() + 1;
        return `🔫 Theo / Tố (Súng lên ${nextBullets} viên)`;
    };

    const updateGameEmbed = (activePlayerId = "") => {
        const comCards = getCommunityDisplay();
        const roundTitle = getRoundNameVi();
        
        const playerStatus = playOrder.map((p, idx) => {
            const arrow = p.userId === activePlayerId ? "👉 " : "   ";
            let status = "";
            if (!p.alive) status = "💀 BỊ BẮN CHẾT (ĐANG TRONG TÙ)";
            else if (p.folded) status = "🏃 ĐÃ BỎ BÀI (Spectator)";
            else status = `🔫 ${p.bullets} viên đạn trong ổ`;

            return `${arrow}**${idx + 1}.** <@${p.userId}>: ${status}`;
        }).join("\n");

        return new EmbedBuilder()
            .setTitle("🔥 POKER TỬ THẦN (RUSSIAN POKER ROULETTE)")
            .setDescription(`🎲 **Bài chung trên bàn:**\n${comCards}\n\n💰 **Tổng hũ cược:** **${formatMoney(totalPot)}**\n⌛ **Vòng đấu:** \`${roundTitle}\`\n\n👥 **Danh sách đấu sĩ:**\n${playerStatus}\n\n📝 **Nhật ký:**\n${lastLogText}`)
            .setColor(0xE74C3C)
            .setFooter({ text: "Người chơi có 60s để hành động trước khi súng tự cướp cò!" });
    };

    const getButtons = (activePlayer: Player) => {
        const foldLabel = `💥 Bỏ bài (Bóp cò súng ${getRoundBullets()} viên - Tỉ lệ chết ${getFoldDeathChance()})`;
        
        return new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('poker_call').setLabel(getCallActionLabel()).setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('poker_fold').setLabel(foldLabel).setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('poker_view').setLabel('👁️ Xem 2 lá bài tẩy').setStyle(ButtonStyle.Primary)
        );
    };

    // Hàm thực hiện bóp cò tự sát
    const pullTrigger = async (player: Player, bullets: number): Promise<boolean> => {
        const roll = Math.floor(Math.random() * 6);
        if (roll < bullets) {
            // Nổ súng! Chết!
            player.alive = false;
            
            try {
                // Thực hiện hình phạt cấm chat & áp giải vào Nhà tù
                await banChat(player.userId, 180000);
                await sendToJail(lobbyMsg.guild!, player.userId, "Bị bắn chết trong sòng Poker Roulette - Áp giải vào Nhà tù");
            } catch (err) {}
            return true;
        }
        // Sống
        player.folded = true;
        return false;
    };

    // Hàm chuyển lượt hoặc chuyển vòng đấu
    const nextTurn = async () => {
        if (turnTimeoutTimer) clearTimeout(turnTimeoutTimer);

        // Đếm số người chơi còn sống và chưa úp bài
        const activeCount = playOrder.filter(p => p.alive && !p.folded).length;
        const aliveCount = playOrder.filter(p => p.alive).length;

        // Nếu chỉ còn 1 người chơi duy nhất còn sống và chưa úp bài -> người đó thắng
        if (activeCount === 1) {
            const winner = playOrder.find(p => p.alive && !p.folded)!;
            let bal = await getBalance(winner.userId);
            bal += totalPot;
            await updateBalance(winner.userId, bal);

            const winEmbed = new EmbedBuilder()
                .setTitle("🏆 TRẬN ĐẤU KẾT THÚC: CHIẾN THẦN ĐỘC TÔN")
                .setDescription(`🎉 Chúc mừng <@${winner.userId}> đã sống sót kiên cường và thắng toàn bộ hũ tiền trị giá **${formatMoney(totalPot)}** do toàn bộ đối thủ đã úp bài hoặc chết!\n\n💰 Ví của mày hiện tại: **${formatMoney(bal)}**`)
                .setColor(0x2ECC71);

            await lobbyMsg.edit({ embeds: [winEmbed], components: [] }).catch(()=>{});
            return;
        }

        // Nếu không còn ai chơi được (ví dụ tất cả đều đã chết hoặc úp bài)
        if (activeCount === 0) {
            const winEmbed = new EmbedBuilder()
                .setTitle("💀 TRẬN ĐẤU KẾT THÚC: KHÔNG CÒN AI SỐNG SÓT")
                .setDescription(`Toàn bộ đấu sĩ đã bỏ bài tử nạn hoặc nổ súng vỡ sọ. Hũ tiền **${formatMoney(totalPot)}** sẽ được xung công quỹ ngân hàng BotToan! Cảm ơn sự cống hiến bằng mạng sống của các con giời!`)
                .setColor(0x000000);

            await lobbyMsg.edit({ embeds: [winEmbed], components: [] }).catch(()=>{});
            return;
        }

        // Tìm người tiếp theo để hành động trong vòng này
        let foundNext = false;
        let originalIndex = activeIndex;
        
        while (true) {
            activeIndex = (activeIndex + 1) % playOrder.length;
            if (activeIndex === originalIndex) {
                // Đã đi hết một vòng hành động của toàn bộ người chơi trong vòng hiện tại
                break;
            }
            const nextP = playOrder[activeIndex];
            if (nextP.alive && !nextP.folded) {
                foundNext = true;
                break;
            }
        }

        if (foundNext) {
            // Tiếp tục vòng chơi, gửi yêu cầu hành động cho người chơi tiếp theo
            const activePlayer = playOrder[activeIndex];
            await lobbyMsg.edit({
                embeds: [updateGameEmbed(activePlayer.userId)],
                components: [getButtons(activePlayer)]
            }).catch(()=>{});

            // Khởi động lại Turn Timer 60 giây
            startTurnTimer(activePlayer);
        } else {
            // Không tìm thấy người chơi tiếp theo chưa hành động trong vòng hiện tại -> chuyển vòng đấu mới!
            await advanceRound();
        }
    };

    // Hàm chuyển sang vòng đấu tiếp theo
    const advanceRound = async () => {
        if (currentRound === 'PRE_FLOP') {
            currentRound = 'FLOP';
            lastLogText = `🃏 **BotToan lật 3 lá bài chung đầu tiên!** Vòng đấu nâng lên súng **2 viên**.`;
        } else if (currentRound === 'FLOP') {
            currentRound = 'TURN';
            lastLogText = `🃏 **Lá bài chung thứ 4 lộ diện!** Không khí vô cùng ngột ngạt. Bỏ bài lúc này súng sẽ có **3 viên (Tỉ lệ chết 50%)**.`;
        } else if (currentRound === 'TURN') {
            currentRound = 'RIVER';
            lastLogText = `🃏 **Lá bài chung thứ 5 lộ diện!** Toàn bộ bài đã ngửa ra. Đã đến lúc chốt kèo lật bài hoặc chạy trốn với súng **4 viên**.`;
        } else if (currentRound === 'RIVER') {
            currentRound = 'SHOWDOWN';
            await handleShowdown();
            return;
        }

        // Reset turn index về người chơi còn hoạt động đầu tiên
        activeIndex = playOrder.findIndex(p => p.alive && !p.folded);
        const activePlayer = playOrder[activeIndex];
        
        await lobbyMsg.edit({
            embeds: [updateGameEmbed(activePlayer.userId)],
            components: [getButtons(activePlayer)]
        }).catch(()=>{});

        startTurnTimer(activePlayer);
    };

    // Xử lý Showdown (Lật bài chung cuộc)
    const handleShowdown = async () => {
        if (turnTimeoutTimer) clearTimeout(turnTimeoutTimer);

        // Lấy danh sách các đấu sĩ còn sống sót đến cùng để so bài
        const showdownPlayers = playOrder.filter(p => p.alive && !p.folded);

        // Sử dụng pokersolver để chấm điểm bài
        const solvedHands = showdownPlayers.map(p => {
            const solverCards = [...p.hand, ...communityCards].map(toPokerSolverFormat);
            const solved = Hand.solve(solverCards);
            solved.playerId = p.userId; // Gán ID để truy vết lại
            solved.originalPlayer = p;
            return solved;
        });

        // Tìm bài thắng cuộc
        const winningHands = Hand.winners(solvedHands);
        const winningPlayerIds: string[] = winningHands.map((w: any) => w.playerId);

        // Chia tiền hũ cược cho những người thắng cuộc (nếu hòa thì chia đôi/chia ba)
        const winShare = Math.floor(totalPot / winningPlayerIds.length);
        for (const wId of winningPlayerIds) {
            let bal = await getBalance(wId);
            bal += winShare;
            await updateBalance(wId, bal);
        }

        // Chi tiết danh sách bài tẩy của toàn bộ người chơi ở showdown
        let showdownLog = "";
        let punishmentLogs = "";

        for (const sh of solvedHands) {
            const p = sh.originalPlayer;
            const cardStr = p.hand.map(formatCard).join(" ");
            const isWinner = winningPlayerIds.includes(p.userId);
            
            showdownLog += `- <@${p.userId}>: ${cardStr} -> **${sh.descr}** ${isWinner ? "👑 **(THẮNG HŨ)**" : ""}\n`;

            if (!isWinner) {
                // Những người thua cuộc phải bóp cò súng 5 viên đạn!
                const died = await pullTrigger(p, 5);
                if (died) {
                    punishmentLogs += `💥 **BOOM!** <@${p.userId}> bóp cò súng 5 viên nổ sọ! Đã bị áp giải vào **Nhà Tù** và khóa mõm 3 phút!\n`;
                } else {
                    punishmentLogs += `*Cạch!* <@${p.userId}> bóp cò súng 5 viên... không nổ! Thoát chết kỳ tích trong gang tấc!\n`;
                }
            }
        }

        const winMsg = winningPlayerIds.map(id => `<@${id}>`).join(", ") + ` nhận **${formatMoney(winShare)}** từ hũ cược!`;

        const showdownEmbed = new EmbedBuilder()
            .setTitle("🏆 KẾT QUẢ SO BÀI (SHOWDOWN) POKER TỬ THẦN")
            .setDescription(`🃏 **Bài chung:** ${communityCards.map(formatCard).join(" ")}\n\n👑 **Người thắng cuộc:** ${winMsg}\n\n👥 **Kết quả bài cụ thể:**\n${showdownLog}\n\n⚡ **Hình phạt súng 5 viên cho kẻ thua cuộc:**\n${punishmentLogs}`)
            .setColor(0x2ECC71);

        await lobbyMsg.edit({ embeds: [showdownEmbed], components: [] }).catch(()=>{});
    };

    // Hẹn giờ lượt đi 60s
    const startTurnTimer = (activePlayer: Player) => {
        if (turnTimeoutTimer) clearTimeout(turnTimeoutTimer);

        turnTimeoutTimer = setTimeout(async () => {
            // AFK tự động bóp cò!
            const roundBullets = getRoundBullets();
            lastLogText = `⏰ **Quá giờ!** <@${activePlayer.userId}> ngập ngừng không hành động. Súng tự động cướp cò bóp cò **${roundBullets} viên**!`;
            
            const died = await pullTrigger(activePlayer, roundBullets);
            if (died) {
                lastLogText += `\n💥 **BOOM!** Đạn nổ tung sọ! <@${activePlayer.userId}> đắp chiếu đi tù.`;
            } else {
                lastLogText += `\n*Cạch!* Ổ đạn rỗng. <@${activePlayer.userId}> may mắn giữ được mạng nhưng bị loại (úp bài) do AFK.`;
            }

            await nextTurn();
        }, 60000);
    };

    // Khởi tạo Game Collector lắng nghe button bấm
    const gameCollector = lobbyMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 1200000 // Tối đa 20 phút ván chơi
    });

    gameCollector.on('collect', async (i: any) => {
        const userId = i.user.id;

        const banExpires = await getChatBanExpires(userId);
        if (banExpires > Date.now()) {
            await i.reply({ content: "🚓 Mày đang bóc lịch trong đồn mà vẫn lén dùng điện thoại đánh bạc à? Cất ngay!", ephemeral: true }).catch(()=>{});
            return;
        }

        const activePlayer = playOrder[activeIndex];

        try {

        if (i.customId === 'poker_view') {
            // Xem bài tẩy cá nhân (Ẩn danh - Ephemeral)
            const p = playOrder.find(pl => pl.userId === userId);
            if (!p) {
                await i.reply({ content: "Mày có tham gia sòng bài này đâu mà đòi ngó bài!", ephemeral: true }).catch(()=>{});
                return;
            }
            const cardsStr = p.hand.map(formatCard).join(" ");
            await i.reply({ content: `🃏 Bài tẩy của mày: ${cardsStr}`, ephemeral: true }).catch(()=>{});
            return;
        }

        // Các hành động khác chỉ dành cho người đến lượt
        if (userId !== activePlayer.userId) {
            await i.reply({ content: "Đéo phải lượt đi của mày! Đợi súng chuyền đến tay đã.", ephemeral: true }).catch(()=>{});
            return;
        }

        await i.deferUpdate().catch(()=>{});

        if (i.customId === 'poker_call') {
            // Theo bài -> Tăng viên đạn lên
            activePlayer.bullets += 1;
            lastLogText = `🔫 <@${activePlayer.userId}> chọn **Theo/Tố**. Nạp thêm 1 viên (Hiện có: **${activePlayer.bullets} viên đạn** trong súng).`;
            
            await nextTurn();
        } 
        else if (i.customId === 'poker_fold') {
            // Bỏ bài -> Bóp cò
            const roundBullets = getRoundBullets();
            const died = await pullTrigger(activePlayer, roundBullets);

            if (died) {
                lastLogText = `💥 **BOOM!** <@${activePlayer.userId}> bỏ bài không thành công, đạn đã cướp đi sinh mạng! Đã bị áp giải vào **Nhà Tù** và cấm chat 3 phút.`;
            } else {
                // Sống sót hụt
                const trollMsgs = [
                    `*<@${activePlayer.userId}> mồ hôi hột, bóp cò cái 'Cạch'... Súng không nổ! Hắn vứt vội súng và lết ra khỏi sòng bạc an toàn!*`,
                    `*<@${activePlayer.userId}> mặt cắt không còn giọt máu, kề súng bóp cò 'Cạch'... Thần chết đã ngủ quên! Hắn thở phào nhẹ nhõm, bò lăn ra khỏi sòng bài!*`,
                    `*<@${activePlayer.userId}> tay run bần bật. Hắn nhắm mắt bóp cò... 'CẠCH'! Tiếng kim hỏa đập vào ổ rỗng. Hắn ngã quỵ xuống đất, khóc lóc mừng rỡ vì thoát chết!*`,
                    `*<@${activePlayer.userId}> hét lên một tiếng thất thanh, bóp cò... 'CẠCH'! Kỳ tích xuất hiện! Trái tim suýt ngừng đập, hắn ôm đầu vứt súng chạy bán sống bán chết!*`
                ];
                // Chọn tin nhắn tương ứng với số đạn
                const bulletIdx = Math.min(roundBullets - 1, trollMsgs.length - 1);
                lastLogText = trollMsgs[bulletIdx];
            }

            await nextTurn();
        }
        } catch (err) {
            console.error("[POKER GAME PLAY LỖI]:", err);
            gameCollector.stop();
        }
    });

    gameCollector.on('end', () => {
        if (turnTimeoutTimer) clearTimeout(turnTimeoutTimer);
        for (const pId of userIds) {
            activeGamePlayers.delete(pId);
        }
        lobbyMsg.edit({ components: [] }).catch(()=>{});
    });

    // Bắt đầu lượt chơi đầu tiên của PRE_FLOP
    const firstActivePlayer = playOrder[activeIndex];
    await lobbyMsg.edit({
        embeds: [updateGameEmbed(firstActivePlayer.userId)],
        components: [getButtons(firstActivePlayer)]
    }).catch(()=>{});

    startTurnTimer(firstActivePlayer);
}
