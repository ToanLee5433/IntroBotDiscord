import { 
    Client, GatewayIntentBits, VoiceState, Message, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType 
} from 'discord.js';
import { 
    joinVoiceChannel, createAudioPlayer, createAudioResource, 
    AudioPlayerStatus, VoiceConnectionStatus, entersState, getVoiceConnection
} from '@discordjs/voice';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import * as crypto from 'crypto';

// --- HÀM XỬ LÝ TEXT KHÔNG DẤU ---
const removeAccents = (str: string) => {
    return str.normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/đ/g, 'd').replace(/Đ/g, 'D')
              .toLowerCase();
};

// --- HÀM RANDOM CHUẨN CASINO ---
const trueRandom = (max: number) => crypto.randomInt(0, max);
const pickRandom = <T>(arr: T[]): T => arr[trueRandom(arr.length)];
const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

// 1. MÁY CHỦ WEB ẢO LÁCH LUẬT RENDER
const port = process.env.PORT || 8080;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write('BotToan dang hoat dong binh thuong!');
    res.end();
}).listen(port, () => {
    console.log(`[WEB] Máy chủ ảo đang chạy trên port ${port}`);
});

// 2. BIẾN MÔI TRƯỜNG
const TOKEN = process.env.DISCORD_TOKEN;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

if (!TOKEN || !GEMINI_KEY) {
    console.error("[LỖI] Thiếu token!");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_KEY);
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

// ================= BIẾN TÀI SẢN CHUNG =================
const playerBalances: { [userId: string]: number } = {};
const playerDebts: { [userId: string]: number } = {}; 

// ================= BIẾN TRẠNG THÁI VÒNG QUAY VALORANT =================
const fullAgentsByRole: { [key: string]: string[] } = {
    "Duelist": ["Iso", "Jett", "Neon", "Phoenix", "Raze", "Reyna", "Waylay", "Yoru", "Clove"],
    "Initiator": ["Breach", "Fade", "Gekko", "KAY/O", "Skye", "Sova", "Tejo"],
    "Controller": ["Astra", "Brimstone", "Harbor", "Miks", "Omen", "Viper"],
    "Sentinel": ["Chamber", "Cypher", "Deadlock", "Killjoy", "Sage", "Veto", "Vyse"]
};
let currentDraft: string[] = [];
let agentPool: { [key: string]: string[] } = {};
let isDrafting = false;
let currentRole = "";
let currentAgent = "";

// ================= BIẾN TRẠNG THÁI BẦU CUA =================
const bauCuaSymbols = ["Bầu", "Cua", "Tôm", "Cá", "Gà", "Nai"];
const bauCuaEmojis: { [key: string]: string } = {
    "Bầu": "🎃", "Cua": "🦀", "Tôm": "🦐", "Cá": "🐟", "Gà": "🐓", "Nai": "🦌"
};
let isBauCuaActive = false;
let bauCuaHost = "";
let bauCuaBets: { [userId: string]: { name: string, symbol: string, amount: number }[] } = {};
let bcRound = 1;
let lastBCResult = "";
let bcPlayers = new Set<string>();

// ================= BIẾN TRẠNG THÁI XÓC ĐĨA =================
let isXocDiaActive = false;
let xdHost = "";
let xdBets: { [userId: string]: { name: string, type: string, label: string, amount: number }[] } = {};
let xdRound = 1;
let lastXDResult = "";
let xdPlayers = new Set<string>();

