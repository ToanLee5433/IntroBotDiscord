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
}).listen(port, () => {
    console.log(`[WEB] Máy chủ ảo đang chạy trên port ${port}`);
});

// 2. LẤY BIẾN MÔI TRƯỜNG TỪ RENDER
const TOKEN = process.env.DISCORD_TOKEN;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

if (!TOKEN || !GEMINI_KEY) {
    console.error("[LỖI] Thiếu DISCORD_TOKEN hoặc GEMINI_API_KEY trong Environment Variables!");
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
    console.log(`[THÀNH CÔNG] Bot đã sẵn sàng với tư cách: ${client.user?.tag}`);
});

// ================= TÍNH NĂNG CHAT VỚI GEMINI =================
client.on('messageCreate', async (message: Message) => {
    // Bỏ qua tin nhắn của bot
    if (message.author.bot) return;
    
    // Chỉ kích hoạt khi bắt đầu bằng "bot ơi" (không phân biệt hoa/thường)
    if (!message.content.toLowerCase().startsWith('bot ơi')) return;

    // Lọc lấy nội dung câu hỏi
    const userQuestion = message.content.replace(/bot ơi/i, '').trim();
    if (!userQuestion) return;

    try {
        // Kiểm tra xem kênh có hỗ trợ gõ phím không để tránh lỗi TypeScript
        if (message.channel.isTextBased()) {
            await message.channel.sendTyping();
        }

        // SỬ DỤNG MODEL GÓI FREE NGON NHẤT: gemini-3.1-flash-lite
        const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
        const result = await model.generateContent(userQuestion);
        const responseText = result.response.text();

        // Discord giới hạn 2000 ký tự, xử lý tin nhắn quá dài
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
    
    // CƠ CHẾ 1: Tự động rời phòng nếu phòng cũ bị TRỐNG
    if (oldState.channelId) {
        const oldChannel = oldState.channel;
        if (oldChannel) {
            // Đếm số lượng user thật (không tính bot)
            const realUsers = oldChannel.members.filter(m => !m.user.bot).size;
            
            if (realUsers === 0) {
                const connection = getVoiceConnection(oldChannel.guild.id);
                // Đảm bảo bot đang ở đúng cái phòng trống đó thì mới thoát
                if (connection && connection.joinConfig.channelId === oldChannel.id) {
                    console.log(`[THÔNG TIN] Phòng ${oldChannel.name} đã trống. Bot đang dọn dẹp và rời đi...`);
                    connection.destroy();
                    // KHÔNG DÙNG return ở đây để bot có thể chạy tiếp xuống dưới nếu user vừa nhảy sang phòng mới
                }
            }
        }
    }

    // CƠ CHẾ 2: Phát nhạc độc quyền khi có người VÀO PHÒNG MỚI
    if (newState.member?.user.bot) return; // Không chào bot khác
    if (oldState.channelId === newState.channelId) return; // Không tính vụ bật/tắt mic
    if (!newState.channelId) return; // Không tính vụ rời phòng (disconnect)

    const channel = newState.channel;
    if (!channel) return;

    const userId = newState.member?.id;
    console.log(`[THÔNG TIN] Sếp ${newState.member?.user.username} vừa vào phòng: ${channel.name}`);

    // Tìm nhạc riêng theo ID, nếu không có thì dùng default.mp3
    let audioPath = path.join(__dirname, '../audio', `${userId}.mp3`);
    if (!fs.existsSync(audioPath)) {
        audioPath = path.join(__dirname, '../audio', 'default.mp3');
    }
    
    // Nếu vẫn không có file default thì báo lỗi và dừng lại
    if (!fs.existsSync(audioPath)) {
        console.log(`[LỖI] Không tìm thấy bất kỳ file nhạc nào (kể cả default.mp3)!`);
        return;
    }

    try {
        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
        });

        // Đợi kết nối ổn định (tối đa 10s)
        await entersState(connection, VoiceConnectionStatus.Ready, 10000);
        
        const player = createAudioPlayer();
        const resource = createAudioResource(audioPath);

        player.play(resource);
        connection.subscribe(player);

        player.on(AudioPlayerStatus.Idle, () => {
            console.log(`[THÀNH CÔNG] Đã phát xong nhạc chào mừng cho ${newState.member?.user.username}. Bot sẽ ở lại chờ chỉ thị tiếp theo.`);
            player.stop();
        });

        player.on('error', error => {
            console.error(`[LỖI VOICE PLAYER]:`, error.message);
        });

    } catch (error) {
        console.error('[LỖI KẾT NỐI VOICE]:', error);
    }
});

// KÍCH HOẠT BOT
client.login(TOKEN);
