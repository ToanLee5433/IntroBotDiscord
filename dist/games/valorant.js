"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.playValorantDraft = playValorantDraft;
exports.registerValorantCollector = registerValorantCollector;
const discord_js_1 = require("discord.js");
const config_1 = require("../config");
const utils_1 = require("../utils");
const gemini_1 = require("../services/gemini");
// Map quản lý phiên chơi động theo kênh
const draftSessions = new Map();
/**
 * Bắt đầu tiến trình Draft đội hình Valorant
 */
async function playValorantDraft(message) {
    const channelId = message.channelId;
    const creatorId = message.author.id;
    let session = draftSessions.get(channelId);
    if (session && session.isDrafting) {
        await message.reply("Đang có bàn draft dở ở kênh này rồi, tập trung chốt đi mày!");
        return;
    }
    session = {
        channelId,
        isDrafting: false,
        creatorId,
        players: [{
                userId: creatorId,
                displayName: message.author.displayName || message.author.username,
                avatarUrl: message.author.displayAvatarURL()
            }],
        agentPool: {
            "Duelist": [...config_1.fullAgentsByRole["Duelist"]],
            "Initiator": [...config_1.fullAgentsByRole["Initiator"]],
            "Controller": [...config_1.fullAgentsByRole["Controller"]],
            "Sentinel": [...config_1.fullAgentsByRole["Sentinel"]]
        },
        currentTurnIndex: 0,
        currentRole: "",
        currentAgent: "",
        changeAttempts: 0
    };
    draftSessions.set(channelId, session);
    const lobbyRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId('vd_join').setLabel('🎮 Tham gia').setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder().setCustomId('vd_leave').setLabel('🚶 Rời phòng').setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder().setCustomId('vd_start').setLabel('⚡ Bắt đầu').setStyle(discord_js_1.ButtonStyle.Danger), new discord_js_1.ButtonBuilder().setCustomId('vd_cancel').setLabel('🛑 Hủy sòng').setStyle(discord_js_1.ButtonStyle.Secondary));
    const updateLobbyEmbed = () => {
        const s = draftSessions.get(channelId);
        if (!s)
            return new discord_js_1.EmbedBuilder();
        const listText = s.players.map((p, idx) => `**${idx + 1}.** <@${p.userId}> (${p.displayName})`).join("\n");
        return new discord_js_1.EmbedBuilder()
            .setTitle("🎯 PHÒNG CHỜ DRAFT VALORANT 🎯")
            .setDescription(`Chủ phòng <@${s.creatorId}> đã mở phòng chờ draft team!\n\n👥 **Thành viên đã tham gia (${s.players.length}/5):**\n${listText ? listText : "*Chưa có ai*"}\n\n*Yêu cầu tối thiểu 1 người. Chủ phòng nhấn Bắt đầu để chia lượt quay.*`)
            .setColor(0xFF4654)
            .setFooter({ text: "Phòng chờ tự hủy sau 2 phút nếu không bắt đầu" });
    };
    if (!('send' in message.channel))
        return;
    const lobbyMsg = await message.channel.send({
        embeds: [updateLobbyEmbed()],
        components: [lobbyRow]
    });
    session.draftMsg = lobbyMsg;
    const lobbyCollector = lobbyMsg.createMessageComponentCollector({ time: 120000 });
    lobbyCollector.on('collect', async (i) => {
        const s = draftSessions.get(channelId);
        if (!s)
            return;
        const userId = i.user.id;
        if (i.customId === 'vd_join') {
            if (s.players.some(p => p.userId === userId)) {
                await i.reply({ content: "Mày đã đăng ký trong phòng chờ rồi con ạ!", ephemeral: true }).catch(() => { });
                return;
            }
            if (s.players.length >= 5) {
                await i.reply({ content: "Phòng chờ đã đầy 5 slot rồi!", ephemeral: true }).catch(() => { });
                return;
            }
            s.players.push({
                userId: userId,
                displayName: i.user.displayName || i.user.username,
                avatarUrl: i.user.displayAvatarURL()
            });
            await i.reply({ content: "🎮 Mày đã tham gia phòng chờ draft!", ephemeral: true }).catch(() => { });
            await lobbyMsg.edit({ embeds: [updateLobbyEmbed()] }).catch(() => { });
        }
        else if (i.customId === 'vd_leave') {
            if (!s.players.some(p => p.userId === userId)) {
                await i.reply({ content: "Mày có trong phòng chờ đéo đâu mà rời!", ephemeral: true }).catch(() => { });
                return;
            }
            if (userId === s.creatorId) {
                await i.reply({ content: "Chủ phòng không được rời! Muốn giải tán thì bấm Hủy sòng!", ephemeral: true }).catch(() => { });
                return;
            }
            s.players = s.players.filter(p => p.userId !== userId);
            await i.reply({ content: "🚪 Mày đã rời phòng chờ draft!", ephemeral: true }).catch(() => { });
            await lobbyMsg.edit({ embeds: [updateLobbyEmbed()] }).catch(() => { });
        }
        else if (i.customId === 'vd_cancel') {
            if (userId !== s.creatorId) {
                await i.reply({ content: "Chỉ chủ phòng mới được hủy sòng!", ephemeral: true }).catch(() => { });
                return;
            }
            draftSessions.delete(channelId);
            lobbyCollector.stop();
            await i.update({ content: "🛑 **SÒNG DRAFT VALORANT ĐÃ BỊ HỦY!**", embeds: [], components: [] }).catch(() => { });
        }
        else if (i.customId === 'vd_start') {
            if (userId !== s.creatorId) {
                await i.reply({ content: "Chỉ chủ phòng mới bấm Bắt đầu được!", ephemeral: true }).catch(() => { });
                return;
            }
            s.isDrafting = true;
            lobbyCollector.stop();
            // Nếu số người chơi < 5, sao chép quay vòng để đủ 5 lượt chọn
            const originalPlayers = [...s.players];
            const expandedSequence = [];
            while (expandedSequence.length < 5) {
                for (const p of originalPlayers) {
                    if (expandedSequence.length < 5) {
                        expandedSequence.push({ ...p });
                    }
                }
            }
            s.players = expandedSequence;
            await i.deferUpdate().catch(() => { });
            await startDraftTurns(channelId);
        }
    });
    lobbyCollector.on('end', () => {
        const s = draftSessions.get(channelId);
        if (s && !s.isDrafting) {
            draftSessions.delete(channelId);
            lobbyMsg.edit({ content: "🛑 **Phòng chờ tự động đóng do quá thời gian 2 phút.**", embeds: [], components: [] }).catch(() => { });
        }
    });
}
/**
 * Điều hướng bắt đầu lượt quay tướng
 */
