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

// ================= BIẾN TRẠNG THÁI VÒNG QUAY VALORANT =================
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

// ================= BIẾN TRẠNG THÁI MINI GAME BẦU CUA MULTIPLAYER =================
const playerBalances: { [userId: string]: number } = {};
const bauCuaSymbols = ["Bầu", "Cua", "Tôm", "Cá", "Gà", "Nai"];
const bauCuaEmojis: { [key: string]: string } = {
    "Bầu": "🎃", "Cua": "🦀", "Tôm": "🦐", "Cá": "🐟", "Gà": "🐓", "Nai": "🦌"
};
let isBauCuaActive = false;
let bauCuaHost = "";
let bauCuaBets: { [userId: string]: { name: string, symbol: string, amount: number }[] } = {};

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

    // ----------------- TÍNH NĂNG GAME "BẦU CUA MULTIPLAYER" -----------------
    if (userQuestion.toLowerCase().includes('bầu cua')) {
        if (isBauCuaActive) {
            await message.reply("Đang có một sòng mở rồi, vào đó mà theo đi con bạc!");
            return;
        }

        isBauCuaActive = true;
        bauCuaHost = message.author.id;
        bauCuaBets = {}; // Xóa lịch sử cược ván cũ

        const draftMsg = await message.reply("🎲 **SÒNG BẦU CUA CHÍNH THỨC MỞ!**\nAnh em bơi hết vào đây đặt cược. Đang trải chiếu...");
        const collector = draftMsg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120000 }); // Sòng tồn tại tối đa 2 phút

        const updateBoard = async (interaction?: any) => {
            const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('bc_Bầu').setLabel('🎃 Bầu').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('bc_Cua').setLabel('🦀 Cua').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('bc_Tôm').setLabel('🦐 Tôm').setStyle(ButtonStyle.Primary)
            );
            const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('bc_Cá').setLabel('🐟 Cá').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('bc_Gà').setLabel('🐓 Gà').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('bc_Nai').setLabel('🦌 Nai').setStyle(ButtonStyle.Success)
            );
            const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('bc_mobat').setLabel('🎲 MỞ BÁT! (Chỉ Host bấm)').setStyle(ButtonStyle.Danger)
            );

            // Gom nhóm và hiển thị ai đặt gì
            let betSummary = "📝 **TÌNH HÌNH GỬI GẠO:**\n";
            if (Object.keys(bauCuaBets).length === 0) {
                betSummary += "*Chưa có mống nào xuống tiền...*";
            } else {
                for (const uid in bauCuaBets) {
                    const userBets = bauCuaBets[uid];
                    const summary = userBets.reduce((acc, curr) => {
                        acc[curr.symbol] = (acc[curr.symbol] || 0) + curr.amount;
                        return acc;
                    }, {} as any);
                    
                    const betStrings = Object.entries(summary).map(([sym, amt]) => `${bauCuaEmojis[sym]} ${sym} (**${amt}k**)`);
                    // Hiển thị thêm số lượt đã đặt / tổng 3 lượt
                    betSummary += `- **${userBets[0].name}** (${userBets.length}/3 lượt): ${betStrings.join(', ')}\n`;
                }
            }

            const text = `🎲 **SÒNG BẦU CUA ĐANG MỞ!** 🎲\n👉 Bấm để đặt **10k/nháy**. Giới hạn: **3 lượt đặt/người** (có thể cược trùng 1 con).\n👑 Host <@${bauCuaHost}> chốt sổ thì bấm Mở Bát!\n\n${betSummary}`;
            
            if (interaction) await interaction.update({ content: text, components: [row1, row2, row3] }).catch(()=>{});
            else await draftMsg.edit({ content: text, components: [row1, row2, row3] }).catch(()=>{});
        };

        collector.on('collect', async i => {
            const uid = i.user.id;
            const uname = i.user.displayName || i.user.username;

            // Xử lý nút Mở Bát
            if (i.customId === 'bc_mobat') {
                if (uid !== bauCuaHost) {
                    await i.reply({ content: "Mày đéo phải chủ sòng, xê ra cho Host mở bát!", ephemeral: true }).catch(()=>{});
                    return;
                }

                // Lắc bầu cua
                const result = [
                    bauCuaSymbols[Math.floor(Math.random() * 6)],
                    bauCuaSymbols[Math.floor(Math.random() * 6)],
                    bauCuaSymbols[Math.floor(Math.random() * 6)]
                ];

                let resultText = `🎲 **KẾT QUẢ:** ${result.map(s => bauCuaEmojis[s]).join(' - ')} \n\n`;
                
                // Tính tiền
                if (Object.keys(bauCuaBets).length === 0) {
                    resultText += "Chả có mống nào chơi, sòng ế vc!";
                } else {
                    for (const playerId in bauCuaBets) {
                        let totalWon = 0;
                        let totalLost = 0;
                        const userBets = bauCuaBets[playerId];
                        
                        userBets.forEach(bet => {
                            let matches = result.filter(r => r === bet.symbol).length;
                            if (matches > 0) {
                                const winAmt = bet.amount + (bet.amount * matches); // Trả vốn + Tiền ăn
                                playerBalances[playerId] += winAmt;
                                totalWon += (bet.amount * matches);
                            } else {
                                totalLost += bet.amount;
                            }
                        });

                        const balance = playerBalances[playerId];
                        if (totalWon > totalLost) {
                            resultText += `🤑 **${userBets[0].name}** húp được **${totalWon - totalLost}k** (Đang có ${balance}k)\n`;
                        } else if (totalLost > totalWon) {
                            resultText += `💸 **${userBets[0].name}** cúng cho cái **${totalLost - totalWon}k** (Đang có ${balance}k)\n`;
                        } else {
                            resultText += `⚖️ **${userBets[0].name}** hòa vốn! (Đang có ${balance}k)\n`;
                        }
                    }
                }

                resultText += `\n*Muốn gỡ? Tag tao gọi "bầu cua" ván mới!*`;
                await i.update({ content: resultText, components: [] }).catch(()=>{});
                
                isBauCuaActive = false;
                collector.stop();
                return;
            }

            // Xử lý nút Đặt Cược
            if (i.customId.startsWith('bc_')) {
                const betSymbol = i.customId.split('_')[1];
                
                // Nạp vốn tự động nếu hết hoặc chưa có (Cho 100k)
                if (!playerBalances[uid] || playerBalances[uid] <= 0) {
                    playerBalances[uid] = 100; 
                }

                // Hết sạch tiền thì báo lỗi riêng
                if (playerBalances[uid] < 10) {
                    await i.reply({ content: "Mày cháy túi rồi con giời, hóng thôi đừng bấm nữa!", ephemeral: true }).catch(()=>{});
                    return;
                }

                // GIỚI HẠN: Mỗi người chỉ được đặt tối đa 3 ván (tương đương 30k)
                if (bauCuaBets[uid] && bauCuaBets[uid].length >= 3) {
                    await i.reply({ content: "Mỗi ván mày chỉ được đặt tối đa 3 phát (30k) thôi con tham này! Đợi mở bát đi.", ephemeral: true }).catch(()=>{});
                    return;
                }

                // Trừ tiền cược
                playerBalances[uid] -= 10;
                
                if (!bauCuaBets[uid]) bauCuaBets[uid] = [];
                bauCuaBets[uid].push({ name: uname, symbol: betSymbol, amount: 10 });

                await updateBoard(i);
            }
        });

        collector.on('end', () => {
            if (isBauCuaActive) {
                isBauCuaActive = false;
                draftMsg.reply("Sòng đóng cửa vì chủ sòng chạy trốn, hoàn lại tiền cho anh em!").catch(()=>{});
            }
        });

        await updateBoard();
        return; 
    }

    // ----------------- TÍNH NĂNG PICK TƯỚNG VALORANT -----------------
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

        const draftMsg = await message.reply("🎲 **Bắt đầu Draft Team Valorant!** Đang setup bàn quay...");
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

client.login(TOKEN);
