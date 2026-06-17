import { Client, GatewayIntentBits, VoiceState } from 'discord.js';
import { 
    joinVoiceChannel, 
    createAudioPlayer, 
    createAudioResource, 
    AudioPlayerStatus, 
    VoiceConnectionStatus,
    entersState 
} from '@discordjs/voice';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http'; // Thêm thư viện http của Node.js

// 1. TẠO MÁY CHỦ WEB ẢO (Để lách luật Render)
const port = process.env.PORT || 8080;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write('Bot dang hoat dong binh thuong!');
    res.end();
}).listen(port, () => {
    console.log(`[WEB] Máy chủ ảo đang chạy trên port ${port}`);
});

// 2. KHỞI TẠO BOT DISCORD
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
            console.log(`[THÀNH CÔNG] Đã phát xong intro... Đang rời phòng.`);
            player.stop();
            connection.destroy();
        });

        player.on('error', error => {
            console.error(`[LỖI] Không thể phát nhạc:`, error.message);
            connection.destroy();
        });

    } catch (error) {
        console.error('[LỖI] Xảy ra sự cố khi kết nối:', error);
    }
});

client.login(TOKEN);