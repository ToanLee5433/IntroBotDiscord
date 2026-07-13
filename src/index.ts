import { 
    Client, GatewayIntentBits, VoiceState, Message, EmbedBuilder, PermissionFlagsBits,
    ActionRowBuilder, ButtonBuilder, ButtonStyle
} from 'discord.js';
import { 
    joinVoiceChannel, createAudioPlayer, createAudioResource, 
    AudioPlayerStatus, VoiceConnectionStatus, entersState, getVoiceConnection
} from '@discordjs/voice';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';

import { PORT, TOKEN, loadAgentIcons } from './config';
import { playBauCua } from './games/baucua';
import { playValorantDraft, registerValorantCollector } from './games/valorant';
import { playXocDia } from './games/xocdia';
import { playBlackjack } from './games/blackjack';
import { playTaiXiu } from './games/taixiu';
import { handleLixi } from './games/lixi';
import { playRussianRoulette } from './games/russianroulette';
import { playPokerRoulette } from './games/pokerroulette';
import { chatWithGemini, analyzeImageWithGemini, generateImageWithImagen, editImageWithImagen, checkImageQuota } from './services/gemini';
import { AttachmentBuilder } from 'discord.js';
import { fetchValorantRank } from './services/valorant';
import { handleProfileRegistration, handleCrushCommand, playMatchmaking, handleDetectiveServices, handleBuaYeu, handleGieoQue } from './games/ghepdoi';
import { initTarot, handleTarot } from './games/tarot';
import { handleAura, handleAnonymousLetter, handleMoodDiary, handleCheckDM, handleOverthink, handleChotDon, handleDailyAesthetic } from './games/femfeatures';
import { handleMyGuQuiz, handleDoanMyGu, registerMyGuCollector } from './games/mygu';
import { handleGamingCourt } from './games/gamingcourt';
import { handleWCPrediction, playWCPenalty, handleWCCommand, registerWorldCupCollector } from './games/worldcup';
import { handleAvatarCommand, registerAvatarCollector } from './commands/avatar';
import { registerWelcomeEvent } from './events/welcome';
import { handleWarmupCommand, loadWarmupVideosCache } from './commands/warmup';


import cron from 'node-cron';
import { sleep, removeAccents, formatMoney, parseMoneyInput, activeGamePlayers, sendToJail, trueRandom } from './utils';
import { connectDB, claimDaily, getLeaderboard, transferMoney, borrowMoney, getBalancesAndDebts, getAllBalancesAndDebts, payDebt, registerValorantId, getValorantId, getChatBanExpires, dodgeDebt, banChat, buyLotteryTicket, getLotteryInfo, drawLottery, getLastLotteryDraw, getSnitchCooldown, updateSnitchDate, getBalance, updateBalance, getSimpLoExpires, setSimpLo, getVNDateString, getLotteryTicketsForDate, getLotteryState } from './database';



// 1. GHI ĐÈ CONSOLE ĐỂ THU THẬP LOGS CHẨN ĐOÁN (MIỄN PHÍ)
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

export const systemLogs: string[] = [];

function addSystemLog(type: 'INFO' | 'WARN' | 'ERROR', args: any[]) {
    // Thời gian định dạng Việt Nam UTC+7
    const timeStr = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
    const message = args.map(arg => {
        if (arg instanceof Error) {
            return arg.stack || arg.message;
        }
        if (typeof arg === 'object') {
            try {
                return JSON.stringify(arg);
            } catch (e) {
                return String(arg);
            }
        }
        return String(arg);
    }).join(' ');
    
    systemLogs.push(`[${timeStr}] [${type}] ${message}`);
    if (systemLogs.length > 500) {
        systemLogs.shift(); // Giới hạn 500 dòng để tránh tràn bộ nhớ
    }
}

console.log = (...args: any[]) => {
    addSystemLog('INFO', args);
    originalLog(...args);
};

console.error = (...args: any[]) => {
    addSystemLog('ERROR', args);
    originalError(...args);
};

console.warn = (...args: any[]) => {
    addSystemLog('WARN', args);
    originalWarn(...args);
};

// 2. MÁY CHỦ WEB ẢO LÁCH LUẬT RENDER & PHỤC VỤ LOGS TRỰC TIẾP
http.createServer((req, res) => {
    const url = req.url || '';
    if (url === '/logs' || url === '/debug') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        
        const logHtml = systemLogs.map(line => {
            let color = '#ffffff';
            if (line.includes('[ERROR]')) color = '#ff4d4d';
            else if (line.includes('[WARN]')) color = '#ffcc00';
            else if (line.includes('✅') || line.includes('thành công') || line.includes('thành công!')) color = '#4dff4d';
            else if (line.includes('[DISCORD DEBUG]')) color = '#a0a0ff';
            else if (line.includes('[DISCORD CHẨN ĐOÁN]')) color = '#ff80df';
            return `<div style="color: ${color}; font-family: 'Courier New', Courier, monospace; margin-bottom: 5px; white-space: pre-wrap; font-size: 13px; line-height: 1.4;">${line}</div>`;
        }).join('');
        
        res.write(`
            <html>
                <head>
                    <title>BotToan Logs Panel</title>
                    <meta http-equiv="refresh" content="8">
                    <style>
                        body { background: #121212; color: #e0e0e0; padding: 25px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; }
                        h1 { color: #9b59b6; margin-top: 0; margin-bottom: 5px; font-size: 24px; }
                        .subtitle { color: #888; font-size: 13px; margin-bottom: 20px; }
                        .log-container { background: #1a1a1a; border: 1px solid #2d2d2d; padding: 15px; border-radius: 6px; height: 80vh; overflow-y: auto; box-shadow: inset 0 0 10px rgba(0,0,0,0.5); }
                        .refresh-btn { background: #9b59b6; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 13px; float: right; }
                        .refresh-btn:hover { background: #8e44ad; }
                    </style>
                </head>
                <body>
                    <button class="refresh-btn" onclick="window.location.reload()">F5 Làm Mới</button>
                    <h1>📊 Bảng Điều Khiển Logs - BotToan</h1>
                    <div class="subtitle">Tự động cập nhật sau mỗi 8 giây. Thiết lập xem logs độc lập không mất phí.</div>
                    <div class="log-container">
                        ${logHtml || '<div style="color: #666; font-style: italic;">Chưa có dữ liệu log phát sinh...</div>'}
                    </div>
                    <script>
                        // Tự động cuộn xuống đáy log khi tải trang
                        const container = document.querySelector('.log-container');
                        container.scrollTop = container.scrollHeight;
                    </script>
                </body>
            </html>
        `);
        res.end();
    } else if (url === '/test-net') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.write('<h2>🔍 Đang kiểm tra kết nối mạng từ Hugging Face...</h2>');
        
        (async () => {
            const targets = [
                { name: 'Google (Tổng quát)', url: 'https://www.google.com' },
                { name: 'Valorant API', url: 'https://valorant-api.com/v1/agents' },
                { name: 'Discord API Gateway (REST)', url: 'https://discord.com/api/v10/gateway' },
                { name: 'Discord Gateway (WebSocket)', url: 'https://gateway.discord.gg' }
            ];
            
            for (const target of targets) {
                const start = Date.now();
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 8000);
                    const response = await fetch(target.url, { signal: controller.signal });
                    clearTimeout(timeoutId);
                    const duration = Date.now() - start;
                    res.write(`<p>✅ <b>${target.name}</b>: Kết nối thành công! Code: ${response.status} (${duration}ms)</p>`);
                } catch (err: any) {
                    const duration = Date.now() - start;
                    res.write(`<p>❌ <b>${target.name}</b>: Thất bại sau ${duration}ms! Lỗi: ${err.message || err}</p>`);
                }
            }
            res.write('<p><b>Hoàn tất kiểm tra mạng!</b> Nếu Google và Valorant thành công nhưng Discord thất bại, chắc chắn IP của Hugging Face đã bị Discord chặn.</p>');
            res.write('<p><a href="/logs">Quay lại trang Logs</a></p>');
            res.end();
        })();
        return;
    } else {
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
        const logsUrl = `${protocol}://${host}/logs`;
        const testNetUrl = `${protocol}://${host}/test-net`;
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.write(`
            <html>
                <head>
                    <title>BotToan Status</title>
                    <style>
                        body { background: #121212; color: #e0e0e0; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; text-align: center; }
                        h1 { color: #2ecc71; margin-bottom: 10px; font-size: 28px; }
                        p { font-size: 15px; color: #aaa; margin-bottom: 20px; }
                        a { color: #9b59b6; text-decoration: none; font-weight: bold; font-size: 16px; border: 2px solid #9b59b6; padding: 12px 24px; border-radius: 6px; transition: all 0.3s; display: inline-block; margin: 5px; }
                        a:hover { background: #9b59b6; color: #fff; box-shadow: 0 0 15px rgba(155, 89, 182, 0.4); }
                        .test-btn { color: #3498db; border-color: #3498db; }
                        .test-btn:hover { background: #3498db; box-shadow: 0 0 15px rgba(52, 152, 219, 0.4); }
                        .url-box { background: #1a1a1a; padding: 12px 20px; border-radius: 6px; font-family: 'Courier New', Courier, monospace; font-size: 13px; margin-top: 15px; border: 1px solid #2d2d2d; word-break: break-all; max-width: 90%; color: #f1c40f; }
                    </style>
                </head>
                <body>
                    <h1>🟢 BotToan đang hoạt động bình thường!</h1>
                    <p>Nhấp vào nút bên dưới hoặc sao chép liên kết trực tiếp để xem nhật ký hoạt động hoặc kiểm tra kết nối mạng:</p>
                    <div>
                        <a href="/logs" target="_blank">🔗 MỞ TRANG NHẬT KÝ (LOGS)</a>
                        <a href="/test-net" class="test-btn" target="_blank">🔍 TEST KẾT NỐI MẠNG</a>
                    </div>
                    <div class="url-box">Đường dẫn trực tiếp Logs: ${logsUrl}</div>
                    <div class="url-box" style="margin-top: 5px;">Đường dẫn Test Mạng: ${testNetUrl}</div>
                </body>
            </html>
        `);
        res.end();
    }
}).listen(PORT, () => {
    console.log(`[WEB] Máy chủ ảo đang chạy trên port ${PORT}`);
});

if (!TOKEN) {
    console.error("[LỖI] Thiếu Discord TOKEN trong cấu hình!");
    process.exit(1);
}

const activeViewers = new Set<string>();
let isDrawing = false;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMembers,
    ]
});

