import { 
    Client, GatewayIntentBits, VoiceState, Message, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType,
    StringSelectMenuBuilder, StringSelectMenuOptionBuilder
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

// --- HÀM RANDOM CHUẨN CASINO BẰNG MÃ HÓA ---
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

// ================= CẤU HÌNH VỐN KHỞI NGHIỆP TRÒ CHƠI =================
const STARTING_BALANCE = 100; // Tiền mặc định chung cho mọi người (100k)

const playerBalances: { [userId: string]: number } = {};
const playerDebts: { [userId: string]: number } = {}; 
const currentBetSizes: { [userId: string]: number } = {}; 

const checkAndInitWallet = (uid: string) => {
    if (playerBalances[uid] === undefined) {
        playerBalances[uid] = STARTING_BALANCE;
        playerDebts[uid] = 0;
    }
};

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

// ================= BIẾN TRẠNG THÁI XÓC ĐĨA =================
let isXocDiaActive = false;
let xdHost = "";
let xdBets: { [userId: string]: { name: string, type: string, label: string, amount: number }[] } = {};
let xdRound = 1;
let lastXDResult = "";

// ================= BIẾN TRẠNG THÁI BLACKJACK =================
type BJState = 'playing' | 'stood' | 'busted' | 'blackjack';
interface BJPlayer {
    name: string;
    bet: number;
    hand: string[];
    state: BJState;
    value: number;
}

let isBJActive = false;
let bjHost = "";
let bjPhase = 'betting'; 
let bjDeck: string[] = [];
let bjDealerHand: string[] = [];
let bjPlayers: Record<string, BJPlayer> = {};

const getHandValue = (hand: string[]) => {
    let value = 0; let aces = 0;
    for (const card of hand) {
        if (card === '?') continue;
        const rank = card.slice(0, -1);
        if (['J', 'Q', 'K'].includes(rank)) value += 10;
        else if (rank === 'A') { value += 11; aces += 1; }
        else value += parseInt(rank);
    }
    while (value > 21 && aces > 0) { value -= 10; aces -= 1; }
    return value;
};

const buildDeck = () => {
    const suits = ['♠', '♣', '♦', '♥'];
    const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    const deck: string[] = [];
    for (let d = 0; d < 4; d++) {
        for (const suit of suits) {
            for (const rank of ranks) deck.push(rank + suit);
        }
    }
    for (let i = deck.length - 1; i > 0; i--) {
        const j = trueRandom(i + 1);
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
};

// ================= TÍNH NĂNG CHAT VÀ GAME =================
client.on('messageCreate', async (message: Message) => {
    if (message.author.bot || !client.user || !message.mentions.has(client.user)) return;

    const botId = client.user.id;
    const rawInput = message.content.replace(new RegExp(`<@!?${botId}>`, 'g'), '').trim();
    const cleanInput = removeAccents(rawInput); 
    if (!cleanInput) return;

    // ----------------- 1. TÍNH NĂNG "CÂM" -----------------
    if (['cam', 'cam mom', 'im di', 'im mom'].some(t => cleanInput.includes(t))) {
        await message.reply("Biết rồi, tao câm đây!");
        return; 
    }

    // ----------------- 2. TÍNH NĂNG VAY NGÂN HÀNG -----------------
    if (['vay ngan hang', 'vay tien'].some(t => cleanInput.includes(t))) {
        const uid = message.author.id;
        checkAndInitWallet(uid);
        if (playerBalances[uid] >= 10) {
            await message.reply(`Đĩ thõa, ví mày còn **${playerBalances[uid]}k** mà đòi vay? Bao giờ nhẵn túi tao mới cho vay!`);
            return;
        }
        playerBalances[uid] += STARTING_BALANCE;
        playerDebts[uid] = (playerDebts[uid] || 0) + STARTING_BALANCE;
        await message.reply(`🏦 **NGÂN HÀNG BOTTOAN GIẢI NGÂN:**\nBơm thêm **${STARTING_BALANCE}k** vào ví chung. Mày đang nợ tao tổng **${playerDebts[uid]}k**. Gỡ lẹ đi!`);
        return;
    }

    // ----------------- 3. TÍNH NĂNG ĐIỂM DANH TÀI SẢN -----------------
    if (['tai san', 'vi tien', 'check tien', 'bop tien'].some(t => cleanInput.includes(t))) {
        const voiceChannel = message.member?.voice.channel;
        let outputText = "💰 **BẢNG PHONG THẦN TÀI SẢN CHUNG** 💰\n*(Tiền này dùng chung cho mọi sòng: Xóc Đĩa, Bầu Cua, Blackjack)*\n\n";

        if (voiceChannel) {
            outputText += `👥 **Đang quét phòng thoại <#${voiceChannel.id}>:**\n`;
            voiceChannel.members.forEach(member => {
                if (member.user.bot) return; 
                const uid = member.id;
                checkAndInitWallet(uid);
                outputText += `- **${member.displayName}**: Ví: **${playerBalances[uid]}k** | Nợ: **${playerDebts[uid] || 0}k**\n`;
            });
        } else {
            outputText += `🌍 **Danh sách tổng hợp toàn server:**\n`;
            const allUsers = Object.keys(playerBalances);
            if (allUsers.length === 0) outputText += "*Chưa có ai mở ví cả!*";
            else {
                allUsers.forEach(uid => {
                    const member = message.guild?.members.cache.get(uid);
                    const name = member ? member.displayName : `<@${uid}>`;
                    outputText += `- **${name}**: Ví: **${playerBalances[uid]}k** | Nợ: **${playerDebts[uid] || 0}k**\n`;
                });
            }
        }
        await message.reply(outputText);
        return;
    }

    // ----------------- 4. TÍNH NĂNG XÓC ĐĨA -----------------
    if (['xoc dia', 'choi xoc dia'].some(t => cleanInput.includes(t))) {
        if (isXocDiaActive) { await message.reply("Đang có sòng Xóc Đĩa rồi!"); return; }
        isXocDiaActive = true; xdHost = message.author.id; xdBets = {}; xdRound = 1; lastXDResult = "";
        
        const draftMsg = await message.reply("⛩️ **SÒNG XÓC ĐĨA MỞ CỬA!**");
        const collector = draftMsg.createMessageComponentCollector({ time: 1800000 }); 

        const updateXDBoard = async (interaction?: any) => {
            const row0 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                new StringSelectMenuBuilder().setCustomId('xd_bet_size').setPlaceholder('💵 Bấm để chọn mức tiền (Mặc định: 10k)')
                    .addOptions(
                        new StringSelectMenuOptionBuilder().setLabel('10k').setValue('10').setEmoji('🪙'),
                        new StringSelectMenuOptionBuilder().setLabel('20k').setValue('20').setEmoji('💵'),
                        new StringSelectMenuOptionBuilder().setLabel('30k').setValue('30').setEmoji('💸'),
                        new StringSelectMenuOptionBuilder().setLabel('40k').setValue('40').setEmoji('💰'),
                        new StringSelectMenuOptionBuilder().setLabel('50k (Max)').setValue('50').setEmoji('💎')
                    )
            );
            const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('xd_chan').setLabel('🔴 CHẴN (1 ăn 1)').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('xd_le').setLabel('⚪ LẺ (1 ăn 1)').setStyle(ButtonStyle.Secondary)
            );
            const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('xd_4do').setLabel('🔴x4 (1 ăn 14)').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('xd_4trang').setLabel('⚪x4 (1 ăn 14)').setStyle(ButtonStyle.Secondary)
            );
            const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('xd_3do1trang').setLabel('🔴x3 (1 ăn 3)').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('xd_3trang1do').setLabel('⚪x3 (1 ăn 3)').setStyle(ButtonStyle.Primary)
            );
            const row4 = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('xd_mobat').setLabel('🎲 XÓC & MỞ BÁT!').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('xd_dongsong').setLabel('🛑 Đóng Sòng').setStyle(ButtonStyle.Danger)
            );

            let betSummary = `📝 **TÌNH HÌNH XUỐNG XÁC VÒNG ${xdRound}:**\n`;
            if (Object.keys(xdBets).length === 0) betSummary += "*Chưa ai thả đồng nào...*";
            else {
                for (const uid in xdBets) {
                    const ub = xdBets[uid];
                    const summary = ub.reduce((acc, curr) => { acc[curr.label] = (acc[curr.label] || 0) + curr.amount; return acc; }, {} as any);
                    const betStrings = Object.entries(summary).map(([lbl, amt]) => `${lbl} (**${amt}k**)`);
                    betSummary += `- **${ub[0].name}** *(Ví còn: ${playerBalances[uid]}k)*: ${betStrings.join(', ')}\n`;
                }
            }

            let text = `⛩️ **SÒNG XÓC ĐĨA (Host: <@${xdHost}>) - VÒNG ${xdRound}**\n👉 **LUẬT:** Chọn mức cược ở Menu dưới trước khi bấm. Đặt duy nhất 1 cửa.\n\n${lastXDResult ? lastXDResult + '\n' : ''}${betSummary}`;
            if (interaction) {
                if (interaction.replied || interaction.deferred) await interaction.editReply({ content: text, components: [row0, row1, row2, row3, row4] }).catch(()=>{});
                else await interaction.update({ content: text, components: [row0, row1, row2, row3, row4] }).catch(()=>{});
            } else await draftMsg.edit({ content: text, components: [row0, row1, row2, row3, row4] }).catch(()=>{});
        };

        collector.on('collect', async (i: any) => {
            const uid = i.user.id; const uname = i.user.displayName || i.user.username;
            
            // XỬ LÝ MENU: KHÔNG SPAM TIN NHẮN
            if (i.isStringSelectMenu() && i.customId === 'xd_bet_size') {
                currentBetSizes[uid] = parseInt(i.values[0]);
                await i.deferUpdate().catch(()=>{}); 
                return;
            }

            if (!i.isButton()) return;
            
            if (i.customId === 'xd_dongsong') {
                if (uid !== xdHost) return;
                isXocDiaActive = false; collector.stop();
                await i.update({ content: `🛑 **SÒNG XÓC ĐĨA ĐÃ ĐÓNG CỬA!**`, components: [] }).catch(()=>{}); return;
            }
            
            if (i.customId === 'xd_mobat') {
                if (uid !== xdHost) return;
                await i.update({ content: "⛩️ **CHỦ SÒNG ĐANG KÉO BÁT...**", components: [] }).catch(()=>{});
                
                const shakeFrames = [
`\`\`\`text
      ___/^^\\___ 
     |  LẠCH..  |
      \\________/ 
     ============
\`\`\``,
`\`\`\`text
       ___/^^\\___ 
      |  ..CẠCH  |
       \\________/ 
      ============
\`\`\``
                ];
                
                for (let step = 0; step < 6; step++) {
                    await i.editReply({ content: `⛩️ **ĐANG XÓC ĐĨA...**\n${shakeFrames[step % 2]}`, components: [] }).catch(()=>{});
                    await sleep(400);
                }

                let reds = 0, whites = 0, coins = [];
                for(let c=0; c<4; c++) { 
                    if (trueRandom(2) === 0) { reds++; coins.push('🔴'); } else { whites++; coins.push('⚪'); } 
                }
                let isChan = (reds === 0 || reds === 2 || reds === 4);
                
                const resultFrame = `\`\`\`text
         (NHẤC BÁT)
        ___/^^\\___ 
       |          |
        \\________/ 

       ${coins[0]}      ${coins[1]}
       ${coins[2]}      ${coins[3]}
      ============
\`\`\``;
                lastXDResult = `🔥 **KẾT QUẢ: ${isChan ? "🔴 CHẴN" : "⚪ LẺ"} (${reds} Đỏ - ${whites} Trắng)**\n${resultFrame}\n`;
                
                for (const pId in xdBets) {
                    let w=0, l=0;
                    xdBets[pId].forEach(b => {
                        let mul = 0;
                        if (b.type === 'chan' && isChan) mul = 1; else if (b.type === 'le' && !isChan) mul = 1;
                        else if (b.type === '4do' && reds === 4) mul = 14; else if (b.type === '4trang' && whites === 4) mul = 14;
                        else if (b.type === '3do1trang' && reds === 3) mul = 3; else if (b.type === '3trang1do' && whites === 3) mul = 3;
                        
                        if (mul > 0) { 
                            playerBalances[pId] += b.amount + (b.amount * mul); 
                            w += b.amount * mul; 
                        } else l += b.amount;
                    });
                    if (w>l) lastXDResult += `🤑 **${xdBets[pId][0].name}** húp lãi **${w}k** (Ví: ${playerBalances[pId]}k)\n`; 
                    else if (l>w) lastXDResult += `💸 **${xdBets[pId][0].name}** mất **${l}k** (Ví: ${playerBalances[pId]}k)\n`;
                }
                xdBets = {}; xdRound++; await updateXDBoard(i); return;
            }
            
            if (i.customId.startsWith('xd_')) {
                const bType = i.customId.split('_')[1]; let lbl = bType.toUpperCase();
                checkAndInitWallet(uid);
                
                if (xdBets[uid] && xdBets[uid].length >= 1) { 
                    await i.reply({ content: "Mày đặt 1 cửa rồi con tham này! Chờ đi.", ephemeral: true }); return; 
                }
                
                const bAmt = currentBetSizes[uid] || 10;
                if (playerBalances[uid] < bAmt) { 
                    await i.reply({ content: `Ví còn có ${playerBalances[uid]}k mà đòi cược ${bAmt}k! Ra chat gọi Vay Tiền đi.`, ephemeral: true }); return; 
                }
                
                playerBalances[uid] -= bAmt; 
                if (!xdBets[uid]) xdBets[uid] = []; 
                xdBets[uid].push({ name: uname, type: bType, label: lbl, amount: bAmt });
                await updateXDBoard(i);
            }
        });
        await updateXDBoard(); return;
    }

    // ----------------- 5. TÍNH NĂNG BLACKJACK (XÌ DÁCH) -----------------
    if (['blackjack', 'xi dach', 'xidach', 'choi blackjack'].some(t => cleanInput.includes(t))) {
        if (isBJActive) { await message.reply("Đang có sòng Blackjack mở rồi!"); return; }
        isBJActive = true; bjHost = message.author.id; bjPhase = 'betting'; bjPlayers = {};
        bjDeck = buildDeck(); bjDealerHand = [];

        const draftMsg = await message.reply("🃏 **SÒNG BLACKJACK (XÌ DÁCH) MỞ CỬA!**");
        const collector = draftMsg.createMessageComponentCollector({ time: 1800000 }); 

        const updateBJBoard = async (interaction?: any) => {
            let components: any[] = [];
            let text = `🃏 **SÒNG BLACKJACK (Host: <@${bjHost}>)** 🃏\n`;

            if (bjPhase === 'betting') {
                const row0 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                    new StringSelectMenuBuilder().setCustomId('bj_bet_size').setPlaceholder('💵 Bấm để chọn mức tiền (Mặc định: 10k)')
                        .addOptions(
                            new StringSelectMenuOptionBuilder().setLabel('10k').setValue('10').setEmoji('🪙'),
                            new StringSelectMenuOptionBuilder().setLabel('20k').setValue('20').setEmoji('💵'),
                            new StringSelectMenuOptionBuilder().setLabel('30k').setValue('30').setEmoji('💸'),
                            new StringSelectMenuOptionBuilder().setLabel('40k').setValue('40').setEmoji('💰'),
                            new StringSelectMenuOptionBuilder().setLabel('50k (Max)').setValue('50').setEmoji('💎')
                        )
                );
                const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder().setCustomId('bj_join').setLabel('📥 Vào Bàn (Đặt Cược)').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('bj_deal').setLabel('🃏 CHIA BÀI!').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('bj_close').setLabel('🛑 Đóng Sòng').setStyle(ButtonStyle.Danger)
                );
                components = [row0, row1];
                text += `👉 **Giai đoạn Đặt Cược.** (Mỗi người cược 1 lần. Chỉnh mức tiền ở Menu trước khi Vào Bàn)\n\n📝 **Danh sách đã xuống tiền:**\n`;
                if (Object.keys(bjPlayers).length === 0) text += "*Chưa ai vào bàn...*";
                else {
                    for (const uid in bjPlayers) {
                        text += `- **${bjPlayers[uid].name}** *(Ví còn: ${playerBalances[uid]}k)*: Đã cược **${bjPlayers[uid].bet}k**\n`;
                    }
                }
            } 
            else if (bjPhase === 'playing' || bjPhase === 'ended') {
                if (bjPhase === 'playing') {
                    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder().setCustomId('bj_hit').setLabel('👆 Rút Thêm (Hit)').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId('bj_stand').setLabel('✋ Dừng (Stand)').setStyle(ButtonStyle.Danger)
                    );
                    components = [row1];
                    text += `👉 **Giai đoạn Kéo bài.** Bấm Rút hoặc Dừng!\n\n`;
                } else text += `🔥 **KẾT QUẢ VÁN BÀI:**\n\n`;

                const dealerVal = getHandValue(bjDealerHand);
                const isHidden = bjDealerHand.includes('?');
                const dealerDisplay = bjDealerHand.map(c => c === '?' ? '🂠 Úp' : c).join(' ] [ ');
                
                text += `🕴️ **NHÀ CÁI:** [ ${dealerDisplay} ] (Điểm: ${isHidden ? '?' : dealerVal})\n`;
                text += `--------------------------\n`;
                
                for (const uid in bjPlayers) {
                    const p = bjPlayers[uid];
                    let statusIcon = "⏳";
                    if (p.state === 'blackjack') statusIcon = "🌟 BLACKJACK!";
                    else if (p.state === 'busted') statusIcon = "💥 QUẮC (Cháy)";
                    else if (p.state === 'stood') statusIcon = `✋ Dừng (${p.value} đ)`;
                    else if (bjPhase === 'ended') statusIcon = `(${p.value} đ)`;
                    text += `👤 **${p.name}** (Cược ${p.bet}k):\n> Bài: [ ${p.hand.join(' ] [ ')} ] ${statusIcon}\n`;
                }
            }

            if (interaction) {
                if (interaction.replied || interaction.deferred) await interaction.editReply({ content: text, components }).catch(()=>{});
                else await interaction.update({ content: text, components }).catch(()=>{});
            } else await draftMsg.edit({ content: text, components }).catch(()=>{});
        };

        collector.on('collect', async (i: any) => {
            const uid = i.user.id; const uname = i.user.displayName || i.user.username;

            // XỬ LÝ MENU: KHÔNG SPAM TIN NHẮN
            if (i.isStringSelectMenu() && i.customId === 'bj_bet_size') {
                currentBetSizes[uid] = parseInt(i.values[0]);
                await i.deferUpdate().catch(()=>{});
                return;
            }

            if (!i.isButton()) return;

            if (i.customId === 'bj_close') {
                if (uid !== bjHost) return;
                if (bjPhase === 'betting') {
                    for (const pId in bjPlayers) playerBalances[pId] += bjPlayers[pId].bet;
                }
                isBJActive = false; collector.stop();
                await i.update({ content: `🛑 **SÒNG ĐÃ GIẢI TÁN!**`, components: [] }).catch(()=>{}); return;
            }

            if (i.customId === 'bj_join') {
                if (bjPhase !== 'betting') return;
                checkAndInitWallet(uid);
                if (bjPlayers[uid]) { await i.reply({ content: "Đã ngồi trong bàn rồi!", ephemeral: true }); return; }
                
                const bAmt = currentBetSizes[uid] || 10;
                if (playerBalances[uid] < bAmt) { await i.reply({ content: `Ví mày còn có ${playerBalances[uid]}k thôi, không đủ cược ${bAmt}k!`, ephemeral: true }); return; }

                playerBalances[uid] -= bAmt;
                bjPlayers[uid] = { name: uname, bet: bAmt, hand: [], state: 'playing', value: 0 };
                await updateBJBoard(i);
            }

            if (i.customId === 'bj_deal') {
                if (uid !== bjHost || bjPhase !== 'betting') return;
                if (Object.keys(bjPlayers).length === 0) return;
                
                bjPhase = 'playing';
                for (let c = 0; c < 2; c++) {
                    for (const pId in bjPlayers) bjPlayers[pId].hand.push(bjDeck.pop()!);
                    bjDealerHand.push(c === 1 ? '?' : bjDeck.pop()!); 
                }

                let allDone = true;
                for (const pId in bjPlayers) {
                    bjPlayers[pId].value = getHandValue(bjPlayers[pId].hand);
                    if (bjPlayers[pId].value === 21) bjPlayers[pId].state = 'blackjack';
                    else allDone = false;
                }

                if (allDone) { bjPhase = 'ended'; await resolveDealerTurn(i); } 
                else await updateBJBoard(i);
            }

            if (i.customId === 'bj_hit' || i.customId === 'bj_stand') {
                if (bjPhase !== 'playing' || !bjPlayers[uid] || bjPlayers[uid].state !== 'playing') {
                    await i.reply({ content: "Chưa tới lượt hoặc đã chốt rồi!", ephemeral: true }); return;
                }

                if (i.customId === 'bj_hit') {
                    bjPlayers[uid].hand.push(bjDeck.pop()!);
                    bjPlayers[uid].value = getHandValue(bjPlayers[uid].hand);
                    if (bjPlayers[uid].value > 21) bjPlayers[uid].state = 'busted';
                    else if (bjPlayers[uid].value === 21) bjPlayers[uid].state = 'stood';
                } else {
                    bjPlayers[uid].state = 'stood';
                }

                const allDone = Object.values(bjPlayers).every(p => p.state !== 'playing');
                if (allDone) { bjPhase = 'ended'; await resolveDealerTurn(i); } 
                else await updateBJBoard(i);
            }
        });

        const resolveDealerTurn = async (interaction: any) => {
            bjDealerHand[1] = bjDeck.pop()!; 
            while (getHandValue(bjDealerHand) < 17) bjDealerHand.push(bjDeck.pop()!);
            
            const dealerVal = getHandValue(bjDealerHand);
            const dealerBust = dealerVal > 21;
            const dealerBJ = dealerVal === 21 && bjDealerHand.length === 2;

            let resultText = `\n💰 **TỔNG KẾT TRẢ THƯỞNG:**\n`;
            for (const pId in bjPlayers) {
                const p = bjPlayers[pId];

                // Logic Toán Học Casino Chuẩn Xác:
                if (p.state === 'busted') {
                    resultText += `- **${p.name}**: 💥 Bị Quắc - Mất ${p.bet}k\n`;
                } else if (p.state === 'blackjack') {
                    if (dealerBJ) { 
                        playerBalances[pId] += p.bet; // Hoàn tiền
                        resultText += `- **${p.name}**: ⚖️ Hòa Blackjack - Hoàn ${p.bet}k\n`; 
                    } else {
                        playerBalances[pId] += p.bet + (p.bet * 1.5); // Gốc + Lãi 1.5
                        resultText += `- **${p.name}**: 🌟 Xì Dách! - Ăn lãi ${p.bet * 1.5}k\n`;
                    }
                } else {
                    // Người chơi bình thường (Stood)
                    if (dealerBust) { 
                        playerBalances[pId] += p.bet * 2; // Gốc + Lãi 1
                        resultText += `- **${p.name}**: 🤑 Nhà cái Quắc - Ăn lãi ${p.bet}k\n`; 
                    } else if (p.value > dealerVal) { 
                        playerBalances[pId] += p.bet * 2; 
                        resultText += `- **${p.name}**: 🤑 Thắng điểm - Ăn lãi ${p.bet}k\n`; 
                    } else if (p.value === dealerVal) { 
                        playerBalances[pId] += p.bet; 
                        resultText += `- **${p.name}**: ⚖️ Hòa điểm - Hoàn ${p.bet}k\n`; 
                    } else {
                        resultText += `- **${p.name}**: 💸 Thua điểm - Mất ${p.bet}k\n`;
                    }
                }
            }

            // Gộp bảng kết quả vào UI để gửi 1 lần duy nhất
            let text = `🃏 **SÒNG BLACKJACK (Host: <@${bjHost}>)** 🃏\n🔥 **KẾT QUẢ VÁN BÀI:**\n\n`;
            text += `🕴️ **NHÀ CÁI:** [ ${bjDealerHand.join(' ] [ ')} ] (Điểm: ${dealerVal})\n`;
            text += `--------------------------\n`;
            for (const uid in bjPlayers) {
                const p = bjPlayers[uid];
                let statusIcon = p.state === 'blackjack' ? "🌟 BLACKJACK!" : p.state === 'busted' ? "💥 QUẮC" : `(${p.value} đ)`;
                text += `👤 **${p.name}** (Cược ${p.bet}k):\n> Bài: [ ${p.hand.join(' ] [ ')} ] ${statusIcon}\n`;
            }
            text += resultText;

            await interaction.update({ content: text, components: [] }).catch(()=>{});
            isBJActive = false; collector.stop();
        };
        return;
    }

    // ----------------- 6. TÍNH NĂNG GAME BẦU CUA -----------------
    if (['bau cua', 'choi bau cua'].some(t => cleanInput.includes(t))) {
        if (isBauCuaActive) { await message.reply("Đang có sòng mở rồi!"); return; }
        isBauCuaActive = true; bauCuaHost = message.author.id; bauCuaBets = {}; bcRound = 1; lastBCResult = "";
        const draftMsg = await message.reply("🎲 **SÒNG BẦU CUA MỞ CỬA!**");
        const collector = draftMsg.createMessageComponentCollector({ time: 1800000 }); 

        const updateBCBoard = async (interaction?: any) => {
            const row0 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                new StringSelectMenuBuilder().setCustomId('bc_bet_size').setPlaceholder('💵 Bấm để chọn mức tiền (Mặc định: 10k)')
                    .addOptions(
                        new StringSelectMenuOptionBuilder().setLabel('10k').setValue('10').setEmoji('🪙'),
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
                new ButtonBuilder().setCustomId('bc_mobat').setLabel('🎲 MỞ BÁT!').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('bc_dongsong').setLabel('🛑 Đóng Sòng').setStyle(ButtonStyle.Danger)
            );

            let betSummary = `📝 **GỬI GẠO VÒNG ${bcRound}:**\n`;
            if (Object.keys(bauCuaBets).length === 0) betSummary += "*Chưa ai xuống tiền...*";
            else {
                for (const uid in bauCuaBets) {
                    const ub = bauCuaBets[uid];
                    const summary = ub.reduce((acc, curr) => { acc[curr.symbol] = (acc[curr.symbol] || 0) + curr.amount; return acc; }, {} as any);
                    const betStrings = Object.entries(summary).map(([sym, amt]) => `${bauCuaEmojis[sym]} ${sym} (**${amt}k**)`);
                    betSummary += `- **${ub[0].name}** *(Ví còn: ${playerBalances[uid]}k)*: ${betStrings.join(', ')}\n`;
                }
            }
            let text = `🎲 **BẦU CUA (Host: <@${bauCuaHost}>) - VÒNG ${bcRound}**\n👉 **LUẬT:** Chọn mức cược dưới ⬇️. **Chỉ được đặt 1 cửa / ván**.\n\n${lastBCResult ? lastBCResult + '\n' : ''}${betSummary}`;
            if (interaction) {
                if (interaction.replied || interaction.deferred) await interaction.editReply({ content: text, components: [row0, row1, row2, row3] }).catch(()=>{});
                else await interaction.update({ content: text, components: [row0, row1, row2, row3] }).catch(()=>{});
            } else await draftMsg.edit({ content: text, components: [row0, row1, row2, row3] }).catch(()=>{});
        };

        collector.on('collect', async (i: any) => {
            const uid = i.user.id; const uname = i.user.displayName || i.user.username;
            if (i.isStringSelectMenu() && i.customId === 'bc_bet_size') {
                currentBetSizes[uid] = parseInt(i.values[0]);
                await i.deferUpdate().catch(()=>{}); return;
            }
            if (!i.isButton()) return;
            if (i.customId === 'bc_dongsong') {
                if (uid !== bauCuaHost) return;
                isBauCuaActive = false; collector.stop();
                await i.update({ content: `🛑 **SÒNG ĐÓNG!**`, components: [] }).catch(()=>{}); return;
            }
            if (i.customId === 'bc_mobat') {
                if (uid !== bauCuaHost) return;
                await i.update({ content: "🎲 **ĐANG XÓC...**", components: [] }).catch(()=>{});
                for(let step = 0; step < 4; step++) {
                    const t = [pickRandom(bauCuaSymbols), pickRandom(bauCuaSymbols), pickRandom(bauCuaSymbols)];
                    const box = `\`\`\`\n╔══════════════════════════════╗\n║    [ ${bauCuaEmojis[t[0]]} ]    [ ${bauCuaEmojis[t[1]]} ]    [ ${bauCuaEmojis[t[2]]} ]    ║\n╚══════════════════════════════╝\n\`\`\``;
                    await i.editReply({ content: `🎲 **CHỦ SÒNG ĐANG XÓC...**\n${box}`, components: [] }).catch(()=>{});
                    await sleep(400);
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
                    if(w>l) lastBCResult += `🤑 **${bauCuaBets[pId][0].name}** ăn lãi **${w}k**\n`;
                    else if (l>w) lastBCResult += `💸 **${bauCuaBets[pId][0].name}** thua **${l}k**\n`;
                }
                bauCuaBets = {}; bcRound++; await updateBCBoard(i); return;
            }
            if (i.customId.startsWith('bc_')) {
                const sym = i.customId.split('_')[1];
                checkAndInitWallet(uid);
                if (bauCuaBets[uid] && bauCuaBets[uid].length >= 1) { await i.reply({ content: "Đã cược rồi, chờ mở bát!", ephemeral: true }); return; }
                const bAmt = currentBetSizes[uid] || 10;
                if (playerBalances[uid] < bAmt) { await i.reply({ content: `Ví mày còn có ${playerBalances[uid]}k mà đòi cược ${bAmt}k!`, ephemeral: true }); return; }
                
                playerBalances[uid] -= bAmt; 
                if (!bauCuaBets[uid]) bauCuaBets[uid] = []; 
                bauCuaBets[uid].push({ name: uname, symbol: sym, amount: bAmt });
                await updateBCBoard(i);
            }
        });
        await updateBCBoard(); return;
    }

    // ----------------- 7. TÍNH NĂNG PICK TƯỚNG VALORANT -----------------
    if (['quay tuong', 'chon tuong', 'random tuong', 'pick tuong'].some(t => cleanInput.includes(t))) {
        if (isDrafting) { await message.reply("Đang pick dở kìa mày!"); return; }
        isDrafting = true; currentDraft = [];
        agentPool = {
            "Duelist": [...fullAgentsByRole["Duelist"]], "Initiator": [...fullAgentsByRole["Initiator"]],
            "Controller": [...fullAgentsByRole["Controller"]], "Sentinel": [...fullAgentsByRole["Sentinel"]]
        };
        const draftMsg = await message.reply("🎲 **Bắt đầu Draft Team Valorant!**");
        const collector = draftMsg.createMessageComponentCollector({ time: 300000 }); 

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
            if (!i.isButton()) return;
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

    // ----------------- 8. TÍNH NĂNG CHAT GEMINI -----------------
    await sleep(2000);
    try {
        if ('sendTyping' in message.channel) await (message.channel as any).sendTyping();
        const model = genAI.getGenerativeModel({ 
            model: "gemini-3.1-flash-lite",
            systemInstruction: `Bạn là BotToan, trợ lý "bựa", dùng từ lóng, xưng hô mày-tao. Cực gắt, không xúc phạm. Dưới 900 ký tự. Không gửi link.`
        });
        const result = await model.generateContent(rawInput); 
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
