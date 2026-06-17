import { Client, GatewayIntentBits, VoiceState } from 'discord.js';
import { 
    joinVoiceChannel, 
    createAudioPlayer, 
    createAudioResource, 
    AudioPlayerStatus, 
    VoiceConnectionStatus,
    entersState,
    getVoiceConnection
} from '@discordjs/voice';
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

// 2. KHỞI TẠO BOT
const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
    console.error("[LỖI] Không tìm thấy biến môi trường DISCORD_TOKEN!");
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
    ]
});

client.once('clientReady', () => {
    console.log(`[THÀNH CÔNG] Bot đã sẵn sàng! Đang trực tuyến với tên: ${client.user?.tag}`);
});

client.on('voiceStateUpdate', async (oldState: VoiceState, newState: VoiceState) => {
    // Cơ chế 1: Tự động rời phòng nếu phòng TRỐNG (Không còn người dùng nào)
    if (oldState.channelId) {
        const oldChannel = oldState.channel;
        if (oldChannel) {
            // Đếm số người thực sự trong phòng (bỏ qua bot)
            const realUsers = oldChannel.members.filter(m => !m.user.bot).size;
            
            // Nếu không còn người nào trong phòng cũ, tìm kết nối của bot trong server đó và ngắt kết nối
            if (realUsers === 0) {
                const connection = getVoiceConnection(oldChannel.guild.id);
                if (connection && connection.joinConfig.channelId === oldChannel.id) {
                    console.log(`[THÔNG TIN] Phòng ${oldChannel.name} trống. Bot đang rời phòng...`);
                    connection.destroy();
                    return; // Dừng xử lý tiếp
                }
            }
        }
    }

    // Cơ chế 2: Phát nhạc chào mừng khi có người VÀO PHÒNG
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

    if (!fs.existsSync(audioPath)) {
        console.log(`[LỖI] Không tìm thấy file nhạc tại: ${audioPath}`);
        return;
    }

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
            console.log(`[THÀNH CÔNG] Đã phát xong intro cho ${newState.member?.user.username}. Giữ bot ở lại phòng.`);
            player.stop();
            // ĐÃ XÓA connection.destroy() tại đây để bot không bị out ra đột ngột nữa!
        });

        player.on('error', error => {
            console.error(`[LỖI] Không thể phát nhạc:`, error.message);
        });

    } catch (error) {
        console.error('[LỖI] Xảy ra sự cố khi kết nối:', error);
    }
});

client.login(TOKEN);