// ================= LẮNG NGHE LỆNH & CHAT =================
client.on('messageCreate', async (message: Message) => {
    if (message.author.bot || !client.user) return;

    // ----------------- TỰ ĐỘNG GIẢI TRỪ NICKNAME SIMP LỎ -----------------
    try {
        const simpLoExpires = await getSimpLoExpires(message.author.id);
        if (simpLoExpires > 0 && Date.now() > simpLoExpires) {
            const member = message.member;
            if (member && member.nickname && member.nickname.includes("[🤡 Simp Lỏ]")) {
                const cleanNick = member.nickname.replace("[🤡 Simp Lỏ]", "").trim();
                await member.setNickname(cleanNick).catch(() => {});
            }
            await setSimpLo(message.author.id, 0);
        }
    } catch (err) {
        console.error("Lỗi giải trừ Nickname Simp Lỏ:", err);
    }

    if (!message.mentions.has(client.user)) return;

    // ----------------- KIỂM TRA CẤM CHAT (BOT LEVEL) -----------------
    const banExpires = await getChatBanExpires(message.author.id);
    if (banExpires > Date.now()) {
        const timeLeftMs = banExpires - Date.now();
        const secondsLeft = Math.ceil(timeLeftMs / 1000);
        
        const trollMessages = [
            `💀 **OÀI CÁI THẰNG MA MỚI NÀY!** Mày vừa bị bắn nát sọ trong sòng bài tử thần rồi, hồn ma bóng quế thì nằm im chịu tội đi! Còn **${secondsLeft} giây** cấm khẩu nữa, đi đầu thai lẹ giùm tao cái!`,
            `🔫 **BÙM!** Ăn kẹo đồng xong vẫn chưa chừa à con? Họng súng vô tình đã tiễn mày lên bảng đếm số. Cấm chat còn **${secondsLeft} giây** nữa, câm mồm vào góc mà suy ngẫm nhân sinh đi!`,
            `👻 **HỒN MA BẢN HỘ MỆNH!** Bị bắn vỡ alo rồi mà vẫn ngoi lên đòi sủa à? BotToan khóa mõm mày thêm **${secondsLeft} giây** nữa cho mát mẻ đầu óc nhé. Biến!`,
            `🤫 **IM MỒM VÀ NÍN!** Mày nghĩ mày là ai mà đòi chat chit lúc này? Đang trong thời gian chịu án phạt **${secondsLeft} giây** nữa mới được hồi sinh nghe chưa cưng. Đi rửa bát giùm cái!`,
            `🤐 **MẤT PHÁT NGÔN!** Tấm vé đi bụi của mày vẫn còn hiệu lực nhé. Còn **${secondsLeft} giây** cấm sủa, lảm nhảm nữa tao đục thêm phát nữa giờ!`
        ];
        
        const randomTroll = trollMessages[Math.floor(Math.random() * trollMessages.length)];
        await message.reply(randomTroll).catch(()=>{});
        return;
    }

    const botId = client.user.id;
    const rawInput = message.content.replace(new RegExp(`<@!?${botId}>`, 'g'), '').trim();
    const cleanInput = removeAccents(rawInput).toLowerCase();
    
    // ----------------- TÍNH NĂNG WARMUP VIDEO -----------------
    const warmupTriggers = ['warmup', 'khoi dong', 'video'];
    if (warmupTriggers.some(t => cleanInput === t || cleanInput.startsWith(t + ' '))) {
        await handleWarmupCommand(message, rawInput, client);
        return;
    }

    // ----------------- TÍNH NĂNG XEM AVATAR -----------------
    const avatarTriggers = ['avatar', 'avt', 'anhdaidien', 'anh dai dien'];
    if (avatarTriggers.some(t => cleanInput.startsWith(t))) {
        await handleAvatarCommand(message, rawInput);
        return;
    }

    // ----------------- TÍNH NĂNG TRỢ GIÚP / MENU LỆNH -----------------
    const helpTriggers = ['help', 'menu', 'tro giup', 'huong dan', 'huongdan', 'lenh'];
    if (helpTriggers.some(t => cleanInput === t)) {
        await handleHelpCommand(message, client);
        return;
    }

    // ----------------- TÍNH NĂNG ĐĂNG KÝ HỒ SƠ -----------------
    const profileTriggers = [
        'profile', 'thong tin ca nhan', 'ttcn', 
        'dang ky ho so', 'dang ky profile', 'dang ky', 
        'cap nhat ho so', 'cap nhat thong tin', 'cap nhat'
    ];
    if (profileTriggers.some(t => cleanInput.startsWith(t))) {
        await handleProfileRegistration(message, rawInput);
        return;
    }

    // ----------------- TÍNH NĂNG CRUSH MẬT -----------------
    const crushTriggers = ['crush', 'thich'];
    if (crushTriggers.some(t => cleanInput.startsWith(t))) {
        await handleCrushCommand(message);
        return;
    }

    // ----------------- TÍNH NĂNG GHÉP ĐÔI TÌNH DUYÊN -----------------
    const matchmakingTriggers = ['ghep doi', 'ghep cap', 'bo duyen', 'tinh duyen', 'ghep'];
    if (matchmakingTriggers.some(t => cleanInput.startsWith(t))) {
        await playMatchmaking(message);
        return;
    }

    // ----------------- TÍNH NĂNG THÁM TỬ TƯ -----------------
    const detectiveTriggers = ['tham tu', 'dich vu tham tu', 'thue tham tu'];
    if (detectiveTriggers.some(t => cleanInput.startsWith(t))) {
        await handleDetectiveServices(message, 'thamtu');
        return;
    }

    // ----------------- TÍNH NĂNG BÁN ĐỨNG ĐỒNG BỌN -----------------
    const sellInfoTriggers = ['ban dung', 'mua tin', 'chi mat'];
    if (sellInfoTriggers.some(t => cleanInput.startsWith(t))) {
        await handleDetectiveServices(message, 'bandung');
        return;
    }

    // ----------------- TÍNH NĂNG BÙA YÊU ÉP DUYÊN -----------------
    const buaYeuTriggers = ['mua bua', 'ep duyen', 'bua yeu'];
    if (buaYeuTriggers.some(t => cleanInput.startsWith(t))) {
        await handleBuaYeu(message);
        return;
    }

    // ----------------- TÍNH NĂNG BÓI BÀI TAROT (kiểm tra trước gieo quẻ để tránh 'boi' match nhầm) -----------------
    const tarotTriggers = ['boi tarot', 'tarot', 'xem tarot', 'trai bai tarot', 'xem boi tarot'];
    if (tarotTriggers.some(t => cleanInput.startsWith(t))) {
        await handleTarot(message, rawInput);
        return;
    }

    // ----------------- TÍNH NĂNG GIEO QUẺ HÀNG NGÀY -----------------
    const gieoQueTriggers = ['gieo que', 'xin que', 'boi ca nhan', 'xem boi', 'boi'];
    if (gieoQueTriggers.some(t => cleanInput.startsWith(t))) {
        await handleGieoQue(message);
        return;
    }

    // ----------------- TÍNH NĂNG "CÂM" -----------------
    const shutUpTriggers = ['cam', 'im', 'nin', 'ngung sua', 'cam mom', 'im di', 'im mom'];
    if (shutUpTriggers.some(t => cleanInput.includes(t))) {
        message.reply("Biết rồi, tao câm đây!").catch(()=>{});

        // Di chuyển HornBot bất đồng bộ lập tức để ngắt tiếng
        (async () => {
            try {
                const hornBotId = '1131890979100700712';
                const hornBot = await message.guild?.members.fetch(hornBotId).catch(() => null);

                if (hornBot && hornBot.voice.channelId) {
                    const senderVoiceChannelId = message.member?.voice.channelId;
                    // Chỉ di chuyển nếu HornBot đang ở cùng phòng với người ra lệnh câm lặng
                    if (senderVoiceChannelId && hornBot.voice.channelId === senderVoiceChannelId) {
                        const currentChId = hornBot.voice.channelId;
                        const otherChannel = message.guild?.channels.cache.find(c => 
                            c.isVoiceBased() && c.id !== currentChId
                        );

                        if (otherChannel) {
                            await hornBot.voice.setChannel(otherChannel.id, "Bị BotToan bắt câm (cách ly)").catch(() => {});
                        } else {
                            await hornBot.voice.disconnect("Bị BotToan bắt câm (cách ly)").catch(() => {});
                        }
                    }
                }
            } catch (err) {
                console.error("Lỗi khi cách ly HornBot:", err);
            }
        })();
        return; 
    }

    // ----------------- TÍNH NĂNG VAY NGÂN HÀNG -----------------
    const borrowTriggers = ['vay ngan hang', 'vay tien', 'vay no'];
    if (borrowTriggers.some(t => cleanInput.includes(t))) {
        const result = await borrowMoney(message.author.id);
        await message.reply(result.message);
        return;
    }

    // ----------------- TÍNH NĂNG TRẢ NỢ NGÂN HÀNG -----------------
    const payDebtRegex = /^(tra no|pay debt)(?:\s+(\S+))?/i;
    const payDebtMatch = cleanInput.match(payDebtRegex);
    if (payDebtMatch) {
        const target = payDebtMatch[2]; // 'het', '50k', 'all', undefined
        const result = await payDebt(message.author.id, target);
        
        const embed = new EmbedBuilder()
            .setTitle(result.success ? "🏦 GIAO DỊCH TRẢ NỢ" : "🏦 LỖI GIAO DỊCH TRẢ NỢ")
            .setDescription(result.message)
            .setColor(result.success ? 0x2ECC71 : 0xFF0000)
            .setFooter({ text: "BotToan - Ngân hàng hoàng gia" });

        await message.reply({ embeds: [embed] });
        return;
    }

    // ----------------- TÍNH NĂNG BÙNG NỢ NGÂN HÀNG (MỚI) -----------------
    const dodgeTriggers = ['bung no', 'giat no', 'tron no'];
    if (dodgeTriggers.some(t => cleanInput.includes(t))) {
        const result = await dodgeDebt(message.author.id);
        
        if (!result.success && result.doubleDebt) {
            // Cho đi tù và cấm chat 3 phút ở Bot level
            await banChat(message.author.id, 180000);
            try {
                const member = message.member;
                if (member && member.voice.channelId) {
                    const prisonChannelId = "1517590846927667230";
                    await member.voice.setChannel(prisonChannelId, "Bùng nợ ngân hàng thất bại - Áp giải vào Nhà tù").catch(()=>{});
                }
            } catch (err) {}
        }
        
        await message.reply(result.message);
        return;
    }

    // ----------------- TÍNH NĂNG ĐIỂM DANH TÀI SẢN -----------------
    const checkWalletTriggers = ['tai san', 'vi tien', 'check tien', 'bop tien', 'vi'];
    if (checkWalletTriggers.some(t => cleanInput.includes(t))) {
        const voiceChannel = message.member?.voice.channel;
        let outputText = "💰 **BẢNG PHONG THẦN TÀI SẢN CHUNG** 💰\n*(Tiền này dùng chung cho mọi sòng: Xóc Đĩa, Bầu Cua, Blackjack)*\n\n";

        if (voiceChannel) {
            outputText += `👥 **Đang quét phòng thoại <#${voiceChannel.id}>:**\n`;
            const members = Array.from(voiceChannel.members.values()).filter(m => !m.user.bot);
            const memberIds = members.map(m => m.id);
            
            const results = await getBalancesAndDebts(memberIds);
            const memberMap = new Map(members.map(m => [m.id, m]));
            
            for (const r of results) {
                const member = memberMap.get(r.userId);
                const name = member ? member.displayName : `<@${r.userId}>`;
                const displayName = r.debt > 100 ? `${name} ⚠️ (Con Nợ Bot)` : name;
                outputText += `- **${displayName}**: Ví: **${formatMoney(r.balance)}** | Nợ: **${formatMoney(r.debt)}**\n`;
            }
        } else {
            outputText += `🌍 **Danh sách tổng hợp toàn server:**\n`;
            const results = await getAllBalancesAndDebts();
            if (results.length === 0) {
                outputText += "*Chưa có ai mở ví cả!*";
            } else {
                for (const r of results) {
                    const member = message.guild?.members.cache.get(r.userId);
                    const name = member ? member.displayName : `<@${r.userId}>`;
                    const displayName = r.debt > 100 ? `${name} ⚠️ (Con Nợ Bot)` : name;
                    outputText += `- **${displayName}**: Ví: **${formatMoney(r.balance)}** | Nợ: **${formatMoney(r.debt)}**\n`;
                }
            }
        }
        await message.reply(outputText);
        return;
    }

    // ----------------- TÍNH NĂNG ĐIỂM DANH HÀNG NGÀY -----------------
    if (cleanInput.includes('diem danh') || cleanInput === 'daily') {
        const result = await claimDaily(message.author.id);
        const avatarUrl = message.author.displayAvatarURL();
        const embed = new EmbedBuilder()
            .setTitle("📆 ĐIỂM DANH HÀNG NGÀY")
            .setThumbnail(avatarUrl)
            .setDescription(result.message)
            .setColor(result.success ? 0x00FF00 : 0xFF0000)
            .setFooter({ text: "BotToan - Sòng bạc hoàng gia", iconURL: client.user?.displayAvatarURL() });

        await message.reply({ embeds: [embed] });
        return;
    }

    // ----------------- TÍNH NĂNG ADMIN QUAY SỐ (MỚI) -----------------
    const adminQuaysoTriggers = ['quayso', 'quay so'];
    if (adminQuaysoTriggers.some(t => cleanInput === t)) {
        const isAdmin = message.member?.permissions.has(PermissionFlagsBits.Administrator);
        if (!isAdmin) {
            await message.reply("❌ **ĐÉO CÓ QUYỀN!** Lệnh quay số chỉ dành cho Admin đẹp trai khoai to thôi nhé!");
            return;
        }
        await triggerLotteryDraw(message.channel as any);
        return;
    }

    // ----------------- TÍNH NĂNG MUA VÉ SỐ KIẾN THIẾT (MỚI) -----------------
    const buyTicketRegex = /^(mua ve|buy ticket)(?:\s+(\S+))?/i;
    const buyTicketMatch = cleanInput.match(buyTicketRegex);
    if (buyTicketMatch) {
        let num = buyTicketMatch[2]; // Số hoặc "random" hoặc undefined
        if (!num || num === 'random') {
            const rand = Math.floor(Math.random() * 100);
            num = String(rand).padStart(2, '0');
        } else {
            // Chuẩn hóa thành 2 chữ số
            num = num.padStart(2, '0');
            if (num.length !== 2 || isNaN(Number(num))) {
                await message.reply("❌ **Sai cú pháp!** Hãy nhập số từ `00` đến `99` (Ví dụ: `mua ve 79`) hoặc `mua ve random`.");
                return;
            }
        }
        
        const result = await buyLotteryTicket(message.author.id, num);
        const embed = new EmbedBuilder()
            .setTitle("🎟️ VÉ SỐ KIẾN THIẾT BOTTOAN")
            .setDescription(result.message)
            .setColor(result.success ? 0x2ECC71 : 0xFF0000)
            .addFields({ name: "💰 Hũ Jackpot hiện tại", value: `**${formatMoney(result.jackpotPool)}**`, inline: true })
            .setFooter({ text: "Kết quả quay số tự động lúc 18:30 hàng ngày!" });

        await message.reply({ embeds: [embed] });
        return;
    }

    // ----------------- TÍNH NĂNG XEM VÉ SỐ CỦA TÔI (MỚI) -----------------
    const checkTicketTriggers = ['ve so', 'check ve', 'xem ve', 'jackpot'];
    if (checkTicketTriggers.some(t => cleanInput === t)) {
        const info = await getLotteryInfo(message.author.id);
        const ticketsStr = info.myTickets.length > 0 
            ? info.myTickets.map(t => `\`[ ${t} ]\``).join("  ")
            : "*Hôm nay mày chưa mua vé nào con ạ!*";
            
        let desc = `💰 **Tổng hũ tích lũy Jackpot hiện tại:** **${formatMoney(info.jackpotPool)}**\n\n`;
        desc += `🎟️ **Các vé mày đã mua hôm nay (${info.myTickets.length}/5):**\n${ticketsStr}\n\n`;
        
        if (info.lastWinningNum) {
            desc += `🔮 **Kết quả quay ngày trước (${info.lastDrawDate}):** 🎉 **${info.lastWinningNum}** 🎉\n`;
        } else {
            desc += `🔮 *Hôm nay là ngày quay đầu tiên, chưa có lịch sử trước đó!*\n`;
        }
        
        desc += `\n*Lệ phí: 10k/vé. Mỗi người được mua tối đa 5 vé. Gõ \`@BotToan mua ve 79\` để mua nhé!*`;

        const embed = new EmbedBuilder()
            .setTitle("🎰 THÔNG TIN VÉ SỐ KIẾN THIẾT BOTTOAN")
            .setDescription(desc)
            .setColor(0xF1C40F)
            .setFooter({ text: "Quay số chính xác vào 18:30 hàng ngày!" })
            .setThumbnail(message.author.displayAvatarURL());

        await message.reply({ embeds: [embed] });
        return;
    }

    // ----------------- TÍNH NĂNG XEM KẾT QUẢ XỔ SỐ (MỚI) -----------------
    const kqxsTriggers = ['kqxs', 'ket qua xo so', 'xo so', 'kq ve so', 'ket qua ve so'];
    if (kqxsTriggers.some(t => cleanInput === t)) {
        const lastDraw = await getLastLotteryDraw();
        
        if (!lastDraw) {
            // Null Handling: chưa từng có đợt quay nào
            await message.reply("❌ **SÒNG MỚI KHAI TRƯƠNG!** Chưa tới giờ quay phát nào mà đã đòi xem kết quả! Lo mà nôn 10k ra mua vé đi các con giời! Gõ `@BotToan mua ve 79` cúng tiền lẹ!");
            return;
        }
        
        // Tạo bảng vàng kết quả xổ số kiến thiết cực đẹp và bựa
        const embed = new EmbedBuilder()
            .setTitle("🎰 BẢNG VÀNG XỔ SỐ KIẾN THIẾT BOTTOAN 🎰")
            .setColor(0xF1C40F)
            .setFooter({ text: "Quay thưởng tự động chính xác lúc 18:30 tối hàng ngày!" })
            .setTimestamp();
            
        let desc = `📆 **Đợt quay ngày:** \`${lastDraw.date}\` (Giờ Việt Nam)\n`;
        desc += `🔮 **Con số thần tài nổ giải:** 🎉 **${lastDraw.winningNumbers.join(" - ")}** 🎉\n`;
        desc += `💰 **Trị giá hũ Jackpot lúc quay:** **${formatMoney(lastDraw.jackpotPool)}**\n\n`;
        
        if (lastDraw.winners && lastDraw.winners.length > 0) {
            desc += `🏆 **DANH SÁCH CHIẾN THẦN HÚP LỘC:**\n`;
            for (const w of lastDraw.winners) {
                desc += `- <@${w.userId}> trúng **${w.ticketsCount} vé** húp về **${formatMoney(w.payout)}**!\n`;
            }
            
            const winTrolls = [
                "Trúng giải rồi thì nhớ chia lộc cho tao, cấm bùng nợ nghe chưa các con nghiện!",
                "Ăn đậm thế tối nay bao cả sòng bài nhé chiến thần!",
                "Jackpot nổ to quá, chúc mừng các đại gia mới nổi tối nay ăn chơi sa đọa!"
            ];
            desc += `\n*💬 Lời nhắn từ chủ lô:* "${winTrolls[Math.floor(Math.random() * winTrolls.length)]}"`;
        } else {
            desc += `💸 **Toàn bộ con giời cúng tiền hôm nay đã ra đê!** Không có ai trúng số đặc biệt cả.\n\n`;
            
            // FOMO alert
            const today = new Date(Date.now() + 7 * 60 * 60 * 1000);
            const todayStr = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;
            const info = await getLotteryInfo(message.author.id);
            
            desc += `🔥 **HŨ TÍCH LŨY HIỆN TẠI ĐÃ LÊN TỚI: ${formatMoney(info.jackpotPool)}**!\n👉 Nhanh tay gõ \`@BotToan mua ve random\` mua vé cúng hũ kẻo ngày mai thằng khác nó húp mất thì khóc hận!\n\n`;
            
            const loseTrolls = [
                "Lô đề cờ bạc muôn đời thịnh, các con giời thua cuộc lo cày cuốc ngày mai cúng tiếp đi cưng!",
                "Tiền cúng hũ của các con giời tao cầm tạm đi mua trà sữa nhé, cảm ơn nhiều nha!",
                "Hôm nay lại thêm một đống xác con nợ dưới chân cầu, hũ to hơn rồi, mua tiếp đi cưng!"
            ];
            desc += `*💬 Lời nhắn từ chủ lô:* "${loseTrolls[Math.floor(Math.random() * loseTrolls.length)]}"`;
        }
        
        embed.setDescription(desc);
        await message.reply({ embeds: [embed] });
        return;
    }

    // ----------------- TÍNH NĂNG BÁO CÁO CÔNG AN (MỚI) -----------------
    const snitchRegex = /^(bao cong an|goi cong an|bao an|snitch)(?:\s+<@!?(\d+)>)?/i;
    const snitchMatch = cleanInput.match(snitchRegex);
    if (snitchMatch) {
        const targetUser = message.mentions.users.filter(u => u.id !== client.user?.id).first();
        if (!targetUser) {
            await message.reply("❌ **Mày muốn báo án ai?** Tag nó vào! Ví dụ: `@BotToan bao cong an @Ten_Doi_Phuong`.");
            return;
        }

        const targetId = targetUser.id;
        const reporterId = message.author.id;

        if (targetId === reporterId) {
            await message.reply("❌ **TỰ HỦY À BẠN?** Mày định báo công an bắt chính mình à? Đang phê đá hay gì con trai?");
            return;
        }

        if (targetId === client.user?.id) {
            await message.reply("❌ **VUỐT RÂU HÙM À?** Tao là Cảnh Sát Trưởng (BotToan) bảo kê sòng này, công an nào dám đụng?");
            return;
        }

        // 1. Kiểm tra xem người bị báo có đang chơi game hay không
        if (!activeGamePlayers.has(targetId)) {
            await message.reply("❌ **BÁO ÁN LÁO!** Thằng kia có đang chơi bời, tụ tập cờ bạc gì đâu mà mày đòi báo công an? Định trêu chiến sĩ hay vu khống hả con?");
            return;
        }

        // 2. Kiểm tra xem hôm nay người báo đã báo án chưa
        const { canSnitch, todayStr } = await getSnitchCooldown(reporterId);
        if (!canSnitch) {
            await message.reply("❌ **LẠM DỤNG ĐƯỜNG DÂY NÓNG!** Hôm nay mày gọi Công an một lần rồi! Lạm dụng đường dây nóng tao tống cổ vào tù bây giờ. Mai quay lại!");
            return;
        }

        // 3. Kiểm tra ví tiền đối phương trước khi thụ lý
        const targetBal = await getBalance(targetId);
        if (targetBal < 15) {
            await message.reply("❌ **KHÔNG THỂ THỤ LÝ!** Thằng này nghèo rớt mồng tơi, đến cái nịt còn chẳng có thì đánh bạc cái gì? Dùng quyền báo án duy nhất trong ngày của mày cho đứa khác đi!");
            return;
        }

        // Đánh dấu người báo đã dùng lượt của ngày hôm nay lập tức để tránh gửi liên tiếp
        await updateSnitchDate(reporterId, todayStr);

        // 4. May rủi 50% / 50%
        const isSuccess = Math.random() < 0.5;

        if (isSuccess) {
            // Thành công: Phạt đối phương, thưởng cho người báo
            const latestTargetBal = await getBalance(targetId);
            const confiscatedAmount = Math.min(trueRandom(15, 30), latestTargetBal);
            
            // Cập nhật ví tiền
            await updateBalance(targetId, latestTargetBal - confiscatedAmount);
            const reporterBal = await getBalance(reporterId);
            await updateBalance(reporterId, reporterBal + confiscatedAmount);

            // Phạt đối phương cấm chat 2 phút và di chuyển vào voice Nhà Tù
            await banChat(targetId, 120000);
            const moved = message.guild ? await sendToJail(message.guild, targetId, "Bị báo công an bắt quả tang đang ôm sới bạc") : false;

            let prisonText = moved
                ? `đã bị **áp giải vào Nhà Tù** và cấm chat 2 phút!`
                : `đã bị cấm chat 2 phút! *(Do đối phương không có trong phòng voice nên thoát được cảnh tù tội)*`;

            const embed = new EmbedBuilder()
                .setTitle("🚨 SWAT ĐỘT KÍCH THÀNH CÔNG 🚨")
                .setDescription(`Đoàng! SWAT đã phá cửa xông vào bắt quả tang <@${targetId}> đang ôm sới bạc.\nTịch thu **${formatMoney(confiscatedAmount)}** giao cho công dân gương mẫu <@${reporterId}>!\n<@${targetId}> ${prisonText}`)
                .setColor(0x0000FF)
                .setFooter({ text: "BotToan - Công an Nhân dân", iconURL: client.user?.displayAvatarURL() })
                .setTimestamp();

            await message.reply({ embeds: [embed] });
        } else {
            // Thất bại: Phạt người báo án láo 15k, cấm chat 2 phút và đi tù
            let reporterBal = await getBalance(reporterId);
            // Phạt 15k trực tiếp (không dùng Math.max — để bư con sành bỏ sành không thể phạt âm rồi reset về 0)
            reporterBal = reporterBal - 15;
            await updateBalance(reporterId, reporterBal);

            await banChat(reporterId, 120000);
            const moved = message.guild ? await sendToJail(message.guild, reporterId, "Báo công an láo - Phạt nặng") : false;

            let prisonText = moved
                ? `đã bị **áp giải vào Nhà Tù** và cấm chat 2 phút!`
                : `đã bị cấm chat 2 phút! *(Do không ở trong phòng voice nên thoát được cảnh tù tội)*`;

            const embed = new EmbedBuilder()
                .setTitle("⚠️ BÁO ÁN LÁO - PHẠT NẶNG ⚠️")
                .setDescription(`Báo án láo này! Công an check camera thấy <@${targetId}> đang ngủ ở nhà.\n<@${reporterId}> đã phí mất lượt báo án duy nhất trong ngày, chuẩn bị khăn gói lên đồn nộp phạt **${formatMoney(15)}** và ${prisonText} vì tội trêu chiến sĩ!`)
                .setColor(0xF1C40F)
                .setFooter({ text: "BotToan - Công an Nhân dân", iconURL: client.user?.displayAvatarURL() })
                .setTimestamp();

            await message.reply({ embeds: [embed] });
        }
        return;
    }

    // ----------------- TÍNH NĂNG BẢNG XẾP HẠNG -----------------
    if (cleanInput === 'top' || cleanInput === 'bxh') {
        const { rich, poor } = await getLeaderboard();
        
        let richText = "";
        for (let i = 0; i < rich.length; i++) {
            richText += `**${i + 1}.** <@${rich[i].userId}>: **${formatMoney(rich[i].balance)}**\n`;
        }
        if (!richText) richText = "*Chưa có dữ liệu người chơi.*";

        let poorText = "";
        for (let i = 0; i < poor.length; i++) {
            poorText += `**${i + 1}.** <@${poor[i].userId}>: **${formatMoney(poor[i].balance)}**\n`;
        }
        if (!poorText) poorText = "*Chưa có dữ liệu người chơi.*";

        const embed = new EmbedBuilder()
            .setTitle("📊 BẢNG XẾP HẠNG TÀI SẢN")
            .setColor(0x00AE86)
            .addFields(
                { name: "🏆 Đại Gia Top 5 (Giàu Nhất)", value: richText, inline: false },
                { name: "💸 Cái Bang Top 5 (Nghèo Nhất)", value: poorText, inline: false }
            )
            .setFooter({ text: "BotToan - Sòng bạc hoàng gia", iconURL: client.user?.displayAvatarURL() });

        await message.reply({ embeds: [embed] });
        return;
    }

    // ----------------- TÍNH NĂNG CHUYỂN TIỀN -----------------
    const isTransfer = cleanInput.startsWith('chuyen') || cleanInput.startsWith('pay');
    if (isTransfer) {
        // Tìm ID người nhận: <@!?(\d+)>
        const userMentionMatch = cleanInput.match(/<@!?(\d+)>/);
        if (userMentionMatch) {
            const cleanInputWithoutMention = cleanInput.replace(/<@!?\d+>/g, '');
            const amount = parseMoneyInput(cleanInputWithoutMention);
            const receiverId = userMentionMatch[1];
            const senderId = message.author.id;

            if (amount !== null && amount > 0) {
                const result = await transferMoney(senderId, receiverId, amount);
                const embed = new EmbedBuilder()
                    .setTitle("💸 GIAO DỊCH CHUYỂN TIỀN")
                    .setDescription(result.message)
                    .setColor(result.success ? 0x00FF00 : 0xFF0000)
                    .addFields(
                        { name: "Người gửi", value: `<@${senderId}>`, inline: true },
                        { name: "Người nhận", value: `<@${receiverId}>`, inline: true }
                    )
                    .setFooter({ text: "BotToan - Sòng bạc hoàng gia", iconURL: client.user?.displayAvatarURL() });

                await message.reply({ embeds: [embed] });
                return;
            }
        }
    }

    // ----------------- TÍNH NĂNG PHÁT LÌ XÌ CƯỚP GIẬT -----------------
    const lixiRegex = /^(lixi|li xi)\s+(\d+(?:\.\d+)?(?:k|tr|trieu|ty|b)?)\s+(?:cho\s+)?(\d+)/i;
    const lixiMatch = cleanInput.match(lixiRegex);
    if (lixiMatch) {
        const amount = parseMoneyInput(lixiMatch[2]);
        const maxPeople = parseInt(lixiMatch[3]);
        if (amount !== null && amount > 0 && maxPeople > 0) {
            await handleLixi(message, amount, maxPeople);
            return;
        }
    }

    // ----------------- TÍNH NĂNG GAME VÒNG QUAY TỬ THẦN -----------------
    const rrRegex = /^(roulette|tu than)(?:\s+(\d+(?:\.\d+)?(?:k|tr|trieu|ty|b)?))?/i;
    const rrMatch = cleanInput.match(rrRegex);
    if (rrMatch) {
        const betAmount = rrMatch[2] ? (parseMoneyInput(rrMatch[2]) || 20) : 20; // mặc định 20k
        await playRussianRoulette(message, betAmount);
        return;
    }

    // ----------------- TÍNH NĂNG GAME POKER TỬ THẦN -----------------
    const prRegex = /^(poker|poker roulette|roulette poker)(?:\s+(\d+(?:\.\d+)?(?:k|tr|trieu|ty|b)?))?/i;
    const prMatch = cleanInput.match(prRegex);
    if (prMatch) {
        const betAmount = prMatch[2] ? (parseMoneyInput(prMatch[2]) || 20) : 20; // mặc định 20k
        await playPokerRoulette(message, betAmount);
        return;
    }

    // ----------------- TÍNH NĂNG GAME "TÀI XỈU" -----------------
    if (cleanInput.includes('tai xiu') || cleanInput === 'tx') {
        await playTaiXiu(message);
        return;
    }

    // ----------------- TÍNH NĂNG GAME "BẦU CUA" -----------------
    if (cleanInput.includes('bau cua')) {
        await playBauCua(message);
        return;
    }

    // ----------------- TÍNH NĂNG GAME "XÓC ĐĨA" -----------------
    if (cleanInput.includes('xoc dia')) {
        await playXocDia(message);
        return;
    }

    // ----------------- TÍNH NĂNG GAME "XÌ DÁCH / BLACKJACK" -----------------
    if (cleanInput.includes('xi dach') || cleanInput.includes('blackjack')) {
        await playBlackjack(message);
        return;
    }

    // ----------------- TÍNH NĂNG ĐĂNG KÝ RIOT ID VALORANT -----------------
    const regValMatch = rawInput.match(/^reg\s+val\s+(.+)$/i);
    if (regValMatch) {
        const valId = regValMatch[1].trim();
        if (!valId.includes('#')) {
            await message.reply("❌ **Sai cú pháp!** Riot ID phải có định dạng `Tên#Tag` (Ví dụ: `ToanLee#5433`).");
            return;
        }
        
        await registerValorantId(message.author.id, valId);
        
        const embed = new EmbedBuilder()
            .setTitle("🎮 ĐĂNG KÝ RIOT ID VALORANT")
            .setDescription(`✅ Đăng ký thành công Riot ID **${valId}** cho <@${message.author.id}>.\nBây giờ mày có thể gõ \`@BotToan rank val\` để xem rank của mình!`)
            .setColor(0x00FF00)
            .setFooter({ text: "BotToan - Valorant Tracker", iconURL: client.user?.displayAvatarURL() });

        await message.reply({ embeds: [embed] });
        return;
    }

    // ----------------- TÍNH NĂNG XEM RANK VALORANT -----------------
    const rankValMatch = rawInput.match(/^(rank\s+val|rank\s+valorant)(?:\s+(.+))?$/i);
    if (rankValMatch) {
        let valId = rankValMatch[2]?.trim();
        
        if (!valId) {
            // Lấy ID đã đăng ký của user
            valId = await getValorantId(message.author.id);
            if (!valId) {
                await message.reply("❌ **Mày chưa đăng ký Riot ID!**\n👉 Hãy gõ `@BotToan reg val Tên#Tag` để đăng ký trước, hoặc gõ `@BotToan rank val Tên#Tag` để xem rank trực tiếp.");
                return;
            }
        } else if (!valId.includes('#')) {
            await message.reply("❌ **Sai cú pháp!** Riot ID phải có định dạng `Tên#Tag` (Ví dụ: `ToanLee#5433`).");
            return;
        }

        const parts = valId.split('#');
        const tag = parts.pop() || "";
        const name = parts.join('#');

        // Gửi tin nhắn chờ
        const statusMsg = await message.reply("⏳ Đang cào dữ liệu rank Valorant từ API, đợi tí tao check...");
        
        const rankInfo = await fetchValorantRank(name, tag);
        
        if (!rankInfo.success) {
            await statusMsg.edit(`❌ **Lỗi:** ${rankInfo.message || "Không thể lấy thông tin rank."}`).catch(() => {});
            return;
        }

        // Tạo Embed hiển thị thông tin cực xịn
        const isWin = rankInfo.mmrChange !== undefined && rankInfo.mmrChange >= 0;
        const changeSign = isWin ? "+" : "";
        const color = isWin ? 0x2ECC71 : 0xE74C3C; // Xanh lá nếu thắng, đỏ nếu thua
        
        const embed = new EmbedBuilder()
            .setTitle(`🎮 THÔNG TIN RANK: ${rankInfo.name}#${rankInfo.tag}`)
            .setColor(color)
            .setDescription(`Dưới đây là thông số xếp hạng mùa hiện tại của chiến thần **${rankInfo.name}**.`)
            .addFields(
                { name: "🏆 Xếp Hạng Hiện Tại", value: `**${rankInfo.currentRank}** (${rankInfo.rr} RR)`, inline: true },
                { name: "⭐ Tổng ELO", value: `**${rankInfo.elo}**`, inline: true },
                { name: "📈 Trận Gần Nhất", value: `**${changeSign}${rankInfo.mmrChange} RR**`, inline: true },
                { name: "👑 Rank Cao Nhất", value: `**${rankInfo.highestRank}**`, inline: false }
            );

        if (rankInfo.rankIcon) {
            embed.setThumbnail(rankInfo.rankIcon);
        }

        embed.setFooter({ text: "BotToan - HenrikDev Valorant API Integration", iconURL: client.user?.displayAvatarURL() })
             .setTimestamp();

        await statusMsg.delete().catch(() => {});
        await message.reply({ embeds: [embed] });
        return;
    }

    // ----------------- TÍNH NĂNG PICK TƯỚNG VALORANT -----------------
    const draftTriggers = ['quay tuong', 'chon tuong', 'random tuong', 'pick tuong'];
    if (draftTriggers.some(t => cleanInput.includes(t))) {
        await playValorantDraft(message);
        return;
    }

    // ----------------- TÍNH NĂNG BÓI MÀU VẬN KHÍ (AURA) -----------------
    const auraTriggers = ['aura', 'mau van khi', 'sac mau hom nay'];
    if (auraTriggers.some(t => cleanInput === t || cleanInput.startsWith(t + ' '))) {
        await handleAura(message, rawInput);
        return;
    }

    // ----------------- TÍNH NĂNG HỘP THƯ BÍ MẬT (ANONYMOUS LETTER) -----------------
    const letterTriggers = ['thu bi mat', 'anonymous', 'anon'];
    if (letterTriggers.some(t => cleanInput === t || cleanInput.startsWith(t + ' '))) {
        await handleAnonymousLetter(message, rawInput);
        return;
    }

    // ----------------- TÍNH NĂNG KIỂM TRA THƯ HÀNG ĐỢI (CHECKDM) -----------------
    if (cleanInput === 'checkdm' || cleanInput === 'check dm' || cleanInput === 'kiem tra thu') {
        await handleCheckDM(message);
        return;
    }

    // ----------------- TÍNH NĂNG NHẬT KÝ TÂM TRẠNG (MOOD DIARY) -----------------
    const moodTriggers = ['tam trang', 'mood', 'cam xuc'];
    if (moodTriggers.some(t => cleanInput === t || cleanInput.startsWith(t + ' '))) {
        await handleMoodDiary(message, rawInput);
        return;
    }

    // ----------------- TÍNH NĂNG BIÊN NIÊN SỬ OVERTHINK -----------------
    const overthinkTriggers = ['overthink', 'suy dien', 'bimbi'];
    if (overthinkTriggers.some(t => cleanInput === t || cleanInput.startsWith(t + ' '))) {
        await handleOverthink(message, rawInput);
        return;
    }

    // ----------------- TÍNH NĂNG ĐỘI ĐẶC NHIỆM CHỐT ĐƠN -----------------
    const chotDonTriggers = ['chotdon', 'chot don', 'mua hay khong', 'tieu hay cat'];
    if (chotDonTriggers.some(t => cleanInput === t || cleanInput.startsWith(t + ' '))) {
        await handleChotDon(message, rawInput);
        return;
    }

    // ----------------- TÍNH NĂNG HÔM NAY EM LÀ AI (AESTHETIC) -----------------
    const aestheticTriggers = ['hom nay em la ai', 'style'];
    if (aestheticTriggers.some(t => cleanInput === t || cleanInput.startsWith(t + ' '))) {
        await handleDailyAesthetic(message);
        return;
    }

    // ----------------- TÍNH NĂNG TRẮC NGHIỆM MÁY DÒ GU (MYGU) -----------------
    const myGuTriggers = ['mygu', 'gu'];
    if (myGuTriggers.some(t => cleanInput === t || cleanInput.startsWith(t + ' '))) {
        await handleMyGuQuiz(message, rawInput);
        return;
    }

    // ----------------- TÍNH NĂNG ĐOÁN GU NHANH (DOAN MYGU) -----------------
    const doanMyGuTriggers = ['doan mygu', 'doan gu'];
    if (doanMyGuTriggers.some(t => cleanInput === t || cleanInput.startsWith(t + ' '))) {
        await handleDoanMyGu(message);
        return;
    }

    // ----------------- TÍNH NĂNG TÒA ÁN GAMING -----------------
    const toaanTriggers = ['toaan', 'lt', 'luan toi', 'toan'];
    if (toaanTriggers.some(t => cleanInput === t || cleanInput.startsWith(t + ' '))) {
        await handleGamingCourt(message, rawInput);
        return;
    }

    // ----------------- TÍNH NĂNG WORLD CUP 2026 -----------------
    const wcTriggers = ['wc', 'setwc', 'chungwc', 'lockwc', 'bat', 'bet', 'editwc', 'delwc', 'xoawc', 'qlwc', 'listwc', 'intro wc', 'wc intro'];
    if (wcTriggers.some(t => cleanInput === t || cleanInput.startsWith(t + ' '))) {
        await handleWCCommand(message, rawInput);
        return;
    }

    const wcPredictTriggers = ['tientri', 'tien tri', 'predict'];
    if (wcPredictTriggers.some(t => cleanInput === t || cleanInput.startsWith(t + ' '))) {
        await handleWCPrediction(message, rawInput);
        return;
    }

    const wcPenaltyTriggers = ['sut', 'penalty'];
    if (wcPenaltyTriggers.some(t => cleanInput === t || cleanInput.startsWith(t + ' '))) {
        await playWCPenalty(message, rawInput);
        return;
    }

    // ----------------- TÍNH NĂNG XÓA TIN NHẮN (PURGE) -----------------
    const xoaTriggers = ['xoa', 'xóa', 'clear', 'purge'];
    if (xoaTriggers.some(t => cleanInput === t || cleanInput.startsWith(t + ' '))) {
        const channel = message.channel;
        if (!channel || !('bulkDelete' in channel)) {
            await message.reply("❌ **Kênh này không hỗ trợ xóa tin nhắn, thôi chịu!").catch(() => {});
            return;
        }

        // Kiểm tra quyền người dùng
        const memberPerms = message.member?.permissions;
        const hasUserPerm = memberPerms?.has(PermissionFlagsBits.ManageMessages) || memberPerms?.has(PermissionFlagsBits.Administrator);
        if (!hasUserPerm) {
            const noPermTrolls = [
                "🚫 **TUỔI GÌ ĐÒI XÓA?** Kiếm cái quyền **Manage Messages** rồi quay lại đây nói chuyện với anh!",
                "🚫 **KHÔN NHƯ BẠN QUÊ TÔI XÍCH ĐẦY!** Đéo có quyền mà đòi dọn rác hộ người ta, lo mà xin mod đi con!",
                "🚫 **OÀI!** Mày nghĩ mày là ai mà đòi xóa tin nhắn? Xin quyền **Manage Messages** từ admin rồi hãy quay lại nhé cưng!"
            ];
            await message.reply(noPermTrolls[Math.floor(Math.random() * noPermTrolls.length)]).catch(() => {});
            return;
        }

        // Kiểm tra quyền bot
        const botMember = message.guild?.members.me;
        const hasBotPerm = botMember && (channel as any).permissionsFor(botMember)?.has(PermissionFlagsBits.ManageMessages);
        if (!hasBotPerm) {
            await message.reply("❌ **Cấp quyền Quản lý tin nhắn (`Manage Messages`) cho trẫm nhanh lên, không có quyền thì xóa bằng niềm tin à?** 👑").catch(() => {});
            return;
        }

        // Lệnh xoa help
        const afterXoa = rawInput.replace(/^(xoa|xóa|clear|purge)\s*/i, '').trim();
        const afterXoaClean = removeAccents(afterXoa).toLowerCase().trim();

        if (afterXoaClean === 'help' || afterXoaClean === 'huong dan') {
            const helpEmbed = new EmbedBuilder()
                .setTitle("🗑️ HƯỚNG DẪN XÓA TIN NHẮN - BOTTOAN")
                .setColor(0xE74C3C)
                .setDescription("Dọn dẹp bãi rác trong kênh chat theo lệnh của mày. Nhớ là mày phải có quyền **Manage Messages** mới xài được nghe chưa!")
                .addFields(
                    { name: "📌 Cú pháp cơ bản", value:
                        "`@BotToan xoa <số>` — Xóa N tin nhắn gần nhất (tối đa 500)\n" +
                        "`@BotToan xoa 100` — Xóa **100** tin nhắn (mặc định theo yêu cầu)\n" +
                        "`@BotToan xoa all` — Xóa toàn bộ tin nhắn có thể xóa (tối đa 500)",
                        inline: false
                    },
                    { name: "🎯 Lọc theo đối tượng", value:
                        "`@BotToan xoa bot <số>` — Chỉ xóa tin nhắn của BotToan\n" +
                        "`@BotToan xoa @User <số>` — Xóa tin nhắn của một người cụ thể",
                        inline: false
                    },
                    { name: "⚠️ Lưu ý quan trọng", value:
                        "• Tin nhắn **quá 14 ngày** chỉ xóa được tối đa **20 cái** mỗi lần (giới hạn Discord)\n" +
                        "• Tin nhắn **ghim (📌 pinned)** sẽ **không bị xóa** để giữ an toàn\n" +
                        "• Bot cần có quyền **Manage Messages** trong kênh",
                        inline: false
                    }
                )
                .setFooter({ text: "BotToan - Dọn rác chuyên nghiệp", iconURL: client.user?.displayAvatarURL() });
            const helpMsg = await message.reply({ embeds: [helpEmbed] }).catch(() => null);
            setTimeout(() => helpMsg?.delete().catch(() => {}), 15000);
            return;
        }

        // Parse tham số lệnh
        let purgeAmount = 100; // mặc định 100
        let filterMode: 'all' | 'bot' | 'user' = 'all';
        let filterUserId: string | null = null;

        if (afterXoaClean === 'all') {
            purgeAmount = 500;
        } else {
            // Kiểm tra lọc theo bot: "xoa bot <N>"
            const botMatch = afterXoaClean.match(/^bot(?:\s+(\d+))?$/);
            if (botMatch) {
                filterMode = 'bot';
                purgeAmount = botMatch[1] ? Math.min(parseInt(botMatch[1]), 500) : 100;
            } else {
                // Kiểm tra lọc theo user: "xoa @User <N>"
                const mentionedUser = message.mentions.users.filter(u => u.id !== client.user?.id).first();
                if (mentionedUser) {
                    filterMode = 'user';
                    filterUserId = mentionedUser.id;
                    const numMatch = afterXoaClean.match(/(\d+)/);
                    purgeAmount = numMatch ? Math.min(parseInt(numMatch[1]), 500) : 100;
                } else {
                    // Chỉ là số: "xoa 50"
                    const numOnly = parseInt(afterXoaClean);
                    if (!isNaN(numOnly) && numOnly > 0) {
                        purgeAmount = Math.min(numOnly, 500);
                    } else if (afterXoaClean !== '') {
                        await message.reply("❌ **Sai cú pháp!** Gõ `@BotToan xoa help` để xem hướng dẫn đầy đủ nhé cưng!").catch(() => {});
                        return;
                    }
                    // nếu afterXoaClean rỗng → dùng mặc định 100
                }
            }
        }

        // Xóa tin nhắn lệnh gốc trước
        await message.delete().catch(() => {});

        // Gửi thông báo đang xử lý
        const processingMsg = await (channel as any).send("⏳ **Đang dọn rác...** Ngồi im chờ anh làm việc một tí!").catch(() => null);

        // Thực thi xóa
        const result = await executePurge(channel as any, purgeAmount, filterMode, filterUserId, client.user?.id || '');

        // Xóa tin nhắn "đang xử lý"
        await processingMsg?.delete().catch(() => {});

        // Gửi embed kết quả
        const doneTrolls = [
            `✅ Đã **húp sạch ${result.deleted} bãi rác** theo lệnh của <@${message.author.id}>. Đừng để anh thấy chú xả rác nữa đấy!`,
            `🗑️ **${result.deleted} tin nhắn** đã bị xử lý ấn thơm theo lệnh của <@${message.author.id}>. Kênh sạch đẹp như mới rồi đó!`,
            `💨 Vèo một cái, **${result.deleted} tin** đã bay màu theo lệnh của <@${message.author.id}>. Rác không có chỗ trong server của anh!`
        ];
        const resultEmbed = new EmbedBuilder()
            .setTitle("🗑️ DỌN RÁC HOÀN TẤT")
            .setColor(0x2ECC71)
            .setDescription(doneTrolls[Math.floor(Math.random() * doneTrolls.length)])
            .addFields(
                { name: "✅ Đã xóa", value: `**${result.deleted}** tin nhắn`, inline: true },
                { name: "📌 Bỏ qua (ghim)", value: `**${result.skippedPinned}** tin nhắn`, inline: true },
                { name: "⏳ Bỏ qua (quá cũ)", value: `**${result.skippedOld}** tin nhắn`, inline: true }
            )
            .setFooter({ text: "Tin nhắn này tự xóa sau 5 giây", iconURL: client.user?.displayAvatarURL() })
            .setTimestamp();

        if (result.skippedOld > 0) {
            resultEmbed.addFields({ name: "⚠️ Lưu ý", value: `**${result.skippedOld}** tin nhắn quá cũ (> 14 ngày) đã bị bỏ qua vì giới hạn của Discord API.`, inline: false });
        }

        const resultMsg = await (channel as any).send({ embeds: [resultEmbed] }).catch(() => null);
        setTimeout(() => resultMsg?.delete().catch(() => {}), 5000);
        return;
    }

    // ============ ROUTING LOGIC: XỬ LÝ ẢNH & TẠO ẢNH (ƯU TIÊN TRƯỚC CHAT) ============

    // Helper: kiểm tra từ khóa trigger trong text
    function hasTriggerWord(text: string, keywords: string[]): boolean {
        const lower = text.toLowerCase();
        return keywords.some(kw => lower.includes(kw));
    }

    // Helper: bỏ từ khóa trigger ra khỏi text, lấy phần còn lại làm prompt (ưu tiên xóa từ khóa dài nhất trước)
    function extractPrompt(text: string, keywords: string[]): string {
        let result = text;
        const sortedKeywords = [...keywords].sort((a, b) => b.length - a.length);
        for (const kw of sortedKeywords) {
            result = result.replace(new RegExp(kw, 'gi'), '').trim();
        }
        return result.trim();
    }

    const IMAGE_GEN_TRIGGERS = ['vẽ cho tao', 'generate image', 'tạo ảnh', 'sinh ảnh', 'vẽ ảnh', 'vẽ'];
    const IMAGE_EDIT_TRIGGERS = ['chỉnh cho tao', 'sửa cho tao', 'chỉnh ảnh', 'sửa ảnh', 'edit ảnh'];

    // Helper: Dọn dẹp pings/mentions (role, user, channel) để tránh spam ID
    function cleanMentions(text: string): string {
        return text.replace(/<@&?\d+>/g, '').replace(/<#\d+>/g, '').trim();
    }

    // BƯỚC 1: Từ khóa TẠO ẢNH (text → image, không cần attachment)
    if (hasTriggerWord(rawInput, IMAGE_GEN_TRIGGERS)) {
        const imagePrompt = extractPrompt(rawInput, IMAGE_GEN_TRIGGERS);
        if (!imagePrompt) {
            await message.reply('Vẽ cái gì? Nói rõ cho tao biết đi! Ví dụ: `@BotToan vẽ một con mèo đang đánh bài` 🎨');
            return;
        }
        const quota = checkImageQuota(message.author.id);
        if (!quota.allowed) {
            await message.reply(`🚫 **Hết quota vẽ ảnh rồi ông ơi!** Mày đã dùng **${quota.used}/${quota.limit} lượt** hôm nay. Ngày mai quay lại nhé, đừng spam tao! 😤`);
            return;
        }
        if ('sendTyping' in message.channel) await (message.channel as any).sendTyping();
        try {
            const remaining = quota.limit === Infinity ? '∞' : String(quota.limit - quota.used - 1);
            const { buffer, modelUsed } = await generateImageWithImagen(message.author.id, imagePrompt);
            const attachment = new AttachmentBuilder(buffer, { name: 'bottoan_art.jpg' });
            
            const quotePrompt = cleanMentions(imagePrompt);
            const sentMsg = await message.reply({
                content: `🎨 **Đây, tao vẽ cho mày!** \`${quotePrompt}\`\n*Model: \`${modelUsed}\` • Còn **${remaining}** lượt hôm nay.*`,
                files: [attachment]
            });

            // Lấy URL thực tế từ Discord CDN sau khi upload và edit gắn nút mở ảnh gốc
            const uploadedUrl = sentMsg.attachments.first()?.url;
            if (uploadedUrl) {
                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setLabel('🔗 Mở ảnh gốc')
                        .setStyle(ButtonStyle.Link)
                        .setURL(uploadedUrl)
                );
                await sentMsg.edit({ components: [row] }).catch(() => {});
            }
        } catch (err: any) {
            if (err.message?.startsWith('QUOTA_EXCEEDED')) {
                const [, used, limit] = err.message.split(':');
                await message.reply(`🚫 Hết ${used}/${limit} lượt vẽ ảnh hôm nay rồi! Ngày mai quay lại nhé!`);
            } else if (err.message?.includes('safety') || err.message?.includes('block') || err.message?.includes('policy')) {
                await message.reply('🚫 **Cái này tao không vẽ được!** Nội dung vi phạm chính sách, chọn chủ đề khác đi mày!');
            } else {
                console.error('[IMAGE GEN LỖI]:', err);
                await message.reply('❌ Tao đang không vẽ được, API lag hay gì ấy. Thử lại sau nhé!');
            }
        }
        return;
    }

    // BƯỚC 2: Từ khóa CHỈNH ẢNH + CÓ ảnh đính kèm
    if (hasTriggerWord(rawInput, IMAGE_EDIT_TRIGGERS) && message.attachments.size > 0) {
        const instruction = extractPrompt(rawInput, IMAGE_EDIT_TRIGGERS) || 'Chỉnh ảnh này đẹp hơn';
        const attachment = message.attachments.first()!;
        const mimeType = attachment.contentType || 'image/jpeg';
        if (!mimeType.startsWith('image/')) {
            await message.reply('⚠️ Tao chỉ chỉnh được ảnh thôi nha, không phải file khác!');
            return;
        }
        const quota = checkImageQuota(message.author.id);
        if (!quota.allowed) {
            await message.reply(`🚫 **Hết quota chỉnh ảnh rồi!** Mày đã dùng **${quota.used}/${quota.limit} lượt** hôm nay.`);
            return;
        }
        if ('sendTyping' in message.channel) await (message.channel as any).sendTyping();
        try {
            const imgResponse = await fetch(attachment.url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; BotToan-Discord/1.0; +https://github.com/ToanLee5433)',
                    'Accept': 'image/*, */*;q=0.8'
                }
            });
            if (!imgResponse.ok) throw new Error(`Không tải được ảnh gốc: HTTP ${imgResponse.status}`);
            const imgBuffer = await imgResponse.arrayBuffer();
            const imageBase64 = Buffer.from(imgBuffer).toString('base64');
            const remaining = quota.limit === Infinity ? '∞' : String(quota.limit - quota.used - 1);
            
            const { buffer, modelUsed } = await editImageWithImagen(message.author.id, imageBase64, mimeType, instruction);
            const editAttachment = new AttachmentBuilder(buffer, { name: 'bottoan_edited.jpg' });
            
            const quoteInstruction = cleanMentions(instruction);
            const sentMsg = await message.reply({
                content: `✏️ **Xong rồi đây!** Đã chỉnh theo yêu cầu: \`${quoteInstruction}\`\n*Model: \`${modelUsed}\` • Còn **${remaining}** lượt hôm nay.*`,
                files: [editAttachment]
            });

            // Edit gắn nút mở ảnh gốc
            const uploadedUrl = sentMsg.attachments.first()?.url;
            if (uploadedUrl) {
                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setLabel('🔗 Mở ảnh gốc')
                        .setStyle(ButtonStyle.Link)
                        .setURL(uploadedUrl)
                );
                await sentMsg.edit({ components: [row] }).catch(() => {});
            }
        } catch (err: any) {
            if (err.message?.startsWith('QUOTA_EXCEEDED')) {
                await message.reply('🚫 Hết lượt chỉnh ảnh hôm nay rồi! Ngày mai quay lại nhé!');
            } else {
                console.error('[IMAGE EDIT LỖI]:', err);
                await message.reply('❌ Tao chỉnh ảnh không được lúc này, thử lại sau nhé!');
            }
        }
        return;
    }

    // Helper: trích xuất ảnh từ tin nhắn (đính kèm, embed, hoặc link raw)
    function extractImageFromMessage(msg: any): { url: string; mimeType: string } | null {
        // 1. Check attachments
        if (msg.attachments && msg.attachments.size > 0) {
            const attachment = msg.attachments.first();
            if (attachment && attachment.contentType?.startsWith('image/')) {
                return { url: attachment.url, mimeType: attachment.contentType };
            }
        }

        // 2. Check embeds (ví dụ: ảnh avatar, ảnh tự sinh, embed link)
        if (msg.embeds && msg.embeds.length > 0) {
            for (const embed of msg.embeds) {
                const imgUrl = embed.image?.url || embed.thumbnail?.url;
                if (imgUrl) {
                    let mime = 'image/jpeg';
                    if (imgUrl.toLowerCase().includes('.png')) mime = 'image/png';
                    else if (imgUrl.toLowerCase().includes('.gif')) mime = 'image/gif';
                    else if (imgUrl.toLowerCase().includes('.webp')) mime = 'image/webp';
                    return { url: imgUrl, mimeType: mime };
                }
            }
        }

        // 3. Check raw image links in content
        if (msg.content) {
            const urlRegex = /(https?:\/\/[^\s]+)/gi;
            const matches = msg.content.match(urlRegex);
            if (matches) {
                for (const url of matches) {
                    const lower = url.toLowerCase();
                    if (lower.includes('.png') || lower.includes('.jpg') || lower.includes('.jpeg') || lower.includes('.gif') || lower.includes('.webp')) {
                        let mime = 'image/jpeg';
                        if (lower.includes('.png')) mime = 'image/png';
                        else if (lower.includes('.gif')) mime = 'image/gif';
                        else if (lower.includes('.webp')) mime = 'image/webp';
                        return { url, mimeType: mime };
                    }
                }
            }
        }

        return null;
    }

    // BƯỚC 3: CÓ ảnh đính kèm/embed TRONG TIN HIỆN TẠI → Nhận xét ảnh
    const currentImg = extractImageFromMessage(message);
    if (currentImg) {
        if ('sendTyping' in message.channel) await (message.channel as any).sendTyping();
        try {
            const analysisText = await analyzeImageWithGemini(currentImg.url, currentImg.mimeType, rawInput || undefined);
            const cleanText = analysisText.replace(/https?:\/\/[^\s]+/g, '');
            await message.reply(cleanText.trim() || '...Tao nhìn ảnh này mà không biết nói gì luôn 🤔');
        } catch (err) {
            console.error('[IMAGE ANALYZE LỖI]:', err);
            await message.reply('❌ Ảnh này tao không xem được! Link hỏng hoặc định dạng lạ quá, up lại đi mày!');
        }
        return;
    }

    // BƯỚC 3b: USER REPLY VÀO MỘT TIN CÓ ẢNH (đính kèm, embed, link) → Bot đọc ảnh từ tin được reply
    if (message.reference?.messageId) {
        try {
            const refMsg = await message.channel.messages.fetch(message.reference.messageId);
            const refImg = extractImageFromMessage(refMsg);
            if (refImg) {
                if ('sendTyping' in message.channel) await (message.channel as any).sendTyping();
                // Prompt kết hợp cả nội dung user gõ + tin nhắn gốc được reply
                const contextPrompt = rawInput
                    ? rawInput
                    : 'Nhìn vào ảnh này và nhận xét đi!';
                const analysisText = await analyzeImageWithGemini(refImg.url, refImg.mimeType, contextPrompt);
                const cleanText = analysisText.replace(/https?:\/\/[^\s]+/g, '');
                await message.reply(cleanText.trim() || '...Tao nhìn ảnh này mà không biết nói gì luôn 🤔');
                return;
            }
        } catch (err) {
            console.error('[REPLY IMAGE ANALYZE LỖI]:', err);
        }
    }

    // ============ BƯỚC 4 FALLBACK: CHAT TEXT THƯỜNG VỚI GEMINI ============
    await sleep(2000);

    try {
        if ('sendTyping' in message.channel) await (message.channel as any).sendTyping();

        const responseText = await chatWithGemini(message.author.id, rawInput);
        const cleanText = responseText.replace(/https?:\/\/[^\s]+/g, "");

        const maxLength = 900;
        const chunks = cleanText.match(new RegExp('.{1,' + maxLength + '}(\\s|$)', 'g')) || [cleanText];

        for (const chunk of chunks) {
            if (chunk.trim()) {
                await message.reply(chunk.trim());
                await sleep(2000);
            }
        }
    } catch (error) {
        await message.reply('Mạng lag hay sao ấy, tao đang không load được, thử lại đi mày!');
    }
});