async function startDraftTurns(channelId) {
    const s = draftSessions.get(channelId);
    if (!s || !s.draftMsg)
        return;
    if (s.currentTurnIndex >= 5) {
        // Hoàn thành draft đội hình
        await showFinalResult(channelId);
        return;
    }
    const currentPlayer = s.players[s.currentTurnIndex];
    const row1 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId('r_duelist').setLabel('⚔️ Duelist').setStyle(discord_js_1.ButtonStyle.Danger), new discord_js_1.ButtonBuilder().setCustomId('r_initiator').setLabel('👁️ Initiator').setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder().setCustomId('r_controller').setLabel('💨 Controller').setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder().setCustomId('r_sentinel').setLabel('🛡️ Sentinel').setStyle(discord_js_1.ButtonStyle.Primary));
    const row2 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId('r_random').setLabel('🎲 Random Role').setStyle(discord_js_1.ButtonStyle.Success));
    const rosterText = displayRosterSoFar(s.players);
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle(`🎯 LƯỢT QUAY SLOT THỨ ${s.currentTurnIndex + 1}: ${currentPlayer.displayName.toUpperCase()}`)
        .setDescription(`**Đội hình hiện tại:**\n${rosterText}\n\n👉 Lượt của <@${currentPlayer.userId}>. Mày muốn bốc tướng hệ nào?\n⚠️ Mày có **15 giây** để bấm nút, nếu không tao sẽ tự động random!`)
        .setColor(0xFF4654)
        .setThumbnail(currentPlayer.avatarUrl)
        .setFooter({ text: `Lượt quay ${s.currentTurnIndex + 1} / 5` });
    await s.draftMsg.edit({ embeds: [embed], components: [row1, row2] }).catch(() => { });
    // Bắt đầu đếm ngược 15 giây AFK
    if (s.timeoutTimer)
        clearTimeout(s.timeoutTimer);
    s.timeoutTimer = setTimeout(async () => {
        await autoRollTurn(channelId);
    }, 15000);
}
/**
 * Hiển thị đội hình đã chốt cho đến thời điểm hiện tại
 */