// ================= TÍNH NĂNG CHAT VÀ GAME =================
client.on('messageCreate', async (message: Message) => {
    if (message.author.bot || !client.user || !message.mentions.has(client.user)) return;

    const botId = client.user.id;
    const rawInput = message.content.replace(new RegExp(`<@!?${botId}>`, 'g'), '').trim();
    const cleanInput = removeAccents(rawInput); // Chuỗi đã bỏ dấu để check
    if (!cleanInput) return;

    // ----------------- 1. TÍNH NĂNG "CÂM" -----------------
    if (['cam', 'cam mom', 'im di', 'im mom'].some(t => cleanInput.includes(t))) {
        await message.reply("Biết rồi, tao câm đây!");
        return; 
    }

    // ----------------- 2. TÍNH NĂNG VAY NGÂN HÀNG -----------------
    if (['vay ngan hang', 'vay tien'].some(t => cleanInput.includes(t))) {
        const uid = message.author.id;
        if (playerBalances[uid] === undefined) {
            playerBalances[uid] = 100;
            playerDebts[uid] = 0;
            await message.reply("Mày chưa chơi bao giờ, tao cho 100k khởi nghiệp miễn phí. Vào sòng đi!");
            return;
        }
        if (playerBalances[uid] >= 10) {
            await message.reply(`Đĩ thõa, ví mày còn **${playerBalances[uid]}k** mà đòi vay? Bao giờ nhẵn túi tao mới cho vay!`);
            return;
        }
        playerBalances[uid] += 100;
        playerDebts[uid] = (playerDebts[uid] || 0) + 100;
        await message.reply(`🏦 **NGÂN HÀNG BOTTOAN GIẢI NGÂN:**\nBơm **100k** vào ví. Mày đang nợ tao tổng **${playerDebts[uid]}k**. Gỡ lẹ đi!`);
        return;
    }

    // ----------------- 3. TÍNH NĂNG XÓC ĐĨA -----------------
    if (['xoc dia', 'choi xoc dia'].some(t => cleanInput.includes(t))) {
        if (isXocDiaActive) {
            await message.reply("Đang có sòng Xóc Đĩa rồi, vào theo đi con bạc!");
            return;
        }
        isXocDiaActive = true;
        xdHost = message.author.id;
        xdBets = {}; xdRound = 1; lastXDResult = ""; xdPlayers.clear();

        const draftMsg = await message.reply("⛩️ **SÒNG XÓC ĐĨA TRUYỀN THỐNG MỞ CỬA!**\nTrải chiếu, úp bát. Anh em xuống tiền!");
        const collector = draftMsg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 1800000 }); 

        const updateXDBoard = async (interaction?: any) => {
            const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('xd_chan').setLabel('🔴 CHẴN (1:1)').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('xd_le').setLabel('⚪ LẺ (1:1)').setStyle(ButtonStyle.Secondary),
            );
            const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('xd_4do').setLabel('🔴🔴🔴🔴 (1:12)').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('xd_4trang').setLabel('⚪⚪⚪⚪ (1:12)').setStyle(ButtonStyle.Secondary),
            );
            const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('xd_3do1trang').setLabel('🔴🔴🔴⚪ (1:3.5)').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('xd_3trang1do').setLabel('⚪⚪⚪🔴 (1:3.5)').setStyle(ButtonStyle.Primary),
            );
            const row4 = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('xd_mobat').setLabel('🎲 XÓC & MỞ BÁT!').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('xd_dongsong').setLabel('🛑 Đóng Sòng').setStyle(ButtonStyle.Danger)
            );

            let betSummary = `📝 **TÌNH HÌNH XUỐNG XÁC VÒNG ${xdRound}:**\n`;
            if (Object.keys(xdBets).length === 0) betSummary += "*Chưa ai thả đồng nào...*";
            else {
                for (const uid in xdBets) {
                    const userBets = xdBets[uid];
                    const summary = userBets.reduce((acc, curr) => {
                        acc[curr.label] = (acc[curr.label] || 0) + curr.amount;
                        return acc;
                    }, {} as any);
                    const betStrings = Object.entries(summary).map(([lbl, amt]) => `${lbl} (**${amt}k**)`);
                    betSummary += `- **${userBets[0].name}** (${userBets.length}/3 lượt): ${betStrings.join(', ')}\n`;
                }
            }

            let text = `⛩️ **SÒNG XÓC ĐĨA (Host: <@${xdHost}>) - VÒNG ${xdRound}** ⛩️\n👉 Cược **10k/nháy**. Tối đa: **3 lượt/người/vòng**.\n\n${lastXDResult ? lastXDResult + '\n' : ''}${betSummary}`;
            
            if (interaction) {
                if (interaction.replied || interaction.deferred) await interaction.editReply({ content: text, components: [row1, row2, row3, row4] }).catch(()=>{});
                else await interaction.update({ content: text, components: [row1, row2, row3, row4] }).catch(()=>{});
            } else await draftMsg.edit({ content: text, components: [row1, row2, row3, row4] }).catch(()=>{});
        };

        collector.on('collect', async i => {
            const uid = i.user.id;
            const uname = i.user.displayName || i.user.username;

            if (i.customId === 'xd_dongsong') {
                if (uid !== xdHost) { await i.reply({ content: "Tránh ra cho Host dọn chiếu!", ephemeral: true }); return; }
                let finalText = `🛑 **SÒNG ĐÃ DỌN DẸP! LÀNG VỀ QUÊ!** 🛑\n\n💰 **TỔNG KẾT TÀI SẢN:**\n`;
                if (xdPlayers.size === 0) finalText += "*Sòng ế ẩm...*";
                else xdPlayers.forEach(pId => finalText += `- <@${pId}> cầm: **${playerBalances[pId]}k** | Nợ: **${playerDebts[pId]||0}k**\n`);
                await i.update({ content: finalText, components: [] }).catch(()=>{});
                isXocDiaActive = false; collector.stop(); return;
            }

            if (i.customId === 'xd_mobat') {
                if (uid !== xdHost) { await i.reply({ content: "Chỉ Host mới được xóc đĩa!", ephemeral: true }); return; }
                
                await i.update({ content: "⛩️ **CHỦ SÒNG BẮT ĐẦU XÓC...**", components: [] }).catch(()=>{});
                
                // Animation Xóc Đĩa
                const shakeFrames = [
                    `\`\`\`text\n      _______\n    /         \\\n   | LẠCH CẠCH |\n    \\_________/\n\`\`\``,
                    `\`\`\`text\n     _______\n   /         \\\n  | CẠCH LẠCH |\n   \\_________/\n\`\`\``
                ];
                for (let step = 0; step < 6; step++) {
                    await i.editReply({ content: `⛩️ **ĐANG XÓC ĐĨA...**\n${shakeFrames[step % 2]}`, components: [] }).catch(()=>{});
                    await sleep(400);
                }

                // Random kết quả
                let reds = 0, whites = 0;
                let coins = [];
                for(let c=0; c<4; c++) {
                    const isRed = trueRandom(2) === 0;
                    if (isRed) { reds++; coins.push('🔴'); }
                    else { whites++; coins.push('⚪'); }
                }
                
                let isChan = (reds === 0 || reds === 2 || reds === 4);
                let chanLeStr = isChan ? "🔴 CHẴN" : "⚪ LẺ";

                const resultFrame = `\`\`\`text\n    ( ĐÃ MỞ BÁT )\n\n     ${coins[0]}   ${coins[1]}\n     ${coins[2]}   ${coins[3]}\n\n    \\_________/\n\`\`\``;
                lastXDResult = `🔥 **KẾT QUẢ: ${chanLeStr} (${reds} Đỏ - ${whites} Trắng)**\n${resultFrame}\n`;

                if (Object.keys(xdBets).length === 0) lastXDResult += "Vòng rồi nhà cái múa đĩa cho vui, đéo ai chơi!";
                else {
                    for (const playerId in xdBets) {
                        let totalWon = 0, totalLost = 0;
                        xdBets[playerId].forEach(bet => {
                            let multiplier = 0;
                            if (bet.type === 'chan' && isChan) multiplier = 1;
                            else if (bet.type === 'le' && !isChan) multiplier = 1;
                            else if (bet.type === '4do' && reds === 4) multiplier = 12;
                            else if (bet.type === '4trang' && whites === 4) multiplier = 12;
                            else if (bet.type === '3do1trang' && reds === 3) multiplier = 3.5;
                            else if (bet.type === '3trang1do' && whites === 3) multiplier = 3.5;

                            if (multiplier > 0) {
                                const winAmt = bet.amount + (bet.amount * multiplier);
                                playerBalances[playerId] += winAmt;
                                totalWon += (bet.amount * multiplier);
                            } else {
                                totalLost += bet.amount;
                            }
                        });

                        const info = `(Ví: ${playerBalances[playerId]}k | Nợ: ${playerDebts[playerId]||0}k)`;
                        if (totalWon > totalLost) lastXDResult += `🤑 **${xdBets[playerId][0].name}** húp **${totalWon - totalLost}k** ➡️ ${info}\n`;
                        else if (totalLost > totalWon) lastXDResult += `💸 **${xdBets[playerId][0].name}** cháy **${totalLost - totalWon}k** ➡️ ${info}\n`;
                        else lastXDResult += `⚖️ **${xdBets[playerId][0].name}** hòa vốn! ➡️ ${info}\n`;
                    }
                }
                xdBets = {}; xdRound++; await updateXDBoard(i); return;
            }

            if (i.customId.startsWith('xd_')) {
                const betType = i.customId.split('_')[1];
                let label = betType.toUpperCase();
                if (betType==='3do1trang') label = '🔴x3 ⚪x1';
                if (betType==='3trang1do') label = '⚪x3 🔴x1';
                
                if (playerBalances[uid] === undefined) { playerBalances[uid] = 100; playerDebts[uid] = 0; }
                if (playerBalances[uid] < 10) { await i.reply({ content: "Cháy túi rồi, xin xỏ Vay Ngân Hàng đi!", ephemeral: true }); return; }
                if (xdBets[uid] && xdBets[uid].length >= 3) { await i.reply({ content: "Tối đa 3 lượt cược (30k) mỗi ván thôi!", ephemeral: true }); return; }

                playerBalances[uid] -= 10; xdPlayers.add(uid);
                if (!xdBets[uid]) xdBets[uid] = [];
                xdBets[uid].push({ name: uname, type: betType, label: label, amount: 10 });
                await updateXDBoard(i);
            }
        });

        collector.on('end', () => {
            if (isXocDiaActive) { isXocDiaActive = false; draftMsg.reply("Sòng đóng vì ngâm quá lâu!").catch(()=>{}); }
        });
        await updateXDBoard(); return;
    }

    // ----------------- 4. TÍNH NĂNG GAME BẦU CUA -----------------
    if (['bau cua', 'choi bau cua'].some(t => cleanInput.includes(t))) {
        if (isBauCuaActive) { await message.reply("Đang có sòng mở rồi!"); return; }
        isBauCuaActive = true; bauCuaHost = message.author.id; bauCuaBets = {}; bcRound = 1; lastBCResult = ""; bcPlayers.clear();
        const draftMsg = await message.reply("🎲 **SÒNG BẦU CUA MỞ CỬA!**");
        const collector = draftMsg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 1800000 }); 

        const updateBCBoard = async (interaction?: any) => {
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
                new ButtonBuilder().setCustomId('bc_mobat').setLabel('🎲 MỞ BÁT!').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('bc_dongsong').setLabel('🛑 Đóng Sòng').setStyle(ButtonStyle.Danger)
            );

            let betSummary = `📝 **GỬI GẠO VÒNG ${bcRound}:**\n`;
            if (Object.keys(bauCuaBets).length === 0) betSummary += "*Chưa ai xuống tiền...*";
            else {
                for (const uid in bauCuaBets) {
                    const userBets = bauCuaBets[uid];
                    const summary = userBets.reduce((acc, curr) => { acc[curr.symbol] = (acc[curr.symbol] || 0) + curr.amount; return acc; }, {} as any);
                    const betStrings = Object.entries(summary).map(([sym, amt]) => `${bauCuaEmojis[sym]} ${sym} (**${amt}k**)`);
                    betSummary += `- **${userBets[0].name}** (${userBets.length}/3): ${betStrings.join(', ')}\n`;
                }
            }

            let text = `🎲 **BẦU CUA (Host: <@${bauCuaHost}>) - VÒNG ${bcRound}**\n👉 **10k/nháy**. Tối đa: 3 lượt/người.\n\n${lastBCResult ? lastBCResult + '\n' : ''}${betSummary}`;
            
            if (interaction) {
                if (interaction.replied || interaction.deferred) await interaction.editReply({ content: text, components: [row1, row2, row3] }).catch(()=>{});
                else await interaction.update({ content: text, components: [row1, row2, row3] }).catch(()=>{});
            } else await draftMsg.edit({ content: text, components: [row1, row2, row3] }).catch(()=>{});
        };

        collector.on('collect', async i => {
            const uid = i.user.id; const uname = i.user.displayName || i.user.username;
            if (i.customId === 'bc_dongsong') {
                if (uid !== bauCuaHost) return;
                isBauCuaActive = false; collector.stop();
                await i.update({ content: `🛑 **SÒNG ĐÓNG!**`, components: [] }).catch(()=>{}); return;
            }
            if (i.customId === 'bc_mobat') {
                if (uid !== bauCuaHost) return;
                await i.update({ content: "🎲 **ĐANG XÓC ĐĨA...**", components: [] }).catch(()=>{});
                let speed = 400;
                for(let step = 0; step < 4; step++) {
                    const t = [pickRandom(bauCuaSymbols), pickRandom(bauCuaSymbols), pickRandom(bauCuaSymbols)];
                    const box = `\`\`\`\n╔══════════════════════════════╗\n║    [ ${bauCuaEmojis[t[0]]} ]    [ ${bauCuaEmojis[t[1]]} ]    [ ${bauCuaEmojis[t[2]]} ]    ║\n╚══════════════════════════════╝\n\`\`\``;
                    await i.editReply({ content: `🎲 **CHỦ SÒNG ĐANG XÓC...**\n${box}`, components: [] }).catch(()=>{});
                    await sleep(speed); speed += 200;
                }
                const res = [pickRandom(bauCuaSymbols), pickRandom(bauCuaSymbols), pickRandom(bauCuaSymbols)];
                const finalBox = `\`\`\`\n╔══════════════════════════════╗\n║  ✨  ${bauCuaEmojis[res[0]]}  ✨  ${bauCuaEmojis[res[1]]}  ✨  ${bauCuaEmojis[res[2]]}  ✨  ║\n╚══════════════════════════════╝\n\`\`\``;
                lastBCResult = `🔥 **KẾT QUẢ:**\n${finalBox}\n`;
                for (const pId in bauCuaBets) {
                    let w=0, l=0;
                    bauCuaBets[pId].forEach(b => {
                        let m = res.filter(r => r === b.symbol).length;
                        if(m>0) { playerBalances[pId]+=b.amount+(b.amount*m); w+=b.amount*m; } else l+=b.amount;
                    });
                    const info = `(Ví: ${playerBalances[pId]}k)`;
                    if(w>l) lastBCResult += `🤑 **${bauCuaBets[pId][0].name}** ăn **${w-l}k** ${info}\n`;
                    else if (l>w) lastBCResult += `💸 **${bauCuaBets[pId][0].name}** thua **${l-w}k** ${info}\n`;
                }
                bauCuaBets = {}; bcRound++; await updateBCBoard(i); return;
            }
            if (i.customId.startsWith('bc_')) {
                const sym = i.customId.split('_')[1];
                if (playerBalances[uid] === undefined) { playerBalances[uid] = 100; playerDebts[uid] = 0; }
                if (playerBalances[uid] < 10 || (bauCuaBets[uid] && bauCuaBets[uid].length >= 3)) return;
                playerBalances[uid] -= 10; bcPlayers.add(uid);
                if (!bauCuaBets[uid]) bauCuaBets[uid] = [];
                bauCuaBets[uid].push({ name: uname, symbol: sym, amount: 10 });
                await updateBCBoard(i);
            }
        });
        await updateBCBoard(); return;
    }

    // ----------------- 5. TÍNH NĂNG PICK TƯỚNG VALORANT -----------------
    if (['quay tuong', 'chon tuong', 'random tuong', 'pick tuong'].some(t => cleanInput.includes(t))) {
        if (isDrafting) { await message.reply("Đang pick dở kìa mày!"); return; }
        isDrafting = true; currentDraft = [];
        agentPool = {
            "Duelist": [...fullAgentsByRole["Duelist"]], "Initiator": [...fullAgentsByRole["Initiator"]],
            "Controller": [...fullAgentsByRole["Controller"]], "Sentinel": [...fullAgentsByRole["Sentinel"]]
        };
        const draftMsg = await message.reply("🎲 **Bắt đầu Draft Team Valorant!**");
        const collector = draftMsg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 300000 }); 

        const showRoleMenu = async (interaction?: any) => {
            const r1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('r_duelist').setLabel('⚔️ Duelist').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('r_initiator').setLabel('👁️ Initiator').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('r_controller').setLabel('💨 Controller').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('r_sentinel').setLabel('🛡️ Sentinel').setStyle(ButtonStyle.Primary)
            );
            const r2 = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('r_random').setLabel('🎲 Random Role').setStyle(ButtonStyle.Success));
            const text = `🎯 **VỊ TRÍ THỨ ${currentDraft.length + 1}**: Mày muốn pick Role nào?\n*Đội hình: [ ${currentDraft.length > 0 ? currentDraft.join(' | ') : 'Chưa có ai'} ]*`;
            if (interaction) {
                if (interaction.replied || interaction.deferred) await interaction.editReply({ content: text, components: [r1, r2] }).catch(()=>{});
                else await interaction.update({ content: text, components: [r1, r2] }).catch(()=>{});
            } else await draftMsg.edit({ content: text, components: [r1, r2] }).catch(()=>{});
        };

        const rollAgent = async (role: string, interaction: any) => {
            if (!agentPool[role] || agentPool[role].length === 0) agentPool[role] = [...fullAgentsByRole[role]];
            currentRole = role;
            if (interaction.replied || interaction.deferred) await interaction.editReply({ content: `🌀 Máy quay hệ **${role.toUpperCase()}**...`, components: [] }).catch(()=>{});
            else await interaction.update({ content: `🌀 Máy quay hệ **${role.toUpperCase()}**...`, components: [] }).catch(()=>{});

            const pool = agentPool[role];
            let speed = 300;
            for(let step = 0; step < 4; step++) {
                let p2 = pickRandom(pool);
                const slider = `\`\`\`\n╭━━━━━━━━━━━━━━━━━━━━━━━╮\n│ ⏬ ĐANG QUAY...\n├───────────────────────┤\n│ ➔  [ ${p2.toUpperCase()} ]  ✨\n╰━━━━━━━━━━━━━━━━━━━━━━━╯\n\`\`\``;
                await interaction.editReply({ content: `🌀 **VÒNG QUAY ĐANG LƯỚT...**\n${slider}`, components: [] }).catch(()=>{});
                await sleep(speed); speed += 250; 
            }
            currentAgent = pickRandom(pool);
            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('a_chot').setLabel('✅ Chốt luôn').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('a_doi').setLabel('🔄 Đổi').setStyle(ButtonStyle.Danger),
            );
            const finalSlider = `\`\`\`\n╭━━━━━━━━━━━━━━━━━━━━━━━╮\n│ 🎉 KẾT QUẢ\n├───────────────────────┤\n│ ⭐  ${currentAgent.toUpperCase()}  ⭐\n╰━━━━━━━━━━━━━━━━━━━━━━━╯\n\`\`\``;
            await interaction.editReply({ content: `🎭 **VỊ TRÍ THỨ ${currentDraft.length + 1}** (${currentRole}):\n${finalSlider}`, components: [row] }).catch(()=>{});
        };

        collector.on('collect', async i => {
            const id = i.customId;
            if (id.startsWith('r_')) {
                let r = id.split('_')[1];
                if (r === 'random') r = ["Duelist", "Initiator", "Controller", "Sentinel"][trueRandom(4)];
                else r = r.charAt(0).toUpperCase() + r.slice(1); 
                await rollAgent(r, i);
            } 
            else if (id === 'a_chot') {
                currentDraft.push(`${currentAgent} (${currentRole})`);
                agentPool[currentRole] = agentPool[currentRole].filter(a => a !== currentAgent); 
                if (currentDraft.length === 5) {
                    await i.update({ content: `🏆 **CHỐT XONG TEAM:**\n${currentDraft.join(' ⚔️ ')}`, components: [] }).catch(()=>{});
                    isDrafting = false; collector.stop();
                } else await showRoleMenu(i); 
            } 
            else if (id === 'a_doi') {
                agentPool[currentRole] = agentPool[currentRole].filter(a => a !== currentAgent); 
                await rollAgent(currentRole, i); 
            } 
        });
        await showRoleMenu(); return; 
    }

    // ----------------- 6. TÍNH NĂNG CHAT GEMINI -----------------
    await sleep(2000);
    try {
        if ('sendTyping' in message.channel) await (message.channel as any).sendTyping();
        const model = genAI.getGenerativeModel({ 
            model: "gemini-3.1-flash-lite",
            systemInstruction: `Bạn là BotToan, trợ lý "bựa", dùng từ lóng, xưng hô mày-tao. Cực gắt, không xúc phạm. Dưới 900 ký tự. Không gửi link.`
        });
        const result = await model.generateContent(userQuestion);
        const chunks = result.response.text().replace(/https?:\/\/[^\s]+/g, "").match(/.{1,900}(\s|$)/g) || [];
        for (const chunk of chunks) { if (chunk.trim()) { await message.reply(chunk.trim()); await sleep(2000); } }
    } catch (e) { await message.reply('Mạng lag đéo load được!'); }
});

// ================= TÍNH NĂNG VOICE =================
client.on('voiceStateUpdate', async (oldState: VoiceState, newState: VoiceState) => {
    if (newState.member?.user.bot || oldState.channelId === newState.channelId) return;
    const oldChannel = oldState.channel; const newChannel = newState.channel;

    if (oldChannel) {
        const connection = getVoiceConnection(oldChannel.guild.id);
        if (connection && connection.joinConfig.channelId === oldChannel.id && oldChannel.members.filter(m => !m.user.bot).size === 0) connection.destroy();
    }
    if (!newChannel) return;

    const audioPath = path.join(__dirname, '../audio', `${newState.member?.id}.mp3`);
    if (!fs.existsSync(audioPath)) return; 

    try {
        const connection = joinVoiceChannel({ channelId: newChannel.id, guildId: newChannel.guild.id, adapterCreator: newChannel.guild.voiceAdapterCreator });
        await entersState(connection, VoiceConnectionStatus.Ready, 5000);
        const player = createAudioPlayer();
        player.play(createAudioResource(audioPath));
        connection.subscribe(player);
        player.on(AudioPlayerStatus.Idle, () => player.stop());
    } catch (e) {}
});

client.login(TOKEN);
