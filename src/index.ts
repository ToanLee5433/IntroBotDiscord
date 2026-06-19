import { 
    Client, GatewayIntentBits, VoiceState, Message, EmbedBuilder
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
import { playValorantDraft } from './games/valorant';
import { playXocDia } from './games/xocdia';
import { playBlackjack } from './games/blackjack';
import { playTaiXiu } from './games/taixiu';
import { handleLixi } from './games/lixi';
import { playRussianRoulette } from './games/russianroulette';
import { chatWithGemini } from './services/gemini';


import { sleep, removeAccents } from './utils';
import { connectDB, claimDaily, getLeaderboard, transferMoney, borrowMoney, getBalancesAndDebts, getAllBalancesAndDebts } from './database';



// 1. MÁY CHỦ WEB ẢO LÁCH LUẬT RENDER
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write('BotToan dang hoat dong binh thuong!');
    res.end();
}).listen(PORT, () => {
    console.log(`[WEB] Máy chủ ảo đang chạy trên port ${PORT}`);
});

if (!TOKEN) {
    console.error("[LỖI] Thiếu Discord TOKEN trong cấu hình!");
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

// ================= LẮNG NGHE LỆNH & CHAT =================
client.on('messageCreate', async (message: Message) => {
    if (message.author.bot || !client.user || !message.mentions.has(client.user)) return;

    const botId = client.user.id;
    const rawInput = message.content.replace(new RegExp(`<@!?${botId}>`, 'g'), '').trim();
    const cleanInput = removeAccents(rawInput).toLowerCase();
    
    // ----------------- TÍNH NĂNG "CÂM" -----------------
    const shutUpTriggers = ['cam', 'cam mom', 'im di', 'im mom'];
    if (shutUpTriggers.some(t => cleanInput.includes(t))) {
        await message.reply("Biết rồi, tao câm đây!");
        return; 
    }

    // ----------------- TÍNH NĂNG VAY NGÂN HÀNG -----------------
    const borrowTriggers = ['vay ngan hang', 'vay tien', 'vay no'];
    if (borrowTriggers.some(t => cleanInput.includes(t))) {
        const result = await borrowMoney(message.author.id);
        await message.reply(result.message);
        return;
    }

    // ----------------- TÍNH NĂNG ĐIỂM DANH TÀI SẢN -----------------
    const checkWalletTriggers = ['tai san', 'vi tien', 'check tien', 'bop tien', 'vi', 'tai san'];
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
                outputText += `- **${name}**: Ví: **${r.balance}k** | Nợ: **${r.debt}k**\n`;
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
                    outputText += `- **${name}**: Ví: **${r.balance}k** | Nợ: **${r.debt}k**\n`;
                }
            }
        }
        await message.reply(outputText);
        return;
    }

    // ----------------- TÍNH NĂNG ĐIỂM DANH HÀNG NGÀY -----------------
    if (cleanInput === 'diem danh' || cleanInput === 'daily') {
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

    // ----------------- TÍNH NĂNG BẢNG XẾP HẠNG -----------------
    if (cleanInput === 'top' || cleanInput === 'bxh') {
        const { rich, poor } = await getLeaderboard();
        
        let richText = "";
        for (let i = 0; i < rich.length; i++) {
            richText += `**${i + 1}.** <@${rich[i].userId}>: **${rich[i].balance}k**\n`;
        }
        if (!richText) richText = "*Chưa có dữ liệu người chơi.*";

        let poorText = "";
        for (let i = 0; i < poor.length; i++) {
            poorText += `**${i + 1}.** <@${poor[i].userId}>: **${poor[i].balance}k**\n`;
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
    const transferRegex = /^(chuyen|pay)\s+(\d+)(k)?\s+(?:cho\s+)?<@!?(\d+)>/i;
    const match = cleanInput.match(transferRegex);
    if (match) {
        const amount = parseInt(match[2]);
        const receiverId = match[4];
        const senderId = message.author.id;

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

    // ----------------- TÍNH NĂNG PHÁT LÌ XÌ CƯỚP GIẬT -----------------
    const lixiRegex = /^(lixi|li xi)\s+(\d+)(k)?\s+(?:cho\s+)?(\d+)\s*(?:dua|nguoi|thang|em|con)?/i;
    const lixiMatch = cleanInput.match(lixiRegex);
    if (lixiMatch) {
        const amount = parseInt(lixiMatch[2]);
        const maxPeople = parseInt(lixiMatch[4]);
        await handleLixi(message, amount, maxPeople);
        return;
    }

    // ----------------- TÍNH NĂNG GAME VÒNG QUAY TỬ THẦN -----------------
    const rrRegex = /^(roulette|tu than)(?:\s+(\d+)(k)?)?/i;
    const rrMatch = cleanInput.match(rrRegex);
    if (rrMatch) {
        const betAmount = rrMatch[2] ? parseInt(rrMatch[2]) : 20; // mặc định 20k
        await playRussianRoulette(message, betAmount);
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

    // ----------------- TÍNH NĂNG PICK TƯỚNG VALORANT -----------------
    const draftTriggers = ['quay tuong', 'chon tuong', 'random tuong', 'pick tuong'];
    if (draftTriggers.some(t => cleanInput.includes(t))) {
        await playValorantDraft(message);
        return;
    }

    // ----------------- TÍNH NĂNG CHAT VỚI GEMINI -----------------
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

    const audioPath = path.join(__dirname, '../audio', `${userId}.mp3`);

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
        player.on(AudioPlayerStatus.Idle, () => player.stop());
        
    } catch (error) {
        console.error('Lỗi voice:', error);
    }
});

(async () => {
    await connectDB();
    await loadAgentIcons();
    client.login(TOKEN);
})();
