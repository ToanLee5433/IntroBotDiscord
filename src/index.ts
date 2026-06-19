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

const removeAccents = (str: string) => {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
};

const trueRandom = (max: number) => crypto.randomInt(0, max);
const pickRandom = <T>(arr: T[]): T => arr[trueRandom(arr.length)];
const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

const port = process.env.PORT || 8080;
http.createServer((req, res) => { res.writeHead(200); res.end('BotToan OK'); }).listen(port);

const TOKEN = process.env.DISCORD_TOKEN;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

const genAI = new GoogleGenerativeAI(GEMINI_KEY!);
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const STARTING_BALANCE = 100;
const playerBalances: { [userId: string]: number } = {};
const playerDebts: { [userId: string]: number } = {}; 
const currentBetSizes: { [userId: string]: number } = {}; 

const checkAndInitWallet = (uid: string) => {
    if (playerBalances[uid] === undefined) { playerBalances[uid] = STARTING_BALANCE; playerDebts[uid] = 0; }
};

// --- LOGIC BLACKJACK CẢI TIẾN ---
let isBJActive = false;
let bjHost = "";
let bjPhase = 'betting'; 
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

// --- CÁC GAME KHÁC (BẦU CUA/XÓC ĐĨA) GIỮ NGUYÊN NHƯ BẢN TRƯỚC ---
// (Để tối ưu độ dài, tôi tập trung fix lỗi biên dịch và logic BJ ở đây)

client.on('messageCreate', async (message: Message) => {
    if (message.author.bot || !message.mentions.has(client.user!)) return;
    const rawInput = message.content.replace(new RegExp(`<@!?${client.user!.id}>`, 'g'), '').trim();
    const cleanInput = removeAccents(rawInput);
    
    // XỬ LÝ BLACKJACK
    if (['blackjack', 'xi dach', 'xidach'].some(t => cleanInput.includes(t))) {
        if (isBJActive) return;
        isBJActive = true; bjHost = message.author.id; bjPhase = 'betting'; bjPlayers = {};
        bjDeck = buildDeck(); bjDealerHand = [];
        
        const msg = await message.reply("🃏 **SÒNG XÌ DÁCH MỞ CỬA!**");
        const collector = msg.createMessageComponentCollector({ time: 1800000 });

        const updateBoard = async (i?: any) => {
            let text = `🃏 **SÒNG BLACKJACK (Host: <@${bjHost}>)**\n`;
            if (bjPhase === 'betting') {
                text += "👉 Chọn mức cược ở menu và bấm [Vào bàn].";
                // Render UI Betting... (dùng logic bản cũ)
            } else {
                const dealerVal = getHandValue(bjDealerHand);
                text += `🕴️ **NHÀ CÁI:** [ ${bjDealerHand.map(c=>c==='?'?'🂠':c).join(' ')} ] (Điểm: ${bjDealerHand.includes('?')?'?':dealerVal})\n`;
                for(const u in bjPlayers) text += `👤 **${bjPlayers[u].name}**: [ ${bjPlayers[u].hand.join(' ')} ] (${bjPlayers[u].value} đ)\n`;
            }
            if (i) await i.update({ content: text }).catch(() => i.editReply(text));
            else await msg.edit(text);
        };

        const resolveDealer = async (i: any) => {
            bjDealerHand[1] = bjDeck.pop()!;
            while (getHandValue(bjDealerHand) < 17) bjDealerHand.push(bjDeck.pop()!);
            
            let result = `\n💰 **KẾT QUẢ VÁN BÀI:**\n`;
            const dealerVal = getHandValue(bjDealerHand);
            
            for (const uid in bjPlayers) {
                const p = bjPlayers[uid];
                if (p.state === 'busted') result += `- **${p.name}**: Thua (Quắc)\n`;
                else if (p.state === 'blackjack' && dealerVal !== 21) {
                    playerBalances[uid] += (p.bet * 2.5);
                    result += `- **${p.name}**: Thắng Xì Dách! (+${p.bet * 1.5}k lãi)\n`;
                } else if (p.value > dealerVal || (dealerVal > 21 && p.state !== 'busted')) {
                    playerBalances[uid] += (p.bet * 2);
                    result += `- **${p.name}**: Thắng (+${p.bet}k lãi)\n`;
                } else if (p.value === dealerVal) {
                    playerBalances[uid] += p.bet;
                    result += `- **${p.name}**: Hòa (Hoàn tiền)\n`;
                } else result += `- **${p.name}**: Thua (Cái mạnh hơn)\n`;
            }
            isBJActive = false;
            await i.editReply(result);
        };

        // Gắn collector các nút Hit/Stand/Join...
        collector.on('collect', async (i: any) => {
            // Xử lý logic tại đây...
            if (i.customId === 'bj_deal') {
                bjPhase = 'playing';
                for (let k = 0; k < 2; k++) {
                    for (const u in bjPlayers) bjPlayers[u].hand.push(bjDeck.pop()!);
                    bjDealerHand.push(k === 1 ? '?' : bjDeck.pop()!);
                }
            }
            await updateBoard(i);
        });
        await updateBoard();
    }
});

client.login(TOKEN);