// ================= HÀM HELPER XÓA TIN NHẮN (PURGE) =================
interface PurgeResult {
    deleted: number;
    skippedPinned: number;
    skippedOld: number;
}

async function executePurge(
    channel: any,
    maxAmount: number,
    filterMode: 'all' | 'bot' | 'user',
    filterUserId: string | null,
    botId: string
): Promise<PurgeResult> {
    const result: PurgeResult = { deleted: 0, skippedPinned: 0, skippedOld: 0 };
    const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;
    const MAX_OLD_DELETIONS = 20; // Giới hạn xóa từng cái để tránh cạn rate-limit
    const OLD_DELETE_DELAY = 1200; // ms delay giữa mỗi lần xóa tin cũ

    let lastMessageId: string | undefined = undefined;
    let totalFetched = 0;
    const now = Date.now();

    // Tin nhắn mới (< 14 ngày) để bulkDelete
    const newMessages: any[] = [];
    // Tin nhắn cũ (>= 14 ngày) xóa từng cái
    const oldMessages: any[] = [];

    // ---- Phase 1: Fetch tin nhắn theo pagination ----
    while (totalFetched < maxAmount) {
        const batchSize = Math.min(100, maxAmount - totalFetched);
        const fetchOptions: any = { limit: batchSize };
        if (lastMessageId) fetchOptions.before = lastMessageId;

        let fetched: any;
        try {
            fetched = await channel.messages.fetch(fetchOptions);
        } catch (err) {
            console.error('[PURGE] Lỗi khi fetch tin nhắn:', err);
            break;
        }

        if (!fetched || fetched.size === 0) break;

        const messages = Array.from(fetched.values()) as any[];

        for (const msg of messages) {
            // Bỏ qua tin nhắn ghim
            if (msg.pinned) {
                result.skippedPinned++;
                continue;
            }

            // Áp dụng bộ lọc
            if (filterMode === 'bot' && msg.author.id !== botId) continue;
            if (filterMode === 'user' && filterUserId && msg.author.id !== filterUserId) continue;

            const age = now - msg.createdTimestamp;
            if (age < TWO_WEEKS) {
                newMessages.push(msg);
            } else {
                oldMessages.push(msg);
            }
        }

        totalFetched += fetched.size;
        lastMessageId = messages[messages.length - 1]?.id;
        if (fetched.size < batchSize) break; // Hết tin nhắn
    }

    // ---- Phase 2: BulkDelete tin nhắn mới (batch tối đa 100) ----
    const newMsgChunks: any[][] = [];
    for (let i = 0; i < newMessages.length; i += 100) {
        newMsgChunks.push(newMessages.slice(i, i + 100));
    }

    for (const chunk of newMsgChunks) {
        try {
            const ids = chunk.map((m: any) => m.id);
            await channel.bulkDelete(ids, true); // true = ignore errors for individual messages
            result.deleted += chunk.length;
        } catch (err: any) {
            console.error('[PURGE] Lỗi bulkDelete:', err?.message || err);
        }
    }

    // ---- Phase 3: Xóa từng cái cho tin nhắn cũ (giới hạn MAX_OLD_DELETIONS) ----
    const oldToDelete = oldMessages.slice(0, MAX_OLD_DELETIONS);
    result.skippedOld = oldMessages.length - oldToDelete.length;

    for (const msg of oldToDelete) {
        try {
            await msg.delete();
            result.deleted++;
        } catch (err: any) {
            // Bỏ qua lỗi Unknown Message (đã bị xóa trước đó)
            if (!err?.message?.includes('Unknown Message')) {
                console.error('[PURGE] Lỗi xóa tin cũ:', err?.message || err);
            }
        }
        // Delay để tránh cạn rate-limit Discord
        await new Promise(res => setTimeout(res, OLD_DELETE_DELAY));
    }

    return result;
}

