"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.playRussianRoulette = playRussianRoulette;
const discord_js_1 = require("discord.js");
const database_1 = require("../database");
const utils_1 = require("../utils");
/**
 * Bắt đầu sòng Vòng Quay Tử Thần
 */
async function playRussianRoulette(message, betAmount) {
    const creatorId = message.author.id;
    const debt = await (0, database_1.getDebt)(creatorId);
    if (debt >= 500) {
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle("🚫 BỊ CẤM CỬA VÀO SÒNG CASINO")
            .setDescription(`💀 **MÀY ĐANG NỢ KỊCH TRẦN (>= 500K)!**\nHiện tại mày đang nợ ngân hàng BotToan tổng cộng **${(0, utils_1.formatMoney)(debt)}**.\n\nTheo luật **"Nợ là Danh dự"**, mày bị cấm tham gia sòng cờ bạc Vòng Quay Tử Thần khi nợ kịch trần (>= 500k)! Mau gõ \`@BotToan tra no het\` để trả nợ rồi mới được tạo phòng chơi con ạ!`)
            .setColor(0xFF0000)
            .setThumbnail(message.author.displayAvatarURL());
        await message.reply({ embeds: [embed] });
        return;
    }
    if (betAmount < 10) {
        await message.reply(`❌ Tiền cược tối thiểu để chơi Vòng Quay Tử Thần là **${(0, utils_1.formatMoney)(10)}**!`);
        return;
    }
    // Kiểm tra ví tiền của người tạo phòng
    let creatorBalance = await (0, database_1.getBalance)(creatorId);
    if (creatorBalance < betAmount) {
        await message.reply(`❌ **ĐÉO ĐỦ TIỀN LẬP SÒNG!** Mày chỉ còn **${(0, utils_1.formatMoney)(creatorBalance)}**, đéo đủ cược **${(0, utils_1.formatMoney)(betAmount)}**.`);
        return;
    }
    // Khấu trừ tiền cược của người lập phòng
    creatorBalance -= betAmount;
    await (0, database_1.updateBalance)(creatorId, creatorBalance);
    utils_1.activeGamePlayers.add(creatorId);
    const session = {
        betAmount,
        creatorId,
        players: [creatorId],
        isStarted: false
    };
    const lobbyRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId('rr_join').setLabel(`🤝 Tham gia cược ${(0, utils_1.formatMoney)(betAmount)}`).setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder().setCustomId('rr_start').setLabel('🔫 Bắt đầu bắn').setStyle(discord_js_1.ButtonStyle.Danger));
    const updateLobbyEmbed = async () => {
        const playersList = session.players.map((id, idx) => `**${idx + 1}.** <@${id}>`).join("\n");
        return new discord_js_1.EmbedBuilder()
            .setTitle("🔫 SÒNG VÒNG QUAY TỬ THẦN")
            .setDescription(`Chủ phòng <@${creatorId}> đã lập sòng Roulette tử thần!\n\n💰 **Mức cược:** **${(0, utils_1.formatMoney)(betAmount)}/người**\n👥 **Thành viên tham gia (${session.players.length}/6):**\n${playersList}\n\n*Yêu cầu tối thiểu 2 người. Chủ phòng nhấn Bắt đầu để tiến hành lên đạn.*`)
            .setColor(0xFF4654)
            .setFooter({ text: "Sòng chờ sẽ tự hủy sau 2 phút nếu không bắt đầu" });
    };
    if (!('send' in message.channel))
        return;
    const lobbyMsg = await message.channel.send({
        embeds: [await updateLobbyEmbed()],
        components: [lobbyRow]
    });
    const lobbyCollector = lobbyMsg.createMessageComponentCollector({
        componentType: discord_js_1.ComponentType.Button,
        time: 120000
    });
    lobbyCollector.on('collect', async (i) => {
        const userId = i.user.id;
        const banExpires = await (0, database_1.getChatBanExpires)(userId);
        if (banExpires > Date.now()) {
            await i.reply({ content: "🚓 Mày đang bóc lịch trong đồn mà vẫn lén dùng điện thoại đánh bạc à? Cất ngay!", ephemeral: true }).catch(() => { });
            return;
        }
        try {
            if (i.customId === 'rr_join') {
                if (session.isStarted)
                    return;
                if (session.players.includes(userId)) {
                    await i.reply({ content: "Mày đã ở trong sòng rồi, chờ chủ phòng bắt đầu đi!", ephemeral: true }).catch(() => { });
                    return;
                }
                if (session.players.length >= 6) {
                    await i.reply({ content: "Sòng đã đầy! Tối đa chỉ 6 người chơi thôi.", ephemeral: true }).catch(() => { });
                    return;
                }
                // Kiểm tra nợ của người muốn tham gia
                const userDebt = await (0, database_1.getDebt)(userId);
                if (userDebt >= 500) {
                    await i.reply({ content: `❌ **CẤM ĐỎ ĐEN!** Mày đang nợ BotToan kịch trần **${(0, utils_1.formatMoney)(userDebt)}**.\nTheo luật **"Nợ là Danh dự"**, trả bớt nợ đi (dưới 500k) thì mới được tham gia sòng cược con ạ!`, ephemeral: true }).catch(() => { });
                    return;
                }
                // Kiểm tra ví tiền của người muốn tham gia
                let userBalance = await (0, database_1.getBalance)(userId);
                if (userBalance < betAmount) {
                    await i.reply({ content: `Ví mày còn đúng **${(0, utils_1.formatMoney)(userBalance)}**, đéo đủ tiền cược vào sòng!`, ephemeral: true }).catch(() => { });
                    return;
                }
                // Trừ tiền cược
                userBalance -= betAmount;
                await (0, database_1.updateBalance)(userId, userBalance);
                session.players.push(userId);
                utils_1.activeGamePlayers.add(userId);
                await i.reply({ content: `🤝 Mày đã tham gia sòng cược **${(0, utils_1.formatMoney)(betAmount)}**!`, ephemeral: true }).catch(() => { });
                await lobbyMsg.edit({ embeds: [await updateLobbyEmbed()] }).catch(() => { });
            }
            else if (i.customId === 'rr_start') {
                if (userId !== creatorId) {
                    await i.reply({ content: "Chỉ chủ phòng mới được bắt đầu sòng bắn súng!", ephemeral: true }).catch(() => { });
                    return;
                }
                if (session.players.length < 2) {
                    await i.reply({ content: "Đéo đủ tay chơi! Sòng bài tử thần cần tối thiểu 2 người mới kích hoạt được.", ephemeral: true }).catch(() => { });
                    return;
                }
                session.isStarted = true;
                lobbyCollector.stop();
                await i.deferUpdate().catch(() => { });
                await startGame(lobbyMsg, session);
            }
        }
        catch (err) {
            console.error("[ROULETTE LOBBY LỖI]:", err);
        }
    });
    lobbyCollector.on('end', async () => {
        if (!session.isStarted) {
            // Hoàn tiền cho tất cả mọi người vì sòng bị hủy
            for (const pId of session.players) {
                utils_1.activeGamePlayers.delete(pId);
                let bal = await (0, database_1.getBalance)(pId);
                bal += betAmount;
                await (0, database_1.updateBalance)(pId, bal);
            }
            const cancelEmbed = new discord_js_1.EmbedBuilder()
                .setTitle("🔫 SÒNG VÒNG QUAY TỬ THẦN - ĐÃ HỦY")
                .setDescription(`Sòng cược của <@${creatorId}> đã tự động hủy do quá 2 phút không bắt đầu.\nHệ thống đã hoàn trả lại **${(0, utils_1.formatMoney)(betAmount)}** cược cho tất cả mọi người.`)
                .setColor(0x7F8C8D);
            await lobbyMsg.edit({ embeds: [cancelEmbed], components: [] }).catch(() => { });
        }
    });
}
/**
 * Trình chạy game súng lục ổ xoay
 */