function displayRosterSoFar(players) {
    return players.map((p, idx) => {
        if (p.agent) {
            return `- **Vị trí ${idx + 1}**: <@${p.userId}> (${p.displayName}) ➡️ **${p.agent}** (${p.role})`;
        }
        else {
            return `- **Vị trí ${idx + 1}**: <@${p.userId}> (${p.displayName}) ➡️ *Đang chọn...*`;
        }
    }).join("\n");
}
/**
 * Xử lý tự động bốc tướng khi hết giờ (AFK) ở màn hình chọn vai trò
 */
async function autoRollTurn(channelId) {
    const s = draftSessions.get(channelId);
    if (!s || !s.draftMsg)
        return;
    if (s.timeoutTimer)
        clearTimeout(s.timeoutTimer);
    const currentPlayer = s.players[s.currentTurnIndex];
    const roles = ["Duelist", "Initiator", "Controller", "Sentinel"];
    const randomRole = roles[Math.floor(Math.random() * roles.length)];
    // Auto lấy đạn thật
    const pool = s.agentPool[randomRole];
    const rolledAgent = pool[Math.floor(Math.random() * pool.length)];
    // Chốt luôn cho người chơi
    currentPlayer.agent = rolledAgent;
    currentPlayer.role = randomRole;
    s.agentPool[randomRole] = s.agentPool[randomRole].filter(a => a !== rolledAgent);
    s.currentTurnIndex++;
    // Thông báo chat
    const alertMsg = await s.draftMsg.channel.send(`⏰ **Hết giờ!** Do <@${currentPlayer.userId}> treo máy, tao đã tự động chọn và chốt tướng **${rolledAgent}** (${randomRole}) cho nó!`).catch(() => { });
    setTimeout(() => {
        alertMsg?.delete().catch(() => { });
    }, 5000);
    await startDraftTurns(channelId);
}
function getRoleColor(role) {
    switch (role) {
        case "Duelist": return 0xFF4654;
        case "Initiator": return 0x34C759;
        case "Controller": return 0x00B4D8;
        case "Sentinel": return 0xFFCC00;
        default: return 0xFF4654;
    }
}
/**
 * Thực hiện hiệu ứng quay tướng
 */
async function rollAgent(role, interaction, channelId) {
    const s = draftSessions.get(channelId);
    if (!s || !s.draftMsg)
        return;
    if (s.timeoutTimer)
        clearTimeout(s.timeoutTimer);
    const currentPlayer = s.players[s.currentTurnIndex];
    s.currentRole = role;
    if (!s.agentPool[role] || s.agentPool[role].length === 0) {
        s.agentPool[role] = [...config_1.fullAgentsByRole[role]];
    }
    const pool = s.agentPool[role];
    // Chỉ chạy 1 lần loading để tránh Rate Limit của Discord
    const animEmbed = new discord_js_1.EmbedBuilder()
        .setTitle(`🌀 ĐANG QUAY TƯỚNG CHO ${currentPlayer.displayName.toUpperCase()}...`)
        .setDescription(`📡 *Hệ thống đang bốc một chiến thần hệ **${role.toUpperCase()}** từ máy chủ Valorant...*`)
        .setColor(getRoleColor(role))
        .setThumbnail(currentPlayer.avatarUrl);
    if (interaction && !interaction.replied && !interaction.deferred) {
        await interaction.update({ embeds: [animEmbed], components: [] }).catch(() => { });
    }
    else {
        await s.draftMsg.edit({ embeds: [animEmbed], components: [] }).catch(() => { });
    }
    await (0, utils_1.sleep)(1500);
    // Kết quả tướng thật
    s.currentAgent = pool[Math.floor(Math.random() * pool.length)];
    s.changeAttempts = 0;
    await showSelectionBoard(interaction, channelId);
}
/**
 * Bảng hiển thị kết quả bốc được để chốt hoặc đổi
 */