// ================= TÍNH NĂNG CHÀO MỪNG VOICE =================
client.on('voiceStateUpdate', async (oldState: VoiceState, newState: VoiceState) => {
    if (newState.member?.user.bot || oldState.channelId === newState.channelId) return;

    const oldChannel = oldState.channel;
    const newChannel = newState.channel;

    if (oldChannel) {
        const connection = getVoiceConnection(oldChannel.guild.id);
        if (connection && connection.joinConfig.channelId === oldChannel.id && oldChannel.members.filter(m => !m.user.bot).size === 0) {
            if (!newChannel) connection.destroy();
        }
    }

    if (!newChannel) return;

    const userId = newState.member?.id;
    if (!userId) return;

    const PRISON_CHANNEL_ID = "1517590846927667230";
    const isJailEntry = newChannel.id === PRISON_CHANNEL_ID;
    
    const audioPath = isJailEntry
        ? path.join(__dirname, '../audio', 'jail.mp3')
        : path.join(__dirname, '../audio', `${userId}.mp3`);

    if (!fs.existsSync(audioPath)) {
        return; 
    }

    try {
        const connection = joinVoiceChannel({
            channelId: newChannel.id,
            guildId: newChannel.guild.id,
            adapterCreator: newChannel.guild.voiceAdapterCreator,
        });

        await entersState(connection, VoiceConnectionStatus.Ready, 5000);
        
        const player = createAudioPlayer();
        player.play(createAudioResource(audioPath));
        connection.subscribe(player);
        player.on(AudioPlayerStatus.Idle, () => {
            player.stop();
            if (isJailEntry) {
                // Tự động cút khỏi phòng voice tù tội sau khi phát xong âm thanh bêu rếu
                connection.destroy();
            }
        });
        
    } catch (error) {
        console.error('Lỗi voice:', error);
    }
});

