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
    res.write('BotToan dang hoat dong binh thuong!');
    res.end();
}).listen(port, () => {
    console.log(`[WEB] Máy chủ ảo đang chạy trên port ${port}`);
});

// 2. LẤY BIẾN MÔI TRƯỜNG TỪ RENDER
const TOKEN = process.env.DISCORD_TOKEN;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

if (!TOKEN || !GEMINI_KEY) {
    console.error("[LỖI] Thiếu DISCORD_TOKEN hoặc GEMINI_API_KEY!");
    process.exit(1);
}

// Khởi tạo Gemini AI
const genAI = new GoogleGenerativeAI(GEMINI_KEY);

// Khởi tạo Discord Bot với đầy đủ quyền
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

client.once('clientReady', () => {
    console.log(`[THÀNH CÔNG] Bot đã sẵn sàng: ${client.user?.tag}`);
});

// ================= TÍNH NĂNG CHAT VỚI GEMINI =================
client.on('messageCreate', async (message: Message) => {
    if (message.author.bot) return;
    if (!client.user) return;

    // CHỈ KÍCH HOẠT KHI BOT ĐƯỢC TAG (@BotToan)
    if (!message.mentions.has(client.user)) return;

    // Lọc bỏ tag ra khỏi tin nhắn để lấy nội dung câu hỏi
    const botId = client.user.id;
    const mentionRegex = new RegExp(`<@!?${botId}>`, 'g');
    const userQuestion = message.content.replace(mentionRegex, '').trim();

    if (!userQuestion) return;

    try {
        // Dùng 'as any' để ép TypeScript bỏ qua việc kiểm tra lỗi này
        if ('sendTyping' in message.channel) {
            await (message.channel as any).sendTyping();
        }

        const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
        const result = await model.generateContent(userQuestion);
        const responseText = result.response.text();

        if (responseText.length > 2000) {
            await message.reply(responseText.substring(0, 1995) + '...');
        } else {
            await message.reply(responseText);
        }
    } catch (error) {
        console.error('[LỖI GEMINI]:', error);
        await message.reply('Xin lỗi, tôi đang bị quá tải hoặc lỗi mạng. Hãy thử lại sau nhé!');
    }
});

// ================= TÍNH NĂNG CHÀO MỪNG VOICE =================
client.on('voiceStateUpdate', async (oldState: VoiceState, newState: VoiceState) => {
    if (newState.member?.user.bot) return;
    if (oldState.channelId === newState.channelId) return;

    const oldChannel = oldState.channel;
    const newChannel = newState.channel;

    // CƠ CHẾ 1: Dọn dẹp phòng cũ
    if (oldChannel) {
        const realUsers = oldChannel.members.filter(m => !m.user.bot).size;
        const connection = getVoiceConnection(oldChannel.guild.id);
        
        if (connection && connection.joinConfig.channelId === oldChannel.id && realUsers === 0) {
            // ĐÂY LÀ CHỖ FIX LỖI LỠ NHỊP!
            // Chỉ ngắt kết nối khi người dùng THOÁT HẲN KHỎI VOICE (không có newChannel).
            if (!newChannel) {
                console.log(`[THÔNG TIN] Phòng ${oldChannel.name} trống. Bot ngắt kết nối.`);
                connection.destroy();
                return;
            }
        }
    }

    // CƠ CHẾ 2: Vào phòng mới và phát nhạc
    if (!newChannel) return;

    const userId = newState.member?.id;
    console.log(`[THÔNG TIN] ${newState.member?.user.username} vừa vào phòng: ${newChannel.name}`);

    let audioPath = path.join(__dirname, '../audio', `${userId}.mp3`);
    if (!fs.existsSync(audioPath)) {
        audioPath = path.join(__dirname, '../audio', 'default.mp3');
    }
    
    if (!fs.existsSync(audioPath)) {
        console.log(`[LỖI] Không tìm thấy file nhạc.`);
        return;
    }

    try {
        // Lệnh joinVoiceChannel này sẽ tự động mang bot sang phòng mới cực mượt
        const connection = joinVoiceChannel({
            channelId: newChannel.id,
            guildId: newChannel.guild.id,
            adapterCreator: newChannel.guild.voiceAdapterCreator,
        });

        await entersState(connection, VoiceConnectionStatus.Ready, 10000);
        
        const player = createAudioPlayer();
        const resource = createAudioResource(audioPath);

        player.play(resource);
        connection.subscribe(player);

        player.on(AudioPlayerStatus.Idle, () => {
            player.stop();
        });

        player.on('error', error => {
            console.error(`[LỖI VOICE PLAYER]:`, error.message);
        });

    } catch (error) {
        console.error('[LỖI KẾT NỐI VOICE]:', error);
    }
});

client.login(TOKEN);