async function startGame(lobbyMsg, session) {
    const totalPot = session.players.length * session.betAmount;
    // Nạp đạn: 6 ổ đạn, 1 viên đạn thật
    const bulletChamber = Math.floor(Math.random() * 6);
    let currentChamber = 0;
    // Trộn ngẫu nhiên thứ tự bắn
    const gameOrder = [...session.players].sort(() => Math.random() - 0.5);
    let turnIndex = 0;
    const gameRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId('rr_shoot').setLabel('🔫 Bóp cò (Shoot)').setStyle(discord_js_1.ButtonStyle.Danger));
    const updateGameEmbed = async (extraMsg = "", isEnded = false, victimId = "") => {
        const activePlayer = gameOrder[turnIndex];
        const statusText = isEnded
            ? `💥 **BOOM!** Phát súng định mệnh đã nổ ở ổ đạn thứ **${currentChamber + 1}**.\nNạn nhân xấu số: <@${victimId}>.\n\n${extraMsg}`
            : `Súng lục ổ xoay có **6 ổ đạn (1 viên đạn thật)**.\nTổng hũ tiền cược: **${(0, utils_1.formatMoney)(totalPot)}**\n\n👉 Lượt bóp cò của: <@${activePlayer}>\n*Ổ đạn hiện tại: ổ thứ ${currentChamber + 1}/6 (chưa bắn)*\n\n${extraMsg}`;
        return new discord_js_1.EmbedBuilder()
            .setTitle(isEnded ? "☠️ KẾT QUẢ VÒNG QUAY TỬ THẦN" : "🔫 GAME BẮT ĐẦU: VÒNG QUAY TỬ THẦN")
            .setDescription(statusText)
            .setColor(isEnded ? 0x000000 : 0xFF3E3E)
            .setFooter({ text: isEnded ? "Trận đấu kết thúc" : "Chỉ người đến lượt mới bấm được nút!" });
    };
    await lobbyMsg.edit({
        embeds: [await updateGameEmbed()],
        components: [gameRow]
    }).catch(() => { });
    const gameCollector = lobbyMsg.createMessageComponentCollector({
        componentType: discord_js_1.ComponentType.Button,
        time: 300000 // Game chạy trong 5 phút
    });
    gameCollector.on('collect', async (i) => {
        if (i.customId !== 'rr_shoot')
            return;
        const userId = i.user.id;
        const banExpires = await (0, database_1.getChatBanExpires)(userId);
        if (banExpires > Date.now()) {
            await i.reply({ content: "🚓 Mày đang bóc lịch trong đồn mà vẫn lén dùng điện thoại đánh bạc à? Cất ngay!", ephemeral: true }).catch(() => { });
            return;
        }
        const activePlayer = gameOrder[turnIndex];
        try {
            if (userId !== activePlayer) {
                await i.reply({ content: "Đéo phải lượt bóp cò của mày! Chờ súng chuyền đến tay đã.", ephemeral: true }).catch(() => { });
                return;
            }
            // Bóp cò súng
            if (currentChamber === bulletChamber) {
                // Bị bắn trúng!
                gameCollector.stop();
                await i.deferUpdate().catch(() => { });
                // Chia hũ tiền cho những người sống sót
                const survivors = gameOrder.filter(id => id !== userId);
                const winShare = Math.floor(totalPot / survivors.length);
                for (const sId of survivors) {
                    let bal = await (0, database_1.getBalance)(sId);
                    bal += winShare;
                    await (0, database_1.updateBalance)(sId, bal);
                }
                // Thực hiện hình phạt cấm chat & áp giải vào Nhà tù
                let punishmentText = "";
                try {
                    // Áp dụng cấm chat 3 phút ở Bot level
                    await (0, database_1.banChat)(userId, 180000);
                    const movedToPrison = await (0, utils_1.sendToJail)(i.guild, userId, "Bị bắn chết trong sòng Russian Roulette - Đưa vào Nhà tù");
                    if (movedToPrison) {
                        punishmentText = `Nạn nhân đã bị **áp giải vào Nhà Tù** và **khóa mõm (cấm chat) trong 3 phút**!`;
                    }
                    else {
                        punishmentText = `Nạn nhân đã bị **khóa mõm (cấm chat) trong 3 phút**! *(Do không ở trong phòng voice nên thoát được cảnh tù tội)*`;
                    }
                }
                catch (err) {
                    punishmentText = `*(Bot thiếu quyền quản trị hoặc xảy ra lỗi nên chỉ thực hiện khóa mõm 3 phút, không áp giải vào Nhà tù được)*`;
                }
                const finalMsg = `🏆 **Nhóm sống sót:** ${survivors.map(id => `<@${id}>`).join(", ")} chia nhau mỗi người nhận **${(0, utils_1.formatMoney)(winShare)}** từ hũ.\n\n⚡ **Hình phạt:** ${punishmentText}`;
                await lobbyMsg.edit({
                    embeds: [await updateGameEmbed(finalMsg, true, userId)],
                    components: []
                }).catch(() => { });
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
                }).catch(() => { });
            }
        }
        catch (err) {
            console.error("[ROULETTE GAME PLAY LỖI]:", err);
            gameCollector.stop();
        }
    });
    gameCollector.on('end', async (collected, reason) => {
        for (const pId of session.players) {
            utils_1.activeGamePlayers.delete(pId);
        }
        if (reason === 'time') {
            // Trả lại tiền cho những ai còn sống nếu game bị đứng quá 5 phút
            for (const pId of gameOrder) {
                let bal = await (0, database_1.getBalance)(pId);
                bal += session.betAmount;
                await (0, database_1.updateBalance)(pId, bal);
            }
            const timeOutEmbed = new discord_js_1.EmbedBuilder()
                .setTitle("🔫 SÒNG VÒNG QUAY TỬ THẦN - HẾT HẠN")
                .setDescription("Ván chơi đã bị đứng quá lâu không ai bóp cò. Hệ thống hoàn lại tiền cược và thu súng.")
                .setColor(0x7F8C8D);
            await lobbyMsg.edit({ embeds: [timeOutEmbed], components: [] }).catch(() => { });
        }
    });
}