// ================= HÀM QUAY XỔ SỐ KIẾN THIẾT CHI TIẾT VÀ HIỆU ỨNG TRỰC TIẾP =================
async function triggerLotteryDraw(initiatorChannel?: any) {
    if (isDrawing) {
        if (initiatorChannel) {
            await initiatorChannel.send("⚠️ **ĐANG QUAY RỒI BA!** Có người đang quay số hoặc đợt quay đang diễn ra, đừng spam!").catch(()=>{});
        }
        return;
    }
    
    isDrawing = true;
    try {
        const now = Date.now();
        const dateStr = getVNDateString(now);
        
        // 1. Kiểm tra xem đợt quay hôm nay đã được vẽ chưa
        const isDrawn = await getLotteryState(dateStr);
        if (isDrawn && isDrawn.drawn) {
            if (initiatorChannel) {
                await initiatorChannel.send(`⚠️ **ĐỢT QUAY NGÀY ${dateStr} ĐÃ HOÀN THÀNH!** Không thể quay lại.`).catch(()=>{});
            }
            isDrawing = false;
            return;
        }
        
        // Lấy danh sách những người mua vé hôm nay trước khi quay
        const todayTickets = await getLotteryTicketsForDate(dateStr);
        const playerIds = Array.from(new Set(todayTickets.map(t => t.userId)));
        
        // 2. Gọi drawLottery để lưu kết quả vào DB
        const result = await drawLottery(dateStr);
        if (!result.success || !result.winningNumbers) {
            if (initiatorChannel) {
                await initiatorChannel.send("❌ **CÓ LỖI XẢY RA KHI QUAY SỐ!** Vui lòng thử lại sau.").catch(()=>{});
            }
            isDrawing = false;
            return;
        }
        
        // 3. Gửi tin nhắn DM thông báo cho những người đã mua vé hôm nay
        for (const pId of playerIds) {
            try {
                const user = await client.users.fetch(pId);
                if (user) {
                    await user.send(`🔴 **XỔ SỐ KIẾN THIẾT HÔM NAY ĐẠT GIỜ QUAY THƯỞNG!** Mau vào phòng chat chung bấm nút **Xem Quay Số Trực Tiếp** để lật bài bí mật nhé!`).catch(() => {});
                }
            } catch (err) {
                console.error(`Không thể gửi DM cho người chơi ${pId}:`, err);
            }
        }
        
        // 4. Phát tin nhắn công khai tại tất cả server kèm nút xem quay số
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`watch_lottery_${dateStr}`)
                .setLabel("🔴 Xem Quay Số Trực Tiếp")
                .setStyle(ButtonStyle.Danger)
        );
        
        const jackpotPool = result.jackpotPool || 200;
        
        const announceEmbed = new EmbedBuilder()
            .setTitle("🔴 TRỰC TIẾP XỔ SỐ KIẾN THIẾT BOTTOAN 🔴")
            .setDescription(`🔔 **Đến giờ quay thưởng rồi các con nghiện ơi!**\n💰 **Hũ Jackpot tích lũy hôm nay:** **${formatMoney(jackpotPool)}**\n\n👉 Bấm nút **Xem Quay Số Trực Tiếp** bên dưới để mở màn hình quay số bí mật dành riêng cho bạn! Nút này sẽ biến mất sau **2 phút**!`)
            .setColor(0xE74C3C)
            .setFooter({ text: "Chúc các con giời may mắn, thua thì ra đê!" })
            .setTimestamp();
            
        // Tìm tất cả các kênh để gửi thông báo
        const targetChannels: any[] = [];
        for (const guild of client.guilds.cache.values()) {
            try {
                let targetChannel = null;
                
                // 1. Ưu tiên systemChannel nếu bot gửi được tin
                if (guild.systemChannel) {
                    const me = guild.members.me;
                    const canSend = me && guild.systemChannel.viewable && guild.systemChannel.permissionsFor(me).has(PermissionFlagsBits.SendMessages);
                    if (canSend) {
                        targetChannel = guild.systemChannel;
                    }
                }
                
                // 2. Nếu không được, tìm kênh text đầu tiên có quyền gửi tin
                if (!targetChannel) {
                    const me = guild.members.me;
                    if (me) {
                        targetChannel = guild.channels.cache.find(c => 
                            c.isTextBased() && 
                            c.viewable && 
                            c.permissionsFor(me).has(PermissionFlagsBits.SendMessages)
                        );
                    }
                }
                
                if (targetChannel) {
                    targetChannels.push(targetChannel);
                }
            } catch (err) {
                console.error("Lỗi khi tìm kênh gửi tin:", err);
            }
        }
        
        // Gửi tin nhắn và lưu lại các tin nhắn đã gửi để sửa sau này
        const announceMessages: any[] = [];
        for (const chan of targetChannels) {
            try {
                const msg = await chan.send({ embeds: [announceEmbed], components: [row] });
                announceMessages.push(msg);
            } catch (err) {
                console.error("Lỗi gửi tin nhắn thông báo:", err);
            }
        }
        
        // 5. Thiết lập button collector cho từng tin nhắn đã gửi
        for (const announceMsg of announceMessages) {
            const filter = (i: any) => i.customId.startsWith(`watch_lottery_`);
            const collector = announceMsg.createMessageComponentCollector({ filter, time: 120000 });
            
            collector.on('collect', async (i: any) => {
                const clickDate = i.customId.replace("watch_lottery_", "");
                
                // Nếu click vé của ngày khác (ngày cũ)
                if (clickDate !== dateStr) {
                    const oldState = await getLotteryState(clickDate);
                    if (oldState && oldState.drawn) {
                        const oldTickets = await getLotteryTicketsForDate(clickDate);
                        const myOldTickets = oldTickets.filter(t => t.userId === i.user.id).map(t => t.number);
                        const matched = myOldTickets.filter(num => oldState.winningNumbers.includes(num));
                        
                        let personalResult = "";
                        if (myOldTickets.length === 0) {
                            personalResult = `⚠️ Hôm đó mày có mua vé đéo đâu mà đòi xem kết quả!`;
                        } else if (matched.length > 0) {
                            const matchingTicketsCount = oldTickets.filter(t => oldState.winningNumbers.includes(t.number)).length;
                            const payoutPerTicket = matchingTicketsCount > 0 ? Math.floor(oldState.jackpotPool / matchingTicketsCount) : 0;
                            personalResult = `🎉 Mày đã trúng **${matched.length} vé** húp về **${formatMoney(payoutPerTicket * matched.length)}**!`;
                        } else {
                            personalResult = `💸 Mày mua **${myOldTickets.length} vé** nhưng đéo trúng số nào cả!`;
                        }
                        
                        const oldEmbed = new EmbedBuilder()
                            .setTitle(`🎰 KẾT QUẢ XỔ SỐ NGÀY ${clickDate} 🎰`)
                            .setDescription(
                                `🔮 **5 Con số may mắn:** ${oldState.winningNumbers.join(" - ")}\n\n` +
                                `🎟️ **Các vé mày đã mua:** ${myOldTickets.length > 0 ? myOldTickets.map(t=>`\`[ ${t} ]\``).join(" ") : "*Không có*"}\n\n` +
                                `${personalResult}`
                            )
                            .setColor(matched.length > 0 ? 0x2ECC71 : 0xE74C3C)
                            .setFooter({ text: "BotToan - Sòng bạc hoàng gia" });
                            
                        await i.reply({ embeds: [oldEmbed], ephemeral: true }).catch(()=>{});
                    } else {
                        await i.reply({ content: "❌ Không tìm thấy dữ liệu đợt quay số này!", ephemeral: true }).catch(()=>{});
                    }
                    return;
                }
                
                // Chống spam: kiểm tra xem người này có đang xem quay số hay không
                if (activeViewers.has(i.user.id)) {
                    await i.reply({ content: "⏳ **ĐANG XEM RỒI BA!** Trình chiếu đang chạy, từ từ mà tận hưởng đi!", ephemeral: true }).catch(()=>{});
                    return;
                }
                
                // Đánh dấu user đang xem
                activeViewers.add(i.user.id);
                
                try {
                    // Defer reply để lách luật 3s của Discord
                    await i.deferReply({ ephemeral: true });
                    
                    // Chạy hiệu ứng quay số trong 75 giây
                    const winNums = result.winningNumbers!;
                    const spinEmoji = "🌀";
                    const displayNums = ["[  ]", "[  ]", "[  ]", "[  ]", "[  ]"];
                    
                    for (let step = 0; step < 15; step++) {
                        const numberIndex = Math.floor(step / 3); // 0, 1, 2, 3, 4
                        const subStep = step % 3; // 0, 1, 2
                        
                        // Giả lập quay số: cập nhật các ô số
                        for (let j = 0; j < 5; j++) {
                            if (j < numberIndex) {
                                displayNums[j] = `🎉 **${winNums[j]}**`;
                            } else if (j === numberIndex) {
                                // Số đang được quay
                                if (subStep === 0) displayNums[j] = ` ${spinEmoji} [ ⚡ ]`;
                                else if (subStep === 1) displayNums[j] = ` ${spinEmoji} [ 💥 ]`;
                                else displayNums[j] = ` ${spinEmoji} [ ✨ ]`;
                            } else {
                                displayNums[j] = `[ ⏳ ]`;
                            }
                        }
                        
                        const progressText = `🎰 **TIẾN TRÌNH QUAY SỐ KIẾN THIẾT** 🎰\n\n` +
                            `1️⃣ Giải Nhất: ${displayNums[0]}\n` +
                            `2️⃣ Giải Nhì: ${displayNums[1]}\n` +
                            `3️⃣ Giải Ba: ${displayNums[2]}\n` +
                            `4️⃣ Giải Tư: ${displayNums[3]}\n` +
                            `5️⃣ Giải Đặc Biệt: ${displayNums[4]}\n\n` +
                            `*📺 Đang truyền hình trực tiếp, mỗi số được phân tích trong 15 giây...*`;
                            
                        await i.editReply({ content: progressText }).catch(()=>{});
                        await sleep(5000);
                    }
                    
                    // Khi kết thúc quay số, reveal kết quả đầy đủ và thống kê xem người xem có trúng không
                    const myInfo = await getLotteryInfo(i.user.id);
                    const userTickets = myInfo.myTickets;
                    const matchedTickets = userTickets.filter(t => winNums.includes(t));
                    
                    let personalResult = "";
                    if (userTickets.length === 0) {
                        personalResult = `⚠️ **Ơ CÁI THẰNG NÀY!** Hôm nay mày đã mua vé đéo đâu mà đòi trúng thưởng? Định vào xem chùa à? Đi mua vé cúng hũ cho ngày mai đi con: \`@BotToan mua ve 79\``;
                    } else if (matchedTickets.length > 0) {
                        const myPayout = (result.payoutPerTicket || 0) * matchedTickets.length;
                        personalResult = `🎉 **HÚP RỒI CON ƠI!!!** Mày mua **${userTickets.length} vé**, trúng **${matchedTickets.length} vé** (các số trúng: ${matchedTickets.map(t=>`\`${t}\``).join(", ")}).\n💰 Hốt bạc ngân hàng: **+${formatMoney(myPayout)}** đã cộng thẳng vào ví! Gáy to lên!`;
                    } else {
                        const loseTrolls = [
                            "Tiền cúng Jackpot của mày rất thơm, thầy Toàn xin nhận để đi uống bia nhé!",
                            "Chúc mừng mày đã nhận tấm vé miễn phí ra đê hóng mát tối nay! Quay lại mua tiếp ngày mai đi cưng!",
                            "Thua rồi con ạ! Lô đề cờ bạc muôn đời nát, tắt máy xách mông đi làm đi!",
                            "Nghiện lật bài mà đéo có thần linh độ rồi, chia buồn cùng con nợ nhé!"
                        ];
                        personalResult = `💸 **XUỐNG HỐ CẢ LŨ!** Mày mua **${userTickets.length} vé** nhưng đéo trúng số nào cả.\n*💬 Lời nhắn từ chủ lô:* "${loseTrolls[Math.floor(Math.random() * loseTrolls.length)]}"`;
                    }
                    
                    const finalEmbed = new EmbedBuilder()
                        .setTitle("🎰 KẾT QUẢ XỔ SỐ CỦA BẠN 🎰")
                        .setDescription(
                            `🔮 **5 Con số may mắn ngày hôm nay:**\n` +
                            winNums.map((n, idx) => `🔹 Số thứ ${idx+1}: 🎉 **${n}**`).join("\n") + `\n\n` +
                            `🎟️ **Các vé mày đã mua hôm nay:** ${userTickets.length > 0 ? userTickets.map(t=>`\`[ ${t} ]\``).join(" ") : "*Không có*"}\n\n` +
                            `${personalResult}`
                        )
                        .setColor(matchedTickets.length > 0 ? 0x2ECC71 : 0xE74C3C)
                        .setFooter({ text: "BotToan - Sòng bạc hoàng gia" })
                        .setTimestamp();
                        
                    await i.editReply({ content: "🏆 **QUAY THƯỞNG HOÀN TẤT!** Dưới đây là kết quả của mày:", embeds: [finalEmbed] }).catch(()=>{});
                    
                } catch (err) {
                    console.error("Lỗi trình chiếu hiệu ứng quay số:", err);
                } finally {
                    activeViewers.delete(i.user.id);
                }
            });
            
            collector.on('end', async () => {
                // Khi kết thúc 2 phút, gỡ nút bấm và hiển thị kết quả cuối cùng công khai
                const endEmbed = new EmbedBuilder()
                    .setTitle("🎰 BẢNG VÀNG XỔ SỐ KIẾN THIẾT BOTTOAN 🎰")
                    .setColor(0xF1C40F)
                    .setFooter({ text: "Quay thưởng tự động chính xác lúc 18:30 tối hàng ngày!" })
                    .setTimestamp();
                    
                let desc = `📆 **Đợt quay ngày:** \`${dateStr}\` (Giờ Việt Nam)\n`;
                desc += `🔮 **5 Con số thần tài nổ giải:** 🎉 **${result.winningNumbers?.join(" - ")}** 🎉\n`;
                desc += `💰 **Trị giá hũ Jackpot lúc quay:** **${formatMoney(result.jackpotPool || 200)}**\n\n`;
                
                if (result.winners && result.winners.length > 0) {
                    desc += `🏆 **DANH SÁCH CHIẾN THẦN HÚP LỘC:**\n`;
                    for (const w of result.winners) {
                        const payout = (result.payoutPerTicket || 0) * w.ticketsCount;
                        desc += `- <@${w.userId}> trúng **${w.ticketsCount} vé** húp về **${formatMoney(payout)}**!\n`;
                    }
                    desc += `\n*Hũ Jackpot đã được chia đều và reset về mốc khởi điểm **200.000đ** cho đợt ngày mai!*`;
                } else {
                    desc += `💸 **Toàn bộ con giời cúng tiền hôm nay đã ra đê!** Không có ai trúng số đặc biệt cả.\n` +
                            `*Toàn bộ hũ tích lũy **${formatMoney(result.jackpotPool || 200)}** sẽ được cộng dồn (Rollover) sang ngày mai! Cơ hội làm giàu đang lớn dần!*`;
                }
                
                endEmbed.setDescription(desc);
                
                await announceMsg.edit({ embeds: [endEmbed], components: [] }).catch(()=>{});
            });
        }
    } catch (error) {
        console.error("Lỗi trong triggerLotteryDraw:", error);
    } finally {
        isDrawing = false;
    }
}