async function showSelectionBoard(interaction, channelId) {
    const s = draftSessions.get(channelId);
    if (!s || !s.draftMsg)
        return;
    const currentPlayer = s.players[s.currentTurnIndex];
    const iconUrl = config_1.agentIcons.get(s.currentAgent.toLowerCase().trim()) || "";
    const rosterText = displayRosterSoFar(s.players);
    const boardASCII = `┌──────────────────────────────┐\n` +
        `│      🎉 KẾT QUẢ BỐC TƯỚNG    │\n` +
        `├──────────────────────────────┤\n` +
        `│  Lượt: ${currentPlayer.displayName}\n` +
        `│  Hệ:   ${s.currentRole.toUpperCase()}\n` +
        `│                              │\n` +
        `│      ⭐  ${s.currentAgent.toUpperCase()}  ⭐\n` +
        `└──────────────────────────────┘`;
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle(`🎭 QUAY TRÚNG: ${s.currentAgent.toUpperCase()}`)
        .setDescription(`\`\`\`text\n${boardASCII}\n\`\`\`\n**Đội hình hiện tại:**\n${rosterText}\n\n👉 <@${currentPlayer.userId}>, mày có đồng ý chọn **${s.currentAgent}** không? Mày có **15 giây** để chốt hoặc đổi.`)
        .setColor(getRoleColor(s.currentRole))
        .setThumbnail(currentPlayer.avatarUrl);
    if (iconUrl) {
        embed.setImage(iconUrl);
    }
    const row = new discord_js_1.ActionRowBuilder();
    row.addComponents(new discord_js_1.ButtonBuilder().setCustomId('vd_chot').setLabel('✅ Chốt luôn').setStyle(discord_js_1.ButtonStyle.Success));
    if (s.changeAttempts === 0) {
        row.addComponents(new discord_js_1.ButtonBuilder().setCustomId('vd_doi').setLabel('🔄 Bốc con khác (1 lần)').setStyle(discord_js_1.ButtonStyle.Danger));
    }
    await s.draftMsg.edit({ embeds: [embed], components: [row] }).catch(() => { });
    // Bắt đầu collector cho nút chốt/đổi (không đặt filter ở đây để bắt được các click sai lượt)
    const buttonCollector = s.draftMsg.createMessageComponentCollector({
        time: 15000
    });
    buttonCollector.on('collect', async (btnInteract) => {
        if (btnInteract.user.id !== currentPlayer.userId) {
            await btnInteract.reply({
                content: `❌ **Không phải lượt của mày!** Để cho <@${currentPlayer.userId}> tự quyết định số phận của nó đi cưng! 🙄`,
                ephemeral: true
            }).catch(() => { });
            return;
        }
        if (btnInteract.customId === 'vd_chot') {
            buttonCollector.stop('completed');
            await btnInteract.deferUpdate().catch(() => { });
            currentPlayer.agent = s.currentAgent;
            currentPlayer.role = s.currentRole;
            s.agentPool[s.currentRole] = s.agentPool[s.currentRole].filter(a => a !== s.currentAgent);
            s.currentTurnIndex++;
            await startDraftTurns(channelId);
        }
        else if (btnInteract.customId === 'vd_doi') {
            buttonCollector.stop('completed');
            s.changeAttempts = 1;
            s.agentPool[s.currentRole] = s.agentPool[s.currentRole].filter(a => a !== s.currentAgent);
            await btnInteract.deferUpdate().catch(() => { });
            await rollAgent(s.currentRole, null, channelId);
        }
    });
    buttonCollector.on('end', async (collected, reason) => {
        // Nếu hết 15s mà người chơi không nhấn gì
        if (reason === 'time') {
            const sCheck = draftSessions.get(channelId);
            if (sCheck && sCheck.currentTurnIndex === s.currentTurnIndex) {
                currentPlayer.agent = s.currentAgent;
                currentPlayer.role = s.currentRole;
                sCheck.agentPool[s.currentRole] = sCheck.agentPool[s.currentRole].filter(a => a !== s.currentAgent);
                sCheck.currentTurnIndex++;
                const alertMsg = await sCheck.draftMsg.channel.send(`⏰ **Hết giờ!** Hệ thống đã tự động chốt tướng **${s.currentAgent}** cho <@${currentPlayer.userId}>.`).catch(() => { });
                setTimeout(() => {
                    alertMsg?.delete().catch(() => { });
                }, 5000);
                await startDraftTurns(channelId);
            }
        }
    });
}
/**
 * In ra kết quả đội hình cuối cùng
 */
