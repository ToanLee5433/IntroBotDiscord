import { Message, ComponentType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { getBalance, updateBalance } from '../database';
import { formatMoney } from '../utils';

interface RouletteSession {
    betAmount: number;
    creatorId: string;
    players: string[];
    isStarted: boolean;
}

/**
 * Bắt đầu sòng Vòng Quay Tử Thần
 */
export async function playRussianRoulette(message: Message, betAmount: number) {
    const creatorId = message.author.id;

    if (betAmount < 10) {
        await message.reply(`❌ Tiền cược tối thiểu để chơi Vòng Quay Tử Thần là **${formatMoney(10)}**!`);
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

    const session: RouletteSession = {
        betAmount,
        creatorId,
        players: [creatorId],
        isStarted: false
    };

    const lobbyRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('rr_join').setLabel(`🤝 Tham gia cược ${formatMoney(betAmount)}`).setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('rr_start').setLabel('🔫 Bắt đầu bắn').setStyle(ButtonStyle.Danger)
    );

    const updateLobbyEmbed = async () => {
        const playersList = session.players.map((id, idx) => `**${idx + 1}.** <@${id}>`).join("\n");
        return new EmbedBuilder()
            .setTitle("🔫 SÒNG VÒNG QUAY TỬ THẦN")
            .setDescription(`Chủ phòng <@${creatorId}> đã lập sòng Roulette tử thần!\n\n💰 **Mức cược:** **${formatMoney(betAmount)}/người**\n👥 **Thành viên tham gia (${session.players.length}/6):**\n${playersList}\n\n*Yêu cầu tối thiểu 2 người. Chủ phòng nhấn Bắt đầu để tiến hành lên đạn.*`)
            .setColor(0xFF4654)
            .setFooter({ text: "Sòng chờ sẽ tự hủy sau 2 phút nếu không bắt đầu" });
    };

    if (!('send' in message.channel)) return;
    const lobbyMsg = await (message.channel as any).send({ 
        embeds: [await updateLobbyEmbed()], 
        components: [lobbyRow] 
    });

    const lobbyCollector = lobbyMsg.createMessageComponentCollector({ 
        componentType: ComponentType.Button, 
        time: 120000 
    });

    lobbyCollector.on('collect', async (i: any) => {
        const userId = i.user.id;

        if (i.customId === 'rr_join') {
            if (session.isStarted) return;

            if (session.players.includes(userId)) {
                await i.reply({ content: "Mày đã ở trong sòng rồi, chờ chủ phòng bắt đầu đi!", ephemeral: true }).catch(()=>{});
                return;
            }

            if (session.players.length >= 6) {
                await i.reply({ content: "Sòng đã đầy! Tối đa chỉ 6 người chơi thôi.", ephemeral: true }).catch(()=>{});
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

            session.players.push(userId);
            await i.reply({ content: `🤝 Mày đã tham gia sòng cược **${formatMoney(betAmount)}**!`, ephemeral: true }).catch(()=>{});
            
            await lobbyMsg.edit({ embeds: [await updateLobbyEmbed()] }).catch(()=>{});
        } 
        else if (i.customId === 'rr_start') {
            if (userId !== creatorId) {
                await i.reply({ content: "Chỉ chủ phòng mới được bắt đầu sòng bắn súng!", ephemeral: true }).catch(()=>{});
                return;
            }

            if (session.players.length < 2) {
                await i.reply({ content: "Đéo đủ tay chơi! Sòng bài tử thần cần tối thiểu 2 người mới kích hoạt được.", ephemeral: true }).catch(()=>{});
                return;
            }

            session.isStarted = true;
            lobbyCollector.stop();
            await i.deferUpdate().catch(()=>{});
            await startGame(lobbyMsg, session);
        }
    });

    lobbyCollector.on('end', async () => {
        if (!session.isStarted) {
            // Hoàn tiền cho tất cả mọi người vì sòng bị hủy
            for (const pId of session.players) {
                let bal = await getBalance(pId);
                bal += betAmount;
                await updateBalance(pId, bal);
            }

            const cancelEmbed = new EmbedBuilder()
                .setTitle("🔫 SÒNG VÒNG QUAY TỬ THẦN - ĐÃ HỦY")
                .setDescription(`Sòng cược của <@${creatorId}> đã tự động hủy do quá 2 phút không bắt đầu.\nHệ thống đã hoàn trả lại **${formatMoney(betAmount)}** cược cho tất cả mọi người.`)
                .setColor(0x7F8C8D);

            await lobbyMsg.edit({ embeds: [cancelEmbed], components: [] }).catch(()=>{});
        }
    });
}

/**
 * Trình chạy game súng lục ổ xoay
 */
async function startGame(lobbyMsg: Message, session: RouletteSession) {
    const totalPot = session.players.length * session.betAmount;
    
    // Nạp đạn: 6 ổ đạn, 1 viên đạn thật
    const bulletChamber = Math.floor(Math.random() * 6);
    let currentChamber = 0;

    // Trộn ngẫu nhiên thứ tự bắn
    const gameOrder = [...session.players].sort(() => Math.random() - 0.5);
    let turnIndex = 0;

    const gameRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('rr_shoot').setLabel('🔫 Bóp cò (Shoot)').setStyle(ButtonStyle.Danger)
    );

    const updateGameEmbed = async (extraMsg = "", isEnded = false, victimId = "") => {
        const activePlayer = gameOrder[turnIndex];
        const statusText = isEnded 
            ? `💥 **BOOM!** Phát súng định mệnh đã nổ ở ổ đạn thứ **${currentChamber + 1}**.\nNạn nhân xấu số: <@${victimId}>.\n\n${extraMsg}`
            : `Súng lục ổ xoay có **6 ổ đạn (1 viên đạn thật)**.\nTổng hũ tiền cược: **${formatMoney(totalPot)}**\n\n👉 Lượt bóp cò của: <@${activePlayer}>\n*Ổ đạn hiện tại: ổ thứ ${currentChamber + 1}/6 (chưa bắn)*\n\n${extraMsg}`;

        return new EmbedBuilder()
            .setTitle(isEnded ? "☠️ KẾT QUẢ VÒNG QUAY TỬ THẦN" : "🔫 GAME BẮT ĐẦU: VÒNG QUAY TỬ THẦN")
            .setDescription(statusText)
            .setColor(isEnded ? 0x000000 : 0xFF3E3E)
            .setFooter({ text: isEnded ? "Trận đấu kết thúc" : "Chỉ người đến lượt mới bấm được nút!" });
    };

    await lobbyMsg.edit({ 
        embeds: [await updateGameEmbed()], 
        components: [gameRow] 
    }).catch(()=>{});

    const gameCollector = lobbyMsg.createMessageComponentCollector({ 
        componentType: ComponentType.Button, 
        time: 300000 // Game chạy trong 5 phút
    });

    gameCollector.on('collect', async (i: any) => {
        if (i.customId !== 'rr_shoot') return;

        const userId = i.user.id;
        const activePlayer = gameOrder[turnIndex];

        if (userId !== activePlayer) {
            await i.reply({ content: "Đéo phải lượt bóp cò của mày! Chờ súng chuyền đến tay đã.", ephemeral: true }).catch(()=>{});
            return;
        }

        // Bóp cò súng
        if (currentChamber === bulletChamber) {
            // Bị bắn trúng!
            gameCollector.stop();
            await i.deferUpdate().catch(()=>{});

            // Chia hũ tiền cho những người sống sót
            const survivors = gameOrder.filter(id => id !== userId);
            const winShare = Math.floor(totalPot / survivors.length);
            
            for (const sId of survivors) {
                let bal = await getBalance(sId);
                bal += winShare;
                await updateBalance(sId, bal);
            }

            // Thực hiện hình phạt cấm chat & kick voice
            let punishmentText = "";
            try {
                const member = i.guild?.members.cache.get(userId);
                if (member) {
                    let kickedVoice = false;
                    let timedOut = false;

                    // Kick voice
                    if (member.voice.channel) {
                        await member.voice.disconnect("Bị bắn chết trong sòng Russian Roulette").catch(()=>{});
                        kickedVoice = true;
                    }

                    // Timeout 2 phút (120000ms)
                    await member.timeout(120000, "Bị bắn chết trong sòng Russian Roulette").catch(()=>{});
                    timedOut = true;

                    if (kickedVoice && timedOut) {
                        punishmentText = `Nạn nhân đã bị **trục xuất khỏi phòng voice** và **cấm chat (Timeout) trong 2 phút**!`;
                    } else if (timedOut) {
                        punishmentText = `Nạn nhân đã bị **cấm chat (Timeout) trong 2 phút**!`;
                    }
                }
            } catch (err) {
                punishmentText = `*(Bot thiếu quyền quản trị nên không thực hiện được hình phạt Kick voice/Timeout đối với nạn nhân)*`;
            }

            const finalMsg = `🏆 **Nhóm sống sót:** ${survivors.map(id => `<@${id}>`).join(", ")} chia nhau mỗi người nhận **${formatMoney(winShare)}** từ hũ.\n\n⚡ **Hình phạt:** ${punishmentText}`;
            
            await lobbyMsg.edit({ 
                embeds: [await updateGameEmbed(finalMsg, true, userId)], 
                components: [] 
            }).catch(()=>{});
        } 
        else {
            // Click! Ổ đạn trống
            currentChamber++;
            turnIndex = (turnIndex + 1) % gameOrder.length;
            
            const nextPlayer = gameOrder[turnIndex];
            const clickMsg = `*Lượt bóp cò của <@${activePlayer}>: Click! Ổ đạn trống rỗng. Lượt tiếp theo chuyển sang <@${nextPlayer}>.*`;
            
            await i.update({ 
                embeds: [await updateGameEmbed(clickMsg)], 
                components: [gameRow] 
            }).catch(()=>{});
        }
    });

    gameCollector.on('end', async (collected, reason) => {
        if (reason === 'time') {
            // Trả lại tiền cho những ai còn sống nếu game bị đứng quá 5 phút
            for (const pId of gameOrder) {
                let bal = await getBalance(pId);
                bal += session.betAmount;
                await updateBalance(pId, bal);
            }
            const timeOutEmbed = new EmbedBuilder()
                .setTitle("🔫 SÒNG VÒNG QUAY TỬ THẦN - HẾT HẠN")
                .setDescription("Ván chơi đã bị đứng quá lâu không ai bóp cò. Hệ thống hoàn lại tiền cược và thu súng.")
                .setColor(0x7F8C8D);

            await lobbyMsg.edit({ embeds: [timeOutEmbed], components: [] }).catch(()=>{});
        }
    });
}