// ================= THIẾT LẬP CRON QUAY SỐ 18:30 HÀNG NGÀY (MỚI) =================
cron.schedule('30 18 * * *', async () => {
    await triggerLotteryDraw();
}, {
    timezone: "Asia/Ho_Chi_Minh"
} as any);

// ================= SỰ KIỆN KHI BOT SẴN SÀNG KHỞI ĐỘNG CƠ BẢN =================
client.on('shardError', (error) => {
    console.error('[DISCORD SHARD LỖI] Kết nối Shard gặp lỗi:', error);
});

client.on('shardDisconnect', (event, shardId) => {
    console.warn(`[DISCORD SHARD] Shard ${shardId} bị mất kết nối:`, event);
});

client.on('shardReconnecting', (shardId) => {
    console.log(`[DISCORD SHARD] Shard ${shardId} đang kết nối lại...`);
});

client.on('error', (error) => {
    console.error('[DISCORD HỆ THỐNG LỖI]', error);
});

client.on('warn', (warning) => {
    console.warn('[DISCORD CẢNH BÁO]', warning);
});

client.on('debug', (info) => {
    // Chỉ in những log debug quan trọng liên quan đến kết nối/WebSocket/Rate limit để tránh ngập log
    if (info.includes('Gateway') || info.includes('Heartbeat') || info.includes('connect') || info.includes('Session') || info.includes('rate') || info.includes('identif') || info.includes('ready')) {
        console.log(`[DISCORD DEBUG] ${info}`);
    }
});

