import { 
    Client, GatewayIntentBits, VoiceState, Message, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType 
} from 'discord.js';
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

// ================= BIẾN TRẠNG THÁI VÒNG QUAY =================
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

// ================= TÍNH NĂNG CHAT VÀ VÒNG QUAY =================
client.on('messageCreate', async (message: Message) => {
    if (message.author.bot || !client.user || !message.mentions.has(client.user)) return;

    const botId = client.user.id;
    const userQuestion = message.content.replace(new RegExp(`<@!?${botId}>`, 'g'), '').trim();
    if (!userQuestion) return;

    // ----------------- TÍNH NĂNG "CÂM" -----------------
    const shutUpTriggers = ['câm', 'câm mồm', 'im đi', 'im mồm'];
    if (shutUpTriggers.some(t => userQuestion.toLowerCase().includes(t))) {
        await message.reply("Biết rồi, tao câm đây!");
        return; 
    }

    // ----------------- TÍNH NĂNG PICK TƯỚNG (ROLE -> AGENT) -----------------
    const draftTriggers = ['quay tướng', 'chọn tướng', 'random tướng', 'pick tướng'];
    if (draftTriggers.some(t => userQuestion.toLowerCase().includes(t))) {
        if (isDrafting) {
            await message.reply("Đang pick dở kìa, tập trung chốt đi mày!");
            return;
        }

        isDrafting = true;
        currentDraft = [];
        agentPool = {
            "Duelist": [...fullAgentsByRole["Duelist"]],
            "Initiator": [...fullAgentsByRole["Initiator"]],
            "Controller": [...fullAgentsByRole["Controller"]],
            "Sentinel": [...fullAgentsByRole["Sentinel"]]
        };

        const draftMsg = await message.reply("🎲 **Bắt đầu Draft Team!** Đang setup bàn quay...");

        const collector = draftMsg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 300000 }); 

        const showRoleMenu = async (interaction?: any) => {
            const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('r_duelist').setLabel('⚔️ Duelist').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('r_initiator').setLabel('👁️ Initiator').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('r_controller').setLabel('💨 Controller').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('r_sentinel').setLabel('🛡️ Sentinel').setStyle(ButtonStyle.Primary)
            );
            const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('r_random').setLabel('🎲 Random Role').setStyle(ButtonStyle.Success)
            );

            const text = `🎯 **VỊ TRÍ THỨ ${currentDraft.length + 1}**: Mày muốn pick Role nào?\n*Đội hình: [ ${currentDraft.length > 0 ? currentDraft.join(' | ') : 'Chưa có ai'} ]*`;
            
            if (interaction) await interaction.update({ content: text, components: [row1, row2] }).catch(()=>{});
            else await draftMsg.edit({ content: text, components: [row1, row2] }).catch(()=>{});
        };

        const rollAgent = async (role: string, interaction: any) => {
            if (!agentPool[role] || agentPool[role].length === 0) agentPool[role] = [...fullAgentsByRole[role]];
            currentRole = role;
            
            const randomIndex = Math.floor(Math.random() * agentPool[role].length);
            currentAgent = agentPool[role][randomIndex];

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('a_chot').setLabel('✅ Chốt luôn').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('a_doi').setLabel('🔄 Bốc con khác').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('a_back').setLabel('🔙 Quay lại Role').setStyle(ButtonStyle.Secondary)
            );

            const text = `🎭 **VỊ TRÍ THỨ ${currentDraft.length + 1}** (${currentRole}): Bốc ra con **${currentAgent}**!\nChốt không hay chê?\n*Đội hình: [ ${currentDraft.length > 0 ? currentDraft.join(' | ') : 'Chưa có ai'} ]*`;
            await interaction.update({ content: text, components: [row] }).catch(()=>{});
        };

        collector.on('collect', async i => {
            const id = i.customId;
            
            if (id.startsWith('r_')) {
                let role = id.split('_')[1];
                if (role === 'random') {
                    const roles = ["Duelist", "Initiator", "Controller", "Sentinel"];
                    role = roles[Math.floor(Math.random() * roles.length)];
                } else {
                    role = role.charAt(0).toUpperCase() + role.slice(1); 
                }
                await rollAgent(role, i);
            } 
            else if (id === 'a_chot') {
                currentDraft.push(`${currentAgent} (${currentRole})`);
                agentPool[currentRole] = agentPool[currentRole].filter(a => a !== currentAgent); 
                
                if (currentDraft.length === 5) {
                    await i.update({ 
                        content: `🏆 **CHỐT XONG TEAM HỦY DIỆT** 🏆\n${currentDraft.map((v, idx) => `**${idx + 1}.** ${v}`).join('\n')}\n\n*Chuẩn bị vào game thôi!*`, 
                        components: [] 
                    }).catch(()=>{});
                    isDrafting = false;
                    collector.stop();
                } else {
                    await showRoleMenu(i); 
                }
            } 
            else if (id === 'a_doi') {
                agentPool[currentRole] = agentPool[currentRole].filter(a => a !== currentAgent); 
                await rollAgent(currentRole, i); 
            } 
            else if (id === 'a_back') {
                await showRoleMenu(i); 
            }
        });

        collector.on('end', collected => {
            if (isDrafting) {
                isDrafting = false;
                draftMsg.reply("Ngâm lâu quá đéo ai bấm, tao tự hủy bàn draft nhé!").catch(()=>{});
            }
        });

        await showRoleMenu();
        return; 
    }

    // ----------------- TÍNH NĂNG CHAT VỚI GEMINI -----------------
    await new Promise(resolve => setTimeout(resolve, 2000));

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
        
        const cleanText = responseText.replace(/https?:\/\/[^\s]+/g, "");

        const maxLength = 900;
        const chunks = cleanText.match(new RegExp('.{1,' + maxLength + '}(\\s|$)', 'g')) || [cleanText];

        for (const chunk of chunks) {
            if (chunk.trim()) {
                await message.reply(chunk.trim());
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    } catch (error) {
        await message.reply('Mạng lag hay sao ấy, tao đang không load được, thử lại đi mày!');
    }
});

// ================= TÍNH NĂNG CHÀO MỪNG VOICE (CHỈ NHẬN DIỆN ID CÓ FILE) =================
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

    // Lấy ID người dùng vừa join
    const userId = newState.member?.id;
    if (!userId) return;

    // Chỉ tìm file mang tên ID.mp3, bỏ đi file default.mp3
    const audioPath = path.join(__dirname, '../audio', `${userId}.mp3`);

    // NẾU KHÔNG CÓ FILE NHẠC TƯƠNG ỨNG VỚI ID ĐÓ -> BỎ QUA LUÔN (Không join vào phòng)
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

client.login(TOKEN);