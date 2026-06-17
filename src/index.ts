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

// ================= TÍNH NĂNG CHAT VỚI GEMINI (VĂN BẢN THUẦN + CỰC GẮT) =================
client.on('messageCreate', async (message: Message) => {
    if (message.author.bot || !client.user || !message.mentions.has(client.user)) return;

    // Đợi 2 giây cho HornBot nhận diện xong câu hỏi của bạn
    await new Promise(resolve => setTimeout(resolve, 2000));

    const botId = client.user.id;
    const userQuestion = message.content.replace(new RegExp(`<@!?${botId}>`, 'g'), '').trim();
    if (!userQuestion) return;

    try {
        if ('sendTyping' in message.channel) await (message.channel as any).sendTyping();

        const model = genAI.getGenerativeModel({ 
            model: "gemini-3.1-flash-lite",
            systemInstruction: `
                Bạn là BotToan, trợ lý Discord "bựa", hài hước, dùng từ lóng, cà khịa bạn bè.
                QUY TẮC: 
                1. Dùng Tiếng Việt, xưng hô mày-tao cho thân thiết.
                2. Phản hồi cực gắt, hài hước, bỗ bã nhưng không xúc phạm quá đà.
                3. TUYỆT ĐỐI KHÔNG GỬI LINK, URL. Chỉ trả lời bằng văn bản thuần túy.
                4. Độ dài: Tóm tắt cực ngắn, dưới 900 ký tự.
            `
        });

        const result = await model.generateContent(userQuestion);
        const responseText = result.response.text();
        
        // Loại bỏ hoàn toàn link nếu AI lỡ tay gửi
        const cleanText = responseText.replace(/https?:\/\/[^\s]+/g, "");

        // Chia nhỏ tin nhắn (900 ký tự) cho HornBot đọc an toàn
        const maxLength = 900;
        const chunks = cleanText.match(new RegExp('.{1,' + maxLength + '}(\\s|$)', 'g')) || [cleanText];

        for (const chunk of chunks) {
            if (chunk.trim()) {
                await message.reply(chunk.trim());
                // Delay 2 giây giữa các đoạn để HornBot đọc mượt
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    } catch (error) {
        await message.reply('Mạng lag hay sao ấy, tao đang không load được, thử lại đi mày!');
    }
});

// ================= TÍNH NĂNG CHÀO MỪNG VOICE (TỰ NHẬN DIỆN ID) =================
client.on('voiceStateUpdate', async (oldState: VoiceState, newState: VoiceState) => {
    if (newState.member?.user.bot || oldState.channelId === newState.channelId) return;

    const oldChannel = oldState.channel;
    const newChannel = newState.channel;

    // Cơ chế dọn dẹp phòng trống
    if (oldChannel) {
        const connection = getVoiceConnection(oldChannel.guild.id);
        if (connection && connection.joinConfig.channelId === oldChannel.id && oldChannel.members.filter(m => !m.user.bot).size === 0) {
            if (!newChannel) connection.destroy();
        }
    }

    if (!newChannel) return;

    try {
        const connection = joinVoiceChannel({
            channelId: newChannel.id,
            guildId: newChannel.guild.id,
            adapterCreator: newChannel.guild.voiceAdapterCreator,
        });

        await entersState(connection, VoiceConnectionStatus.Ready, 5000);
        
        // Logic tìm nhạc theo ID người dùng
        const audioPath = path.join(__dirname, '../audio', `${newState.member?.id}.mp3`);
        const playPath = fs.existsSync(audioPath) ? audioPath : path.join(__dirname, '../audio', 'default.mp3');

        if (fs.existsSync(playPath)) {
            const player = createAudioPlayer();
            player.play(createAudioResource(playPath));
            connection.subscribe(player);
            player.on(AudioPlayerStatus.Idle, () => player.stop());
        }
    } catch (error) {
        console.error('Lỗi voice:', error);
    }
});

client.login(TOKEN);