import { 
    Client, GatewayIntentBits, VoiceState, Message, EmbedBuilder, PermissionFlagsBits
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
import { chatWithGemini } from './services/gemini';
import { fetchValorantRank } from './services/valorant';

import cron from 'node-cron';
import { sleep, removeAccents, formatMoney, parseMoneyInput } from './utils';
import { connectDB, claimDaily, getLeaderboard, transferMoney, borrowMoney, getBalancesAndDebts, getAllBalancesAndDebts, payDebt, registerValorantId, getValorantId, getChatBanExpires, dodgeDebt, banChat, buyLotteryTicket, getLotteryInfo, drawLottery } from './database';



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

// ================= THIẾT LẬP CRON QUAY SỐ 18:30 HÀNG NGÀY (MỚI) =================
cron.schedule('30 18 * * *', async () => {
    try {
        const now = Date.now();
        // Lấy ngày hôm nay theo múi giờ Việt Nam (UTC+7)
        const d = new Date(now + 7 * 60 * 60 * 1000);
        const dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
        
        const result = await drawLottery(dateStr);
        if (!result.success) return; // Đợt quay này đã được thực hiện hoặc có lỗi

        // Tạo Embed thông báo kết quả xổ số kiến thiết cực đẹp
        const embed = new EmbedBuilder()
            .setTitle("🎰 KẾT QUẢ XỔ SỐ KIẾN THIẾT BOTTOAN 🎰")
            .setColor(0xF1C40F)
            .setTimestamp();
            
        let desc = `📆 **Ngày quay thưởng:** \`${dateStr}\`\n`;
        desc += `🔮 **Con số may mắn ngày hôm nay:** 🎉 **${result.winningNumber}** 🎉\n`;
        desc += `💰 **Tổng hũ tích lũy Jackpot:** **${formatMoney(result.jackpotPool || 200)}**\n\n`;
        
        if (result.winners && result.winners.length > 0) {
            desc += `👑 **DANH SÁCH CHIẾN THẦN TRÚNG GIẢI:**\n`;
            for (const w of result.winners) {
                const totalPayout = (result.payoutPerTicket || 0) * w.ticketsCount;
                desc += `- <@${w.userId}> trúng **${w.ticketsCount} vé** -> nhận về **${formatMoney(totalPayout)}**!\n`;
            }
            desc += `\n*Hũ Jackpot đã được chia đều và reset về mốc khởi điểm **200.000đ** cho đợt ngày mai!*`;
        } else {
            desc += `💸 **Không có ai trúng thưởng giải đặc biệt ngày hôm nay!**\n*Toàn bộ hũ tích lũy **${formatMoney(result.jackpotPool || 200)}** sẽ được cộng dồn (Rollover) sang ngày mai! Cơ hội làm giàu đang lớn dần!*`;
        }
        
        embed.setDescription(desc);
        
        // Broadcast thông báo tới tất cả server
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
                    await (targetChannel as any).send({ embeds: [embed] }).catch(()=>{});
                }
            } catch (err) {
                console.error("Lỗi khi gửi kết quả xổ số kiến thiết:", err);
            }
        }
    } catch (error) {
        console.error("Lỗi tác vụ quay xổ số kiến thiết:", error);
    }
}, {
    timezone: "Asia/Ho_Chi_Minh"
} as any);

(async () => {
    await connectDB();
    await loadAgentIcons();
    registerValorantCollector(client);
    client.login(TOKEN);
})();
