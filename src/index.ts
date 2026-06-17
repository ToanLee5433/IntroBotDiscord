import { Client, GatewayIntentBits, VoiceState, Message } from 'discord.js';
import { 
    joinVoiceChannel, createAudioPlayer, createAudioResource, 
    AudioPlayerStatus, VoiceConnectionStatus, entersState, getVoiceConnection
} from '@discordjs/voice';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';

// 1. MÁY CHỦ WEB ẢO LÁCH LUẬT RENDER
const port = process.env.PORT || 8080;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write('Bot dang hoat dong binh thuong!');
    res.end();
}).listen(port);

// 2. LẤY BIẾN MÔI TRƯỜNG
const TOKEN = process.env.DISCORD_TOKEN;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

if (!TOKEN || !GEMINI_KEY) {
    console.error("[LỖI] Thiếu DISCORD_TOKEN hoặc GEMINI_API_KEY!");
    process.exit(1);
}

// Khởi tạo Gemini AI
const genAI = new GoogleGenerativeAI(GEMINI_KEY);

// Khởi tạo Discord Bot
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

client.once('clientReady', () => {
    console.log(`[THÀNH CÔNG] Bot đã sẵn sàng với tư cách: ${client.user?.tag}`);
});

// ================= TÍNH NĂNG CHAT VỚI GEMINI =================
client.on('messageCreate', async (message: Message) => {
    if (message.author.bot) return;
    if (!message.content.toLowerCase().startsWith('bot ơi')) return;

    const userQuestion = message.content.replace(/bot ơi/i, '').trim();
    if (!userQuestion) return;

    try {
        await message.channel.sendTyping();
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(userQuestion);
        const responseText = result.response.text();

        if (responseText.length > 2000) {
            await message.reply(responseText.substring(0, 1995) + '...');
        } else {
            await message.reply(responseText);
        }
    } catch (error) {
        console.error('[LỖI GEMINI]:', error);
        await message.reply('Xin lỗi, mạch suy nghĩ của tôi đang bị gián đoạn, hãy thử lại sau nhé!');
    }
});

// ================= TÍNH NĂNG CHÀO MỪNG VOICE =================
client.on('voiceStateUpdate', async (oldState: VoiceState, newState: VoiceState) => {
    // Cơ chế 1: Tự động rời phòng nếu phòng cũ bị TRỐNG
    if (oldState.channelId) {
        const oldChannel = oldState.channel;
        if (oldChannel) {
            const realUsers = oldChannel.members.filter(m => !m.user.bot).size;
            if (realUsers === 0) {
                const connection = getVoiceConnection(oldChannel.guild.id);
                if (connection && connection.joinConfig.channelId === oldChannel.id) {
                    console.log(`[THÔNG TIN] Phòng ${oldChannel.name} trống. Bot đang rời phòng cũ...`);
                    connection.destroy();
                    // ĐÃ XÓA chữ return; tại đây để code chạy tiếp xuống dưới!
                }
            }
        }
    }

    // Cơ chế 2: Phát nhạc chào mừng khi có người VÀO PHÒNG MỚI
    if (newState.member?.user.bot) return;
    if (oldState.channelId === newState.channelId) return;
    if (!newState.channelId) return;

    const channel = newState.channel;
    if (!channel) return;

    const userId = newState.member?.id;
    console.log(`[THÔNG TIN] Người dùng ${newState.member?.user.username} vừa vào phòng: ${channel.name}`);

    let audioPath = path.join(__dirname, '../audio', `${userId}.mp3`);
    if (!fs.existsSync(audioPath)) {
        audioPath = path.join(__dirname, '../audio', 'default.mp3');
    }
    if (!fs.existsSync(audioPath)) return;

    try {
        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
        });

        await entersState(connection, VoiceConnectionStatus.Ready, 10000);
        const player = createAudioPlayer();
        const resource = createAudioResource(audioPath);

        player.play(resource);
        connection.subscribe(player);

        player.on(AudioPlayerStatus.Idle, () => {
            player.stop();
        });
    } catch (error) {
        console.error('[LỖI VOICE]:', error);
    }
});

client.login(TOKEN);