client.once('clientReady', (readyClient) => {
    console.log(`[DISCORD] ✅ Đăng nhập thành công! Bot đã online với tên: ${readyClient.user.tag}`);
});

(async () => {
    try {
        console.log("[HỆ THỐNG] Đang khởi động bot...");

        // Đăng nhập Discord trước để bot online ngay lập tức
        console.log(`[DISCORD] Kiểm tra TOKEN: Độ dài = ${TOKEN?.length || 0}, Bắt đầu bằng = "${TOKEN ? TOKEN.substring(0, 8) : ''}..."`);
        
        // Thử kiểm tra kết nối API Discord trực tiếp bằng HTTP Fetch (có timeout 6 giây)
        (() => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);

            fetch("https://discord.com/api/v10/gateway/bot", {
                headers: {
                    "Authorization": `Bot ${TOKEN}`
                },
                signal: controller.signal
            }).then(async (res) => {
                clearTimeout(timeoutId);
                console.log(`[DISCORD CHẨN ĐOÁN] Kết nối HTTP tới Discord API: Status = ${res.status} ${res.statusText}`);
                if (res.status !== 200) {
                    const text = await res.text();
                    console.error(`[DISCORD CHẨN ĐOÁN] Phản hồi lỗi từ API: ${text.substring(0, 200)}`);
                } else {
                    console.log("[DISCORD CHẨN ĐOÁN] Kết nối HTTP API bình thường, thông tin Token hợp lệ.");
                }
            }).catch((err: any) => {
                clearTimeout(timeoutId);
                if (err.name === 'AbortError') {
                    console.error("[DISCORD CHẨN ĐOÁN] ❌ Kết nối HTTP tới Discord API bị TIMEOUT sau 6 giây.");
                    console.error("[DISCORD CHẨN ĐOÁN] 👉 Khả năng rất cao là địa chỉ IP của máy chủ Render này đã bị Discord/Cloudflare chặn/drop kết nối!");
                } else {
                    console.error("[DISCORD CHẨN ĐOÁN] ❌ Không thể kết nối HTTP tới Discord API:", err.message || err);
                }
            });
        })();

        console.log("[DISCORD] Đang kết nối tới Gateway...");
        client.login(TOKEN).then(() => {
            console.log("[DISCORD] Đã gửi yêu cầu đăng nhập.");
        }).catch((err) => {
            console.error("[DISCORD LỖI] Lỗi đăng nhập Discord:");
            console.error(err);
            if (err.message && err.message.includes("DISALLOWED_INTENTS")) {
                console.error("\n❌❌❌ [LỖI QUAN TRỌNG] ĐÂY LÀ LỖI DISALLOWED INTENTS!");
                console.error("👉 Bạn cần truy cập Discord Developer Portal -> Ứng dụng của bạn -> tab 'Bot'.");
                console.error("👉 Cuộn xuống phần 'Privileged Gateway Intents' và BẬT 'MESSAGE CONTENT INTENT'.");
                console.error("👉 Nhấn 'Save Changes' để lưu lại.\n");
            }
            process.exit(1);
        });

        // Kết nối DB song song (không chặn đăng nhập Discord)
        connectDB()
            .then(async () => {
                console.log("[HỆ THỐNG] Tiến trình kết nối DB hoàn tất.");
                // Nạp cache video warmup sau khi kết nối DB thành công
                await loadWarmupVideosCache(client).catch(err => {
                    console.error("[WARMUP LỖI] Không thể nạp cache video warmup:", err);
                });
            })
            .catch(err => {
                console.error("[HỆ THỐNG LỖI] Gặp lỗi khi kết nối DB:", err);
            });

        // Tải icon agent song song
        loadAgentIcons()
            .then(() => {
                console.log("[VALORANT] Tiến trình tải icons hoàn tất.");
            })
            .catch(err => {
                console.error("[VALORANT LỖI] Không thể nạp icons agent:", err);
            });

        // Đăng ký Valorant Collector
        registerValorantCollector(client);

        // Đăng ký World Cup Collector
        registerWorldCupCollector(client);

        // Đăng ký Avatar Collector
        registerAvatarCollector(client);

        // Đăng ký MyGu Collector
        registerMyGuCollector(client);

        // Đăng ký Welcome Event (Chào mừng thành viên mới & Nhận lì xì)
        registerWelcomeEvent(client);

        // Khởi tạo Tarot
        await initTarot().catch(err => {
            console.error("[TAROT LỖI] Không thể khởi tạo Tarot:", err);
        });

        // Tự động cập nhật cache video warmup mỗi 15 phút
        setInterval(async () => {
            console.log("[WARMUP] Đang tự động làm mới RAM Cache video...");
            await loadWarmupVideosCache(client).catch(err => console.error("Lỗi tự động cập nhật cache video:", err));
        }, 15 * 60 * 1000);


    } catch (startupError) {
        console.error("[HỆ THỐNG LỖI] Lỗi nghiêm trọng trong quá trình khởi chạy:", startupError);
    }
})();

