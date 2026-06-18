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
const STARTING_BALANCE = 100; // Thay đổi số này để chỉnh tiền mặc định cho cả làng

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
let bcPlayers = new Set<string>();

// ================= BIẾN TRẠNG THÁI XÓC ĐĨA =================
let isXocDiaActive = false;
let xdHost = "";
let xdBets: { [userId: string]: { name: string, type: string, label: string, amount: number }[] } = {};
let xdRound = 1;
let lastXDResult = "";
let xdPlayers = new Set<string>();

// ================= BIẾN TRẠNG THÁI BLACKJACK =================
let isBJActive = false;
let bjHost = "";
let bjPhase = 'betting'; // betting -> playing -> ended
let bjDeck: string[] = [];
let bjDealerHand: string[] = [];
let bjPlayers: { [uid: string]: { name: string, bet: number, hand: string[], state: 'playing'|'stood'|'busted'|'blackjack', value: number } } = {};

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
    const deck = [];
    for (const suit of suits) {
        for (const rank of ranks) deck.push(rank + suit);
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
        await message.reply(`🏦 **NGÂN HÀNG BOTTOAN GIẢI NGÂN:**\nBơm thêm **${STARTING_BALANCE}k** vào ví. Mày đang nợ tao tổng **${playerDebts[uid]}k**. Gỡ lẹ đi!`);
        return;
    }

    // ----------------- 3. TÍNH NĂNG ĐIỂM DANH TÀI SẢN -----------------
    if (['tai san', 'vi tien', 'check tien', 'bop tien'].some(t => cleanInput.includes(t))) {
        const voiceChannel = message.member?.voice.channel;
        let outputText = "💰 **BẢNG PHONG THẦN TÀI SẢN CON BẠC** 💰\n\n";

        if (voiceChannel) {
            outputText += `👥 **Đang quét những con giời trong phòng thoại <#${voiceChannel.id}>:**\n`;
            voiceChannel.members.forEach(member => {
                if (member.user.bot) return; 
                const uid = member.id;
                checkAndInitWallet(uid);
                
                const bal = playerBalances[uid];
                const debt = playerDebts[uid] || 0;
                outputText += `- **${member.displayName}**: Số dư: **${bal}k** | Nợ ngân hàng: **${debt}k**\n`;
            });
            outputText += "\n*👉 Đứa nào nợ nhiều lo mà cày cuốc trả nợ cho tao đi nhé!*";
        } else {
            outputText += `🌍 **Danh sách tổng hợp toàn bộ con bạc trong server:**\n`;
            const allUsers = Object.keys(playerBalances);
            
            if (allUsers.length === 0) {
                outputText += "*Sòng bạc trống vắng, chưa có mống nào mở ví khởi nghiệp cả!*";
            } else {
                allUsers.forEach(uid => {
                    const member = message.guild?.members.cache.get(uid);
                    const name = member ? member.displayName : `<@${uid}>`;
                    const bal = playerBalances[uid];
                    const debt = playerDebts[uid] || 0;
                    outputText += `- **${name}**: Số dư: **${bal}k** | Nợ: **${debt}k**\n`;
                });
            }
            outputText += "\n*💡 Mẹo: Chui vào phòng voice chung với tụi nó rồi gọi tao để quét chuẩn phòng thoại đó luôn!*";
        }

        await message.reply(outputText);
        return;
    }

    // ----------------- 4. TÍNH NĂNG BLACKJACK (XÌ DÁCH) -----------------
    if (['blackjack', 'xi dach', 'xidach', 'choi blackjack'].some(t => cleanInput.includes(t))) {
        if (isBJActive) {
            await message.reply("Đang có sòng Blackjack mở rồi, vào đó mà theo đi con bạc!");
            return;
        }
        isBJActive = true;
        bjHost = message.author.id;
        bjPhase = 'betting';
        bjPlayers = {};
        bjDeck = buildDeck();
        bjDealerHand = [];

        const draftMsg = await message.reply("🃏 **SÒNG BLACKJACK (XÌ DÁCH) MỞ CỬA!**\nChỉnh mức cược và bấm [Vào bàn] để giữ chỗ. Host bấm Chia bài khi đã đủ tụ!");
        const collector = draftMsg.createMessageComponentCollector({ time: 1800000 }); 

        const updateBJBoard = async (interaction?: any) => {
            let components: any[] = [];
            let text = `🃏 **SÒNG BLACKJACK (Host: <@${bjHost}>)** 🃏\n`;

            if (bjPhase === 'betting') {
                const row0 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('bj_bet_size')
                        .setPlaceholder('💵 Bấm để chọn mức tiền (Mặc định: 10k)')
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

                text += `👉 **Giai đoạn: Đặt cược.** Mỗi người đặt 1 lần.\n\n📝 **Danh sách đã xuống tiền:**\n`;
                if (Object.keys(bjPlayers).length === 0) text += "*Chưa ai vào bàn...*";
                else {
                    for (const uid in bjPlayers) {
                        text += `- **${bjPlayers[uid].name}**: Đã cược **${bjPlayers[uid].bet}k**\n`;
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
                    text += `👉 **Giai đoạn: Kéo bài.** Bấm Rút hoặc Dừng!\n\n`;
                } else {
                    components = [];
                    text += `🔥 **KẾT QUẢ VÁN BÀI:**\n\n`;
                }

                // Show Dealer
                const dealerVal = getHandValue(bjDealerHand);
                text += `🕴️ **NHÀ CÁI:** [ ${bjDealerHand.join(' ] [ ')} ] (Điểm: ${bjDealerHand.includes('?') ? '?' : dealerVal})\n`;
                text += `--------------------------\n`;
                
                // Show Players
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

            if (i.isStringSelectMenu() && i.customId === 'bj_bet_size') {
                const amount = parseInt(i.values[0]);
                currentBetSizes[uid] = amount;
                await i.reply({ content: `💸 Mày đã chỉnh mức cược thành **${amount}k**. Bấm [Vào Bàn] để chốt!`, ephemeral: true }).catch(()=>{});
                return;
            }

            if (!i.isButton()) return;

            if (i.customId === 'bj_close') {
                if (uid !== bjHost) return;
                // Hoàn tiền nếu đóng lúc đang cược
                if (bjPhase === 'betting') {
                    for (const pId in bjPlayers) playerBalances[pId] += bjPlayers[pId].bet;
                }
                isBJActive = false; collector.stop();
                await i.update({ content: `🛑 **SÒNG ĐÃ GIẢI TÁN!** Đã hoàn tiền cho anh em.`, components: [] }).catch(()=>{}); return;
            }

            if (i.customId === 'bj_join') {
                if (bjPhase !== 'betting') return;
                checkAndInitWallet(uid);
                if (bjPlayers[uid]) { await i.reply({ content: "Mày đã vào bàn rồi, ngồi yên chờ chia bài đi!", ephemeral: true }); return; }
                
                const betAmount = currentBetSizes[uid] || 10;
                if (playerBalances[uid] < betAmount) { await i.reply({ content: `Mày không đủ **${betAmount}k**!`, ephemeral: true }); return; }

                playerBalances[uid] -= betAmount;
                bjPlayers[uid] = { name: uname, bet: betAmount, hand: [], state: 'playing', value: 0 };
                await updateBJBoard(i);
            }

            if (i.customId === 'bj_deal') {
                if (uid !== bjHost || bjPhase !== 'betting') return;
                if (Object.keys(bjPlayers).length === 0) { await i.reply({ content: "Chưa có mống nào vào bàn, chia cho ma à?", ephemeral: true }); return; }
                
                bjPhase = 'playing';
                
                // Chia 2 lá cho mỗi người
                for (let c = 0; c < 2; c++) {
                    for (const pId in bjPlayers) bjPlayers[pId].hand.push(bjDeck.pop()!);
                    bjDealerHand.push(c === 1 ? '?' : bjDeck.pop()!); // Lá thứ 2 của cái úp
                }

                // Check Blackjack ngay vòng đầu
                let allDone = true;
                for (const pId in bjPlayers) {
                    bjPlayers[pId].value = getHandValue(bjPlayers[pId].hand);
                    if (bjPlayers[pId].value === 21) bjPlayers[pId].state = 'blackjack';
                    else allDone = false;
                }

                if (allDone) {
                    bjPhase = 'ended';
                    await resolveDealerTurn(i);
                } else {
                    await updateBJBoard(i);
                }
            }

            if (i.customId === 'bj_hit' || i.customId === 'bj_stand') {
                if (bjPhase !== 'playing' || !bjPlayers[uid] || bjPlayers[uid].state !== 'playing') {
                    await i.reply({ content: "Chưa tới lượt mày hoặc mày đã xong rồi, bấm cái gì?", ephemeral: true }); return;
                }

                if (i.customId === 'bj_hit') {
                    bjPlayers[uid].hand.push(bjDeck.pop()!);
                    bjPlayers[uid].value = getHandValue(bjPlayers[uid].hand);
                    if (bjPlayers[uid].value > 21) bjPlayers[uid].state = 'busted';
                    else if (bjPlayers[uid].value === 21) bjPlayers[uid].state = 'stood';
                } else {
                    bjPlayers[uid].state = 'stood';
                }

                // Kiểm tra xem tất cả đã xong chưa
                const allDone = Object.values(bjPlayers).every(p => p.state !== 'playing');
                if (allDone) {
                    bjPhase = 'ended';
                    await resolveDealerTurn(i);
                } else {
                    await updateBJBoard(i);
                }
            }
        });

        const resolveDealerTurn = async (interaction: any) => {
            // Lật lá bài ẩn của nhà cái
            bjDealerHand[1] = bjDeck.pop()!; // Thay lá '?' bằng lá thật từ bộ bài
            
            // Nhà cái rút nếu dưới 17
            while (getHandValue(bjDealerHand) < 17) {
                bjDealerHand.push(bjDeck.pop()!);
            }
            const dealerVal = getHandValue(bjDealerHand);
            const dealerBust = dealerVal > 21;
            const dealerBJ = dealerVal === 21 && bjDealerHand.length === 2;

            // Tính tiền
            let resultText = `\n💰 **TỔNG KẾT TRẢ THƯỞNG:**\n`;
            for (const pId in bjPlayers) {
                const p = bjPlayers[pId];
                let wonAmt = 0;
                let status = "";

                if (p.state === 'busted') {
                    status = `💸 Thua (Quắc) - Mất ${p.bet}k`;
                } else if (p.state === 'blackjack') {
                    if (dealerBJ) {
                        playerBalances[pId] += p.bet; // Hòa
                        status = `⚖️ Hòa (Cái cũng Blackjack) - Hoàn ${p.bet}k`;
                    } else {
                        wonAmt = p.bet * 2.5; // Ăn 1.5 lần (Trả lại gốc 1 + Lãi 1.5)
                        playerBalances[pId] += wonAmt;
                        status = `🤑 Xì Dách! Ăn ${(p.bet * 1.5)}k`;
                    }
                } else {
                    // Trạng thái stood (đã dừng)
                    if (dealerBust) {
                        wonAmt = p.bet * 2;
                        playerBalances[pId] += wonAmt;
                        status = `🤑 Thắng (Cái Quắc) - Ăn ${p.bet}k`;
                    } else if (p.value > dealerVal) {
                        wonAmt = p.bet * 2;
                        playerBalances[pId] += wonAmt;
                        status = `🤑 Thắng điểm - Ăn ${p.bet}k`;
                    } else if (p.value === dealerVal) {
                        playerBalances[pId] += p.bet;
                        status = `⚖️ Hòa điểm - Hoàn ${p.bet}k`;
                    } else {
                        status = `💸 Thua điểm - Mất ${p.bet}k`;
                    }
                }
                resultText += `- **${p.name}**: ${status} (Ví: ${playerBalances[pId]}k)\n`;
            }

            // Mượn hàm update để in ra kết quả
            await updateBJBoard(interaction);
            
            // Gửi thêm tin nhắn kết quả để sòng đóng
            isBJActive = false;
            collector.stop();
            await draftMsg.reply({ content: resultText });
        };

        return;
    }

    // ----------------- 5. TÍNH NĂNG XÓC ĐĨA -----------------
    if (['xoc dia', 'choi xoc dia'].some(t => cleanInput.includes(t))) {
        if (isXocDiaActive) { await message.reply("Đang có sòng Xóc Đĩa rồi!"); return; }
        isXocDiaActive = true; xdHost = message.author.id; xdBets = {}; xdRound = 1; lastXDResult = ""; xdPlayers.clear();
        const draftMsg = await message.reply("⛩️ **SÒNG XÓC ĐĨA TRUYỀN THỐNG MỞ CỬA!**");
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
                new ButtonBuilder().setCustomId('xd_4do').setLabel('🔴🔴🔴🔴 (1 ăn 12)').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('xd_4trang').setLabel('⚪⚪⚪⚪ (1 ăn 12)').setStyle(ButtonStyle.Secondary)
            );
            const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('xd_3do1trang').setLabel('🔴🔴🔴⚪ (1 ăn 2.6)').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('xd_3trang1do').setLabel('⚪⚪⚪🔴 (1 ăn 2.6)').setStyle(ButtonStyle.Primary)
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
                    betSummary += `- **${ub[0].name}**: ${betStrings.join(', ')}\n`;
                }
            }
            let text = `⛩️ **SÒNG XÓC ĐĨA (Host: <@${xdHost}>) - VÒNG ${xdRound}**\n👉 **LUẬT:** Chọn mức cược dưới ⬇️. **Chỉ được đặt 1 cửa / ván**.\n\n${lastXDResult ? lastXDResult + '\n' : ''}${betSummary}`;
            if (interaction) {
                if (interaction.replied || interaction.deferred) await interaction.editReply({ content: text, components: [row0, row1, row2, row3, row4] }).catch(()=>{});
                else await interaction.update({ content: text, components: [row0, row1, row2, row3, row4] }).catch(()=>{});
            } else await draftMsg.edit({ content: text, components: [row0, row1, row2, row3, row4] }).catch(()=>{});
        };

        collector.on('collect', async (i: any) => {
            const uid = i.user.id; const uname = i.user.displayName || i.user.username;
            if (i.isStringSelectMenu() && i.customId === 'xd_bet_size') {
                const amount = parseInt(i.values[0]); currentBetSizes[uid] = amount;
                await i.reply({ content: `💸 Chỉnh phỉnh cược thành **${amount}k**. Chọn cửa đi!`, ephemeral: true }).catch(()=>{}); return;
            }
            if (!i.isButton()) return;
            if (i.customId === 'xd_dongsong') {
                if (uid !== xdHost) return;
                isXocDiaActive = false; collector.stop();
                await i.update({ content: `🛑 **SÒNG XÓC ĐĨA ĐÓNG CỬA!**`, components: [] }).catch(()=>{}); return;
            }
            if (i.customId === 'xd_mobat') {
                if (uid !== xdHost) return;
                await i.update({ content: "⛩️ **CHỦ SÒNG ĐANG XÓC...**", components: [] }).catch(()=>{});
                for (let step = 0; step < 6; step++) {
                    await i.editReply({ content: `⛩️ **ĐANG XÓC ĐĨA...**\n\`\`\`text\n       _______ \n     /         \\ \n    | LẠCH CẠCH |\n     \\_________/ \n\`\`\``, components: [] }).catch(()=>{});
                    await sleep(400);
                }
                let reds = 0, whites = 0, coins = [];
                for(let c=0; c<4; c++) { if (trueRandom(2) === 0) { reds++; coins.push('🔴'); } else { whites++; coins.push('⚪'); } }
                let isChan = (reds === 0 || reds === 2 || reds === 4);
                lastXDResult = `🔥 **KẾT QUẢ: ${isChan ? "🔴 CHẴN" : "⚪ LẺ"} (${reds} Đỏ - ${whites} Trắng)**\n\`\`\`text\n      ${coins[0]}   ${coins[1]}\n      ${coins[2]}   ${coins[3]}\n\`\`\`\n`;
                for (const pId in xdBets) {
                    let w=0, l=0;
                    xdBets[pId].forEach(b => {
                        let mul = 0;
                        if (b.type === 'chan' && isChan) mul = 1; else if (b.type === 'le' && !isChan) mul = 1;
                        else if (b.type === '4do' && reds === 4) mul = 12; else if (b.type === '4trang' && whites === 4) mul = 12;
                        else if (b.type === '3do1trang' && reds === 3) mul = 2.6; else if (b.type === '3trang1do' && whites === 3) mul = 2.6;
                        if (mul > 0) { playerBalances[pId] += b.amount + (b.amount * mul); w += b.amount * mul; } else l += b.amount;
                    });
                    if (w>l) lastXDResult += `🤑 **${xdBets[pId][0].name}** ăn **${w-l}k**\n`; else if (l>w) lastXDResult += `💸 **${xdBets[pId][0].name}** cháy **${l-w}k**\n`;
                }
                xdBets = {}; xdRound++; await updateXDBoard(i); return;
            }
            if (i.customId.startsWith('xd_')) {
                const bType = i.customId.split('_')[1]; let lbl = bType.toUpperCase();
                checkAndInitWallet(uid);
                if (xdBets[uid] && xdBets[uid].length >= 1) { await i.reply({ content: "Đã cược rồi, chờ mở bát!", ephemeral: true }); return; }
                const bAmt = currentBetSizes[uid] || 10;
                if (playerBalances[uid] < bAmt) { await i.reply({ content: `Không đủ ${bAmt}k!`, ephemeral: true }); return; }
                playerBalances[uid] -= bAmt; xdPlayers.add(uid);
                if (!xdBets[uid]) xdBets[uid] = []; xdBets[uid].push({ name: uname, type: bType, label: lbl, amount: bAmt });
                await updateXDBoard(i);
            }
        });
        await updateXDBoard(); return;
    }

    // ----------------- 6. TÍNH NĂNG GAME BẦU CUA -----------------
    if (['bau cua', 'choi bau cua'].some(t => cleanInput.includes(t))) {
        if (isBauCuaActive) { await message.reply("Đang có sòng mở rồi!"); return; }
        isBauCuaActive = true; bauCuaHost = message.author.id; bauCuaBets = {}; bcRound = 1; lastBCResult = ""; bcPlayers.clear();
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
                    betSummary += `- **${ub[0].name}**: ${betStrings.join(', ')}\n`;
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
                const amount = parseInt(i.values[0]); currentBetSizes[uid] = amount;
                await i.reply({ content: `💸 Chỉnh phỉnh cược thành **${amount}k**. Chọn cửa đi!`, ephemeral: true }).catch(()=>{}); return;
            }
            if (!i.isButton()) return;
            if (i.customId === 'bc_dongsong') {
                if (uid !== bauCuaHost) return;
                isBauCuaActive = false; collector.stop();
                await i.update({ content: `🛑 **SÒNG ĐÓNG!**`, components: [] }).catch(()=>{}); return;
            }
            if (i.customId === 'bc_mobat') {
                if (uid !== bauCuaHost) return;
                await i.update({ content: "🎲 **ĐANG LẮC...**", components: [] }).catch(()=>{});
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
                    if(w>l) lastBCResult += `🤑 **${bauCuaBets[pId][0].name}** ăn **${w-l}k**\n`;
                    else if (l>w) lastBCResult += `💸 **${bauCuaBets[pId][0].name}** thua **${l-w}k**\n`;
                }
                bauCuaBets = {}; bcRound++; await updateBCBoard(i); return;
            }
            if (i.customId.startsWith('bc_')) {
                const sym = i.customId.split('_')[1];
                checkAndInitWallet(uid);
                if (bauCuaBets[uid] && bauCuaBets[uid].length >= 1) { await i.reply({ content: "Đã cược rồi, chờ mở bát!", ephemeral: true }); return; }
                const bAmt = currentBetSizes[uid] || 10;
                if (playerBalances[uid] < bAmt) { await i.reply({ content: `Không đủ ${bAmt}k!`, ephemeral: true }); return; }
                playerBalances[uid] -= bAmt; bcPlayers.add(uid);
                if (!bauCuaBets[uid]) bauCuaBets[uid] = []; bauCuaBets[uid].push({ name: uname, symbol: sym, amount: bAmt });
                await updateBCBoard(i);
            }
        });
        await updateBCBoard(); return;
    }

    // ----------------- 7. TÍNH NĂNG CHAT GEMINI -----------------
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