async function showFinalResult(channelId) {
    const s = draftSessions.get(channelId);
    if (!s || !s.draftMsg)
        return;
    if (s.timeoutTimer)
        clearTimeout(s.timeoutTimer);
    const teamText = s.players.map((p, idx) => {
        return `👤 **Vị trí ${idx + 1}**: <@${p.userId}> (${p.displayName}) ➡️ ⚔️ **${p.agent}** (${p.role})`;
    }).join("\n");
    const teamListStr = s.players.map(p => `${p.agent} (${p.role})`).join(', ');
    // Gửi màn hình chờ đánh giá đội hình
    const waitingEmbed = new discord_js_1.EmbedBuilder()
        .setTitle("🏆 ĐỘI HÌNH RA SÂN CHÍNH THỨC 🏆")
        .setDescription(`Các chiến thần đã chọn xong đội hình Valorant cực mạnh:\n\n${teamText}\n\n🤖 *BotToan đang phân tích chiến thuật đội hình của bọn mày...*`)
        .setColor(0x2ECC71);
    await s.draftMsg.edit({ embeds: [waitingEmbed], components: [] }).catch(() => { });
    let rating = '';
    try {
        rating = await (0, gemini_1.rateValorantTeam)(teamListStr);
    }
    catch {
        rating = "Đội hình này trông như cún con đi lạc, thôi vào game bớt sủa lại và lo bắn đi nhé!";
    }
    const finalEmbed = new discord_js_1.EmbedBuilder()
        .setTitle("🏆 ĐỘI HÌNH RA SÂN CHÍNH THỨC 🏆")
        .setDescription(`Các chiến thần đã chọn xong đội hình Valorant cực mạnh:\n\n${teamText}`)
        .addFields({ name: "📝 BotToan Nhận Xét Đội Hình", value: rating || "*Không nhận xét nổi...*", inline: false })
        .setColor(0x2ECC71) // Xanh lục thắng lợi
        .setFooter({ text: "BotToan - Sòng bạc hoàng gia" })
        .setTimestamp();
    await s.draftMsg.edit({ embeds: [finalEmbed], components: [] }).catch(() => { });
    draftSessions.delete(channelId);
}
// ================= ROUTING LẮNG NGHE SỰ KIỆN CHO VALORANT =================
// Hàm lắng nghe riêng để tích hợp vào index.ts
function registerValorantCollector(client) {
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton())
            return;
        const id = interaction.customId;
        const channelId = interaction.channelId;
        const s = draftSessions.get(channelId);
        if (!s)
            return;
        const currentPlayer = s.players[s.currentTurnIndex];
        // Lượt chọn Role
        if (id.startsWith('r_')) {
            if (interaction.user.id !== currentPlayer.userId) {
                await interaction.reply({ content: "Đéo phải lượt của mày chọn hệ!", ephemeral: true }).catch(() => { });
                return;
            }
            let role = id.split('_')[1];
            if (role === 'random') {
                const roles = ["Duelist", "Initiator", "Controller", "Sentinel"];
                role = roles[Math.floor(Math.random() * roles.length)];
            }
            else {
                role = role.charAt(0).toUpperCase() + role.slice(1);
            }
            await rollAgent(role, interaction, channelId);
        }
    });
}