async function handleHelpCommand(message: Message, client: any) {
    const embed = new EmbedBuilder()
        .setTitle("📖 CẨM NANG HƯỚNG DẪN SỬ DỤNG BOTTOAN")
        .setDescription(
            `Chào con giời! Tao là **BotToan** - Cảnh sát sòng bài & AI trợ lý mỏ hỗn của server.\n` +
            `Dưới đây là danh sách đầy đủ tất cả các lệnh để mày cúng tiền hoặc tấu hài:`
        )
        .setColor(0xEBCB8B)
        .setThumbnail(client.user?.displayAvatarURL())
        .addFields(
            { name: "🏦 VÍ TIỀN & NGÂN HÀNG", value: 
                "• `diem danh` | `daily`: Nhận tiền mỗi ngày\n" +
                "• `vi` | `tai san` | `check tien` | `bop tien`: Xem ví & nợ nần\n" +
                "• `bxh` | `top`: Bảng xếp hạng đại gia & cái bang\n" +
                "• `vay tien` | `vay ngan hang`: Vay 100k vốn cứu sinh (khi dưới 10k)\n" +
                "• `tra no [số]` | `tra no all`: Thanh toán nợ nần\n" +
                "• `bung no` | `giat no`: Thử vận may trốn nợ (50% bay màu đi tù)\n" +
                "• `chuyen @User [số]`: Chuyển tiền cho con nợ khác",
                inline: false 
            },
            { name: "🎰 CASINO ĐỎ ĐEN (Nút bấm tương tác)", value:
                "• `tai xiu` | `tx`: Bàn đấu tài xỉu từ 10k - 50k\n" +
                "• `bau cua`: Sới bầu cua tôm cá hoàng gia\n" +
                "• `xoc dia`: Sới xóc đĩa chẵn lẻ ASCII\n" +
                "• `blackjack` | `xi dach`: Sới blackjack đấu với nhà cái BotToan",
                inline: false
            },
            { name: "👥 ĐỒNG ĐỘI & ĐỘT KÍCH SWAT", value:
                "• `lixi [tiền] [người]`: Phát lì xì cướp giật trong kênh\n" +
                "• `roulette [tiền]` | `tu than [tiền]`: Bắn súng xoay 1 viên đạn thật\n" +
                "• `poker [tiền]` | `poker roulette`: Poker sinh tử bóp cò súng\n" +
                "• `snitch @User` | `bao cong an @User`: Báo án sới bạc SWAT hốt (50/50)",
                inline: false
            },
            { name: "🎟️ XỔ SỐ KIẾN THIẾT (Tự động quay 18:30)", value:
                "• `mua ve [số/random]`: Mua vé số cầu may (10k/vé, max 5 vé/ngày)\n" +
                "• `ve so` | `check ve` | `jackpot`: Xem các vé đã mua và hũ Jackpot hiện tại\n" +
                "• `kqxs` | `xo so`: Xem bảng vàng kết quả kỳ quay gần nhất",
                inline: false
            },
            { name: "🏆 SỰ KIỆN WORLD CUP 2026", value:
                "• `wc`: Xem danh sách kèo bóng đá đang mở cược\n" +
                "• `bat [mã] [A/B] [tiền]`: Đặt cược vào Đội A/B (Cược cộng dồn, tối đa 500k)\n" +
                "• `tientri [Đội 1] vs [Đội 2]`: Nhờ bạch tuộc Paul BotToan tiên tri tỉ số bựa\n" +
                "• `sut [tiền]`: Sút penalty cờ bạc x2 đối mặt BotToan (phát nhạc WC)\n" +
                "• `setwc` | `lockwc` | `chungwc` (chỉ Admin): Mở kèo, khóa cược, chung tiền hoàn cược",
                inline: false
            },
            { name: "🎮 GAMING & VALORANT", value:
                "• `reg val [Tên#Tag]`: Liên kết Riot ID vào tài khoản\n" +
                "• `rank val` | `rank val [Tên#Tag]`: Tra cứu rank & thông số ELO\n" +
                "• `pick tuong` | `quay tuong`: Draft đội hình Valorant 5 người\n" +
                "• `toaan @User` | `lt @User`: Tòa án Gaming phân tích độ báo thủ và luận tội",
                inline: false
            },
            { name: "🎬 GIẢI TRÍ & WARMUP (MỚI)", value:
                "• `warmup` | `video`: Xem video giải trí khởi động trước trận đấu\n" +
                "• `warmup list`: Xem danh sách video hiện có\n" +
                "• `warmup add [Tiêu đề] | [Mô tả] | [Thể loại]` (Admin, đính kèm file/link): Thêm video\n" +
                "• `warmup edit [ID] | [Tiêu đề] | [Mô tả] | [Thể loại]` (Admin): Sửa thông tin hoặc Di chuyển thể loại\n" +
                "• `warmup delete [ID]` (Admin): Xóa video khỏi hệ thống",
                inline: false
            },
            { name: "🌸 GÓC CHỊ EM PHỤ NỮ (Viral)", value:
                "• `aura` | `mau van khi`: Bói màu vận khí hôm nay\n" +
                "• `thu bi mat` | `anonymous`: Gửi thư tỏ tình/bóc phốt ẩn danh qua DM bot\n" +
                "• `check dm`: Check hàng đợi duyệt thư ẩn danh công khai\n" +
                "• `tam trang` | `mood`: Nhật ký cảm xúc và nhận lời khuyên Tarot\n" +
                "• `overthink [tình huống]`: AI phân tích overthink 3 mức độ bựa\n" +
                "• `chot don [đồ] [giá]`: AI phán chốt hay cất món đồ đó\n" +
                "• `style` | `hom nay em la ai`: Xem vibe aesthetic hôm nay của bạn\n" +
                "• `mygu` | `doan mygu` | `mygu match`: Trắc nghiệm, bói gu, so khớp gu người yêu",
                inline: false
            },
            { name: "🔮 TÂM LINH & GHÉP ĐÔI", value:
                "• `tarot` | `boi tarot`: Rút bài Tarot hàng ngày\n" +
                "• `gieo que` | `xin que`: Gieo quẻ tình duyên tài lộc hàng ngày\n" +
                "• `crush` | `thich`: Khai báo đối tượng crush bí mật\n" +
                "• `ghep doi` | `ghep`: Ghép đôi ngẫu nhiên 2 người trong server\n" +
                "• `tham tu`: Thuê thám tử dò la xem ai đang thầm thương trộm nhớ mình\n" +
                "• `ban dung`: Bán đứng thông tin xem ai đang crush một người\n" +
                "• `bua yeu`: Mua bùa yêu ép duyên cưỡng bức (tăng tỉ lệ ghép đôi)",
                inline: false
            },
            { name: "🗣️ CHAT AI & VOICE HORN-BOT", value:
                "• `@BotToan [nội dung]`: Chat trực tiếp với Gemini AI thông minh mỏ hỗn\n" +
                "• `cam mom` | `im di` | `nin`: Tắt tiếng / di chuyển Horn-Bot welcome ra khỏi voice",
                inline: false
            },
            { name: "🎨 AI NHÌN ẢNH & TẠO ẢNH (Imagen 4 Ultra)", value:
                "• `@BotToan` + ảnh đính kèm: Bot tự động nhận xét ảnh bựa bựa (không tốn lượt)\n" +
                "• Reply vào tin có ảnh + tag @BotToan: Bot đọc ảnh từ tin được reply\n" +
                "• `vẽ [mô tả]` | `tạo ảnh [mô tả]`: Tạo ảnh AI chất lượng cao (3 lượt/ngày)\n" +
                "• `chỉnh ảnh [hướng dẫn]` + ảnh: Chỉnh sửa ảnh gốc (3 lượt/ngày)",
                inline: false
            }
        )
        .setFooter({ text: "Gõ lệnh bằng cách tag @BotToan + lệnh (Ví dụ: @BotToan diem danh) • BotToan User Manual" })
        .setTimestamp();

    await message.reply({ embeds: [embed] }).catch(() => {});
}

