import { Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ComponentType } from 'discord.js';
import { getMyGuData, saveMyGuData, getLastDoanGuDate, setLastDoanGuDate, getServerGuData, getVNDateString, getProfile } from '../database';
import { getRealGuReading, getGuMatchReading } from '../services/gemini';

// ============================================================
// =========== BỘ CÂU HỎI TRẮC NGHIỆM MÁY DÒ GU ============
// ============================================================

interface Question {
    text: string;
    options: { label: string; value: string; emoji?: string }[];
}

const QUESTIONS: Question[] = [
    {
        text: "Câu 1: Phong cách Diện mạo & Thời trang bạn muốn ở người ấy?",
        options: [
            { label: "Hệ chỉn chu, vuốt tóc, xịt nước hoa thơm phức (Mùi lừa tình).", value: "A", emoji: "👔" },
            { label: "Hệ Minimalist rách rưới: Quần short, áo loang lổ, đi dép crocs.", value: "B", emoji: "🩳" },
            { label: "Hệ Tri thức nửa mùa: Đeo kính cận, ngoan hiền thích gạ xem Netflix.", value: "C", emoji: "🤓" },
            { label: "Chỉ cần không hói, răng lợi đầy đủ, biết tắm rửa sạch sẽ.", value: "D", emoji: "🧼" }
        ]
    },
    {
        text: "Câu 2: Tần số \"Mỏ Hỗn\" & Giao tiếp thế nào?",
        options: [
            { label: "Ngoài lạnh trong nóng: Với thiên hạ thì câm, với mình thì nhắn tin cháy máy.", value: "A", emoji: "❄️" },
            { label: "Hệ mỏ hỗn vũ trụ: Mở mồm là vả nhau chan chát, không combat là ngứa mồm.", value: "B", emoji: "🗣️" },
            { label: "Hệ Thao túng tâm lý: Nói câu nào rót mật câu đấy, lươn lẹo dẻo mỏ.", value: "C", emoji: "🍯" },
            { label: "Hệ lười rep tin nhắn: Mất hút vài tiếng, hỏi thì quên điện thoại.", value: "D", emoji: "📴" }
        ]
    },
    {
        text: "Câu 3: Tính \"Toxic Ngầm\" nào bạn sẵn sàng dung túng?",
        options: [
            { label: "Chúa Tể Chiếm Hữu: Thích check phone, stalk sạch từ bạn bè đến nyc.", value: "A", emoji: "🕵️" },
            { label: "Overthink Overnight: Tự suy diễn, tự dỗi tự block, sáng ra lại bình thường.", value: "B", emoji: "🧩" },
            { label: "Chiến tranh lạnh: Gặp chuyện là im lặng, bắt mình tự đoán xem họ đang nghĩ gì.", value: "C", emoji: "🥶" },
            { label: "Vô tâm vô tri: Không biết dỗi, đầu óc trên mây, chung thủy vì... lười đổi.", value: "D", emoji: "🐠" }
        ]
    },
    {
        text: "Câu 4: Tiêu chuẩn Kinh tế & Cái ví?",
        options: [
            { label: "Hệ Ting Ting: Không thiếu gì ngoài tiền, chuyển khoản là cách nói yêu.", value: "A", emoji: "💸" },
            { label: "Hệ Sòng phẳng: Chia đôi đến từng nghìn lẻ, phải có mã giảm giá mới đi ăn.", value: "B", emoji: "📐" },
            { label: "Nghèo Sang Chảnh: Ví còn 50k vẫn rủ đi ăn buffet 500k quẹt thẻ tín dụng nợ ngập đầu.", value: "C", emoji: "💳" },
            { label: "Hệ Bám váy/Đào mỏ: \"Hôm nay bao em/anh nhé, tháng sau lãnh lương trả\".", value: "D", emoji: "🪜" }
        ]
    },
    {
        text: "Câu 5: Sở thích vô tri lúc rảnh rỗi?",
        options: [
            { label: "Nghiện cày game (Valorant, Tốc Chiến): Thà bỏ người yêu chứ không bỏ trận rank.", value: "A", emoji: "🎮" },
            { label: "Nghiện lướt TikTok: Ngồi cạnh nhau cắm mặt vào máy, share clip vô tri.", value: "B", emoji: "📱" },
            { label: "Cú đêm đi lượn: 12h đêm rủ đi ăn mì cay hóng biến, ngày ngủ bù như cá ươn.", value: "C", emoji: "🦉" },
            { label: "Mua sắm tâm linh: Suốt ngày xem bói Tarot, mua đá phong thủy dù nợ nần.", value: "D", emoji: "🔮" }
        ]
    },
    {
        text: "Câu 6: Phản ứng khi hai đứa xảy ra mâu thuẫn?",
        options: [
            { label: "Khóc lóc ăn vạ: Auto nhận sai xong khóc bù loa bắt dỗ ngược lại.", value: "A", emoji: "😭" },
            { label: "Combat tới bến: Cãi nhau như toà án, lôi chuyện 3 năm trước ra nhai lại.", value: "B", emoji: "🤺" },
            { label: "Mua đồ ăn chuộc lỗi: Trà sữa full topping ship đến là xoá bỏ lỗi lầm.", value: "C", emoji: "🧋" },
            { label: "Bỏ nhà đi bụi: Khóa máy đi nhậu với bạn bè mặc kệ mình lo sốt vó.", value: "D", emoji: "🍺" }
        ]
    }
];

// ============================================================
// =========== TÍNH NĂNG 1: LỆNH TRẮC NGHIỆM @BotToan mygu ===
// ============================================================

export async function handleMyGuQuiz(message: Message, rawInput: string): Promise<void> {
    const today = getVNDateString(Date.now());
    
    // Check xem có sub-command "list" hoặc "match" không
    const afterCmd = rawInput.replace(/^(mygu|gu)\s*/i, '').trim();
    if (afterCmd.toLowerCase().startsWith('list') || afterCmd.toLowerCase().startsWith('top')) {
        await handleMyGuList(message);
        return;
    }
    if (afterCmd.toLowerCase().startsWith('match')) {
        await handleMyGuMatch(message, afterCmd);
        return;
    }

    const userData = await getMyGuData(message.author.id);
    // Nếu hôm nay đã làm rồi thì cho phép xem lại kết quả cũ
    if (userData.lastMyGuDate === today && userData.myGuResultCache) {
        const cachedEmbed = parseResultToEmbed(userData.myGuResultCache, message.author.username, message.client.user?.displayAvatarURL() || '', today);
        await message.reply({
            content: `🔮 **Bạn đã làm trắc nghiệm gu hôm nay rồi!** Đây là kết quả đọc vị cũ của bạn trong ngày:`,
            embeds: [cachedEmbed]
        }).catch(() => {});
        return;
    }

    // Bắt đầu trắc nghiệm chọn Giới tính
    const introEmbed = new EmbedBuilder()
        .setTitle("🔮 HỆ THỐNG MÁY DÒ \"MY GU\" ĐA VŨ TRỤ")
        .setColor(0x7B2FBE)
        .setDescription("Chào mừng bạn đến với máy dò gu của BotToan.\nHãy chọn giới tính của bạn để bắt đầu làm trắc nghiệm!")
        .setFooter({ text: "Chỉ người gọi lệnh mới tương tác được • Hết hạn sau 60s" })
        .setTimestamp();

    const genderRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('mygu_gender_nam').setLabel('Tôi là Nam 🧑').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('mygu_gender_nu').setLabel('Tôi là Nữ 👩').setStyle(ButtonStyle.Danger)
    );

    const quizMessage = await message.reply({ embeds: [introEmbed], components: [genderRow] }).catch(() => null);
    if (!quizMessage) return;

    let gender = '';
    const answers: string[] = [];
    let currentIdx = 0;

    const collector = quizMessage.createMessageComponentCollector({
        filter: (i) => {
            if (i.user.id !== message.author.id) {
                i.reply({ content: "Né ra chỗ khác cho người ta chọn gu, vô duyên thế! 🙄", ephemeral: true }).catch(() => {});
                return false;
            }
            return true;
        },
        time: 60000 // 60 giây suy nghĩ
    });

    collector.on('collect', async (interaction) => {
        // Reset timeout
        collector.resetTimer();

        if (interaction.isButton()) {
            if (interaction.customId.startsWith('mygu_gender_')) {
                gender = interaction.customId === 'mygu_gender_nam' ? 'NAM' : 'NU';
                // Chuyển sang Câu 1
                await showQuestion(interaction, currentIdx, gender, answers);
            }
            return;
        }

        if (interaction.isStringSelectMenu()) {
            if (interaction.customId.startsWith('mygu_q_')) {
                const answer = interaction.values[0];
                answers.push(answer);
                currentIdx++;

                if (currentIdx < QUESTIONS.length) {
                    await showQuestion(interaction, currentIdx, gender, answers);
                } else {
                    // Đã hoàn thành 6 câu
                    collector.stop('completed');
                    await interaction.deferUpdate();

                    const answersCode = `${gender}_` + QUESTIONS.map((_, i) => `${i+1}${answers[i]}`).join('');
                    
                    // Kiểm tra Easter Eggs ẩn
                    const allD = answers.every(ans => ans === 'D');
                    const allB = answers.every(ans => ans === 'B');

                    let resultText = '';
                    if (allD) {
                        resultText = [
                            "HỆ NGƯỜI YÊU: Hệ Cá Ươn Lười Yêu 🐟",
                            "BỆNH LÝ LỤY TÌNH: Bạn thực sự siêu lười biếng. Bạn lười đến nỗi không thèm dỗi, đối phương làm gì cũng được, miễn là họ chung thủy (hoặc vì họ cũng quá lười để đổi bồ). Bạn thèm một mối quan hệ vô tri, hai đứa nằm cạnh nhau mỗi đứa một góc bấm điện thoại không thèm nói chuyện cả ngày.",
                            "MỘT NGÀY HẸN HÒ THỰC TẾ: Hai người hẹn nhau đi ăn mì cay lúc 11h đêm rồi về nằm như cá ươn, không có bất kỳ phản ứng lãng mạn nào.",
                            "TỈ LỆ SỐNG SÓT: 99%. Lời khuyên: Hai con cá ươn va vào nhau thì chỉ có nước nằm phơi nắng cả đời, chúc mừng bạn tìm được tri kỷ lười biếng giống mình!"
                        ].join('\n\n');
                    } else if (allB) {
                        resultText = [
                            "HỆ NGƯỜI YÊU: Chúa Tể Masochist 🪤",
                            "BỆNH LÝ LỤY TÌNH: Bạn nghiện ăn chửi và thích drama cực hạn. Cuộc sống bình yên quá làm bạn ngứa ngáy. Bạn phải tìm được người mỏ hỗn, thích dỗi, thích block vô cớ rồi sáng ra lại mở block như chưa có gì xảy ra để có cảm giác kịch tính.",
                            "MỘT NGÀY HẸN HÒ THỰC TẾ: Đi hẹn hò nhưng cãi nhau từ lúc dắt xe ra ngõ, combat toả khói ở quán buffet nhưng cuối buổi lại ship trà sữa dỗ dành nhau.",
                            "TỈ LỆ SỐNG SÓT: 10%. Lời khuyên: Tình yêu kiểu này sớm muộn gì cũng tổn thọ, đi mua bảo hiểm nhân thọ trước khi chốt đơn yêu nhé!"
                        ].join('\n\n');
                    } else {
                        // Gọi Gemini đọc vị
                        const answersSummary = QUESTIONS.map((q, i) => `${q.text} -> ${q.options.find(opt => opt.value === answers[i])?.label}`).join('\n');
                        try {
                            resultText = await getRealGuReading(answersSummary, message.author.username);
                        } catch {
                            resultText = [
                                "HỆ NGƯỜI YÊU: Hệ Vô Tri Tiêu Chuẩn 🤷‍♀️",
                                "BỆNH LÝ LỤY TÌNH: Gu của bạn khá cơ bản nhưng lại thích thêm chút muối drama cho đời bớt nhạt.",
                                "MỘT NGÀY HẸN HÒ THỰC TẾ: Đi xem phim rồi đi ăn trà sữa trò chuyện bình thường.",
                                "TỈ LỆ SỐNG SÓT: 50%. Lời khuyên: Yêu đương tỉnh táo lên cưng ơi!"
                            ].join('\n\n');
                        }
                    }

                    // Lưu dữ liệu
                    await saveMyGuData(message.author.id, answersCode, resultText, today);

                    const finalEmbed = parseResultToEmbed(resultText, message.author.username, message.client.user?.displayAvatarURL() || '', today);
                    await quizMessage.edit({
                        embeds: [finalEmbed],
                        components: []
                    }).catch(() => {});
                }
            }
        }
    });

    collector.on('end', async (_, reason) => {
        if (reason === 'time' && answers.length < QUESTIONS.length) {
            const timeoutEmbed = new EmbedBuilder()
                .setTitle("🔮 MÁY DÒ GU THẤT BẠI")
                .setColor(0xFF3B30)
                .setDescription("Chọn gu lâu như chọn nền văn minh, dẹp đi đừng yêu đương gì nữa! 🙄")
                .setTimestamp();
            await quizMessage.edit({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
        }
    });
}

// Helper hiển thị câu hỏi trắc nghiệm
async function showQuestion(interaction: any, idx: number, gender: string, answers: string[]): Promise<void> {
    const q = QUESTIONS[idx];
    const progress = `[${'■'.repeat(idx)}${'░'.repeat(QUESTIONS.length - idx)}] Câu ${idx + 1}/${QUESTIONS.length}`;

    const embed = new EmbedBuilder()
        .setTitle(`🔮 MÁY DÒ GU — GIỚI TÍNH: ${gender}`)
        .setColor(0x7B2FBE)
        .setDescription(`💬 **${q.text}**\n\n*Tiến độ: ${progress}*`)
        .setFooter({ text: "Hãy chọn phương án bên dưới" });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`mygu_q_${idx}`)
        .setPlaceholder('Chọn câu trả lời của bạn...')
        .addOptions(
            q.options.map(opt => ({
                label: opt.label.substring(0, 100),
                value: opt.value,
                emoji: opt.emoji
            }))
        );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
    await interaction.update({ embeds: [embed], components: [row] }).catch(() => {});
}

// Bóc tách text kết quả Gemini thành Embed
function parseResultToEmbed(text: string, username: string, avatarUrl: string, date: string): EmbedBuilder {
    const getPart = (key: string, nextKey?: string): string => {
        const regex = nextKey
            ? new RegExp(`${key}[\\s\\S]*?(?=${nextKey}|$)`, 'i')
            : new RegExp(`${key}[\\s\\S]*$`, 'i');
        const match = text.match(regex);
        if (!match) return '*Không rõ...*';
        return match[0].replace(new RegExp(key + '.*?:\n?', 'i'), '').trim();
    };

    const he = getPart('HỆ NGƯỜI YÊU', 'BỆNH LÝ LỤY TÌNH');
    const benhLy = getPart('BỆNH LÝ LỤY TÌNH', 'MỘT NGÀY HẸN HÒ THỰC TẾ');
    const henHo = getPart('MỘT NGÀY HẸN HÒ THỰC TẾ', 'TỈ LỆ SỐNG SÓT');
    const songSot = getPart('TỈ LỆ SỐNG SÓT');

    return new EmbedBuilder()
        .setTitle(`🔮 HỒ SƠ ĐỌC VỊ GU NGƯỜI YÊU — ${username.toUpperCase()}`)
        .setColor(0xEBCB8B)
        .setDescription(`👤 **Hệ Người Yêu:** **${he}**`)
        .addFields(
            { name: "🩺 Chẩn Đoán Bệnh Lý Lụy Tình", value: benhLy || "*...*", inline: false },
            { name: "🍿 Một Ngày Hẹn Hò Thực Tế", value: henHo || "*...*", inline: false },
            { name: "☠️ Tỉ Lệ Sống Sót & Lời Khuyên", value: songSot || "*...*", inline: false }
        )
        .setFooter({ text: `Báo cáo ngày ${date} • BotToan Máy Dò Đa Vũ Trụ`, iconURL: avatarUrl })
        .setTimestamp();
}

// ============================================================
// =========== TÍNH NĂNG 2: LỆNH ĐOÁN GU NHANH @BotToan doan mygu
// ============================================================

const DOAN_GU_ARCHETYPES = [
    "Hệ Phú Bà Quên Mật Khẩu SmartBanking 💸",
    "Hệ Trai Phố Cổ Thích Giảng Đạo Lý 🏰",
    "Hệ Trap Girl Phóng Xe Máy Điện Không Gương 🛵",
    "Hệ Tổng Tài Thẻ Tín Dụng Nợ Nhóm 3 💳",
    "Hệ Công Chúa Overthink Bán Hàng Online 🧠",
    "Hệ Bboy Hơi Nách Nhưng Chung Thủy 🕺",
    "Hệ Flexer Lương 5 Triệu Tiêu 15 Triệu 💰",
    "Hệ Báo Thủ Valorant Suốt Ngày Kêu Lag 🎮",
    "Hệ Gái Ngoan Thích Xem Phim Netflix Lúc 12h Đêm 🎬",
    "Hệ Người Yêu Hoàn Hảo Trong Trải Bài Tarot 🔮",
    "Hệ Boy Bánh Mì Dân Tổ Mỏ Hỗn 🥖",
    "Hệ Hướng Nội Part-time, Hướng Ngoại Khi Đi Bar 🥂",
    "Hệ Tổng Tài Cá Ươn Lười Rep Tin Nhắn 💤",
    "Hệ Thầy Bói Giang Hồ Chuyên Bói Tình Duyên 🃏",
    "Hệ Trap Boy Ngoan Hiền Ở Chùa Online 📿",
    "Hệ Phú Ông Tương Lai Đang Đi Vay Tiền Nợ 🏦",
    "Hệ Chiến Thần Combat Bỏ Nhà Đi Bụi 🍺",
    "Hệ Bồ Ngoan Chỉ Xin Ăn Trà Sữa Full Topping 🧋",
    "Hệ Chúa Tể Ghen Tuông Xem Hết Nhật Ký 🕵️",
    "Hệ Trí Thức Nửa Mùa Thích Nói Triết Lý 📖"
];

const PLACES = [
    "Hàng mì cay lúc 11h đêm",
    "Khu vực sảnh hóng drama của server",
    "Trong giấc mơ của bạn",
    "Tiệm mua sắm đá phong thủy nợ nần",
    "Phòng net cỏ hôi mùi khói thuốc",
    "Góc tối quán cà phê acoustic ôm điện thoại",
    "Vỉa hè trà chanh hóng biến xã hội",
    "Giường ngủ (hệ cá ươn lười vận động)"
];

export async function handleDoanMyGu(message: Message): Promise<void> {
    const today = getVNDateString(Date.now());

    // Radar loading 2 tầng để tránh rate limit Discord (cách nhau 1500ms như góp ý)
    const processMsg = await message.reply("📡 **Đang bắt sóng não... [📡📡░░░░░░░░] 20%**").catch(() => null);
    if (!processMsg) return;

    await new Promise(res => setTimeout(res, 1500));
    await processMsg.edit("🎭 **Đo lường độ lươn lẹo phong thủy... [🎭🎭🎭🎭🎭🎭🎭🎭░░] 80%**").catch(() => {});
    await new Promise(res => setTimeout(res, 1500));

    // Seed-based random
    let hash = 0;
    const seedStr = message.author.id + today + 'doangu';
    for (let i = 0; i < seedStr.length; i++) {
        hash = ((hash << 5) - hash) + seedStr.charCodeAt(i);
        hash |= 0;
    }
    const roll = Math.abs(hash);

    const archetype = DOAN_GU_ARCHETYPES[roll % DOAN_GU_ARCHETYPES.length];
    const place = PLACES[roll % PLACES.length];
    
    // Các chỉ số thuộc tính
    const chieuCao = (roll % 35) + 150; // 150cm - 184cm
    const moHon = roll % 101; // 0% - 100%
    const chungThuy = roll % 101; // 0% - 100%

    // Tạo thanh tiến trình
    const getBar = (pct: number): string => {
        const filled = Math.round(pct / 10);
        return '🟩'.repeat(filled) + '⬜'.repeat(10 - filled);
    };

    const embed = new EmbedBuilder()
        .setTitle(`📡 QUÉT GU VŨ TRỤ HÔM NAY — ${message.author.username.toUpperCase()}`)
        .setColor(0x34C759)
        .setDescription(`Vũ trụ đã bắt sóng được mẫu hình lý tưởng của bạn ngày hôm nay!`)
        .addFields(
            { name: "👑 Danh hiệu Gu Vũ Trụ", value: `**${archetype}**`, inline: false },
            { name: "📏 Chiều cao", value: `${getBar(Math.round(((chieuCao-150)/34)*100))} **${chieuCao} cm** *(Vừa vặn cốc đầu)*`, inline: false },
            { name: "🗣️ Độ mỏ hỗn", value: `${getBar(moHon)} **${moHon}%**`, inline: false },
            { name: "❤️ Độ chung thủy", value: `${getBar(chungThuy)} **${chungThuy}%**`, inline: false },
            { name: "📍 Tọa độ hay lui tới", value: place, inline: false }
        )
        .setFooter({ text: `Quét ngày ${today} • Kết quả cố định trong ngày • BotToan Radar`, iconURL: message.client.user?.displayAvatarURL() })
        .setTimestamp();

    await setLastDoanGuDate(message.author.id, today);
    await processMsg.delete().catch(() => {});
    await message.reply({ embeds: [embed] }).catch(() => {});
}

// ============================================================
// =========== TÍNH NĂNG 3: SO GU THỰC TẾ @BotToan mygu match @User
// ============================================================

export async function handleMyGuMatch(message: Message, afterCmd: string): Promise<void> {
    const mentionedUser = message.mentions.users.filter(u => u.id !== message.client.user?.id).first();
    if (!mentionedUser) {
        await message.reply("❌ **So gu cần tag đối tượng!** Ví dụ: `@BotToan mygu match @Crush`").catch(() => {});
        return;
    }

    if (mentionedUser.id === message.author.id) {
        await message.reply("❌ Tự so gu với chính mình? So xong thấy mình cô đơn gấp đôi à fen? 🙄").catch(() => {});
        return;
    }

    const myData = await getMyGuData(message.author.id);
    if (!myData || !myData.myGuCode) {
        await message.reply("❌ **Bạn chưa làm trắc nghiệm gu!** Hãy gõ `@BotToan mygu` để làm trắc nghiệm trước đã cưng.").catch(() => {});
        return;
    }

    const targetProfile = await getProfile(mentionedUser.id);
    if (!targetProfile || !targetProfile.gender) {
        await message.reply(`❌ Đối phương (<@${mentionedUser.id}>) chưa đăng ký hồ sơ bằng lệnh \`@BotToan profile\`! Bảo người ta đăng ký giới tính ngày sinh đi rồi mới so gu được nhé.`).catch(() => {});
        return;
    }

    const myName = message.member?.displayName || message.author.username;
    const targetName = message.guild?.members.cache.get(mentionedUser.id)?.displayName || mentionedUser.username;

    const processingMsg = await message.reply("🔮 *Đang bóc tách thông tin phong thủy thực tế để so khớp...*").catch(() => null);
    
    // Parse myGuCode ra text dễ đọc cho Gemini
    const codeParts = myData.myGuCode.replace(/^[A-Z]+_/, '');
    const cleanChoices = codeParts.match(/\d[A-D]/g) || [];
    const guSummary = cleanChoices.map(choice => {
        const qIdx = parseInt(choice.charAt(0)) - 1;
        const val = choice.charAt(1);
        const q = QUESTIONS[qIdx];
        const opt = q?.options.find(o => o.value === val);
        return `- ${q?.text.split(':')[0]}: ${opt?.label}`;
    }).join('\n');

    const targetProfileText = `Giới tính: ${targetProfile.gender}, Ngày sinh: ${targetProfile.birthday}, Tên: ${targetProfile.name || targetName}`;

    let matchReading = '';
    try {
        matchReading = await getGuMatchReading(myName, guSummary, targetName, targetProfileText);
    } catch {
        matchReading = "Hai bên có vẻ lệch sóng, vũ trụ khuyên bạn đi uống trà sữa một mình cho lành đầu óc.";
    }

    await processingMsg?.delete().catch(() => {});

    const embed = new EmbedBuilder()
        .setTitle(`🔮 SO GU ĐỜI THỰC — ${myName.toUpperCase()} & ${targetName.toUpperCase()}`)
        .setColor(0xFF6EB4)
        .setDescription(matchReading)
        .addFields(
            { name: `Gu mong muốn của ${myName}`, value: `\`${myData.myGuCode}\` (Đã lưu trắc nghiệm)`, inline: true },
            { name: `Profile thực tế của ${targetName}`, value: targetProfileText, inline: true }
        )
        .setFooter({ text: "BotToan Mai Mối Giang Hồ", iconURL: message.client.user?.displayAvatarURL() })
        .setTimestamp();

    await message.reply({ embeds: [embed] }).catch(() => {});
}

// ============================================================
// =========== TÍNH NĂNG 4: BẢNG BANG HỘI @BotToan mygu list ====
// ============================================================

export async function handleMyGuList(message: Message): Promise<void> {
    if (!message.guild) {
        await message.reply("❌ Lệnh này chỉ dùng được trong server thôi nha cưng!").catch(() => {});
        return;
    }

    // Lấy list ID thành viên đang có mặt trong server
    const memberIds = Array.from(message.guild.members.cache.keys());
    const guildGuData = await getServerGuData(memberIds);

    if (guildGuData.length === 0) {
        await message.reply("📊 **Chưa có bang phái nào được lập!** Hãy bảo mọi người gõ `@BotToan mygu` để làm trắc nghiệm lập hội đi nào! 🎉").catch(() => {});
        return;
    }

    // Phân nhóm
    const moHonGroup: string[] = []; // 2B
    const daoMoGroup: string[] = [];  // 4A hoặc 4C
    const caUonGroup: string[] = [];  // 2D hoặc 3D
    const overthinkGroup: string[] = []; // 3B

    for (const user of guildGuData) {
        const code = user.myGuCode;
        if (!code) continue;

        // Parse code: check 2B
        if (code.includes("2B")) moHonGroup.push(user.userId);
        // Check 4A hoặc 4C
        if (code.includes("4A") || code.includes("4C")) daoMoGroup.push(user.userId);
        // Check 2D hoặc 3D
        if (code.includes("2D") || code.includes("3D")) caUonGroup.push(user.userId);
        // Check 3B
        if (code.includes("3B")) overthinkGroup.push(user.userId);
    }

    const renderList = (ids: string[]): string => {
        if (ids.length === 0) return "*Chưa có thành viên nào gia nhập*";
        // Giới hạn 10 người mỗi nhóm để không tràn embed
        const sliced = ids.slice(0, 10);
        const listText = sliced.map((id, index) => `${index + 1}. <@${id}>`).join('\n');
        return ids.length > 10 ? `${listText}\n*và ${ids.length - 10} thành viên khác...*` : listText;
    };

    const embed = new EmbedBuilder()
        .setTitle(`🚨 BAN CHẤP HÀNH CÁC HỘI NHÓM VÔ TRI — ${message.guild.name.toUpperCase()}`)
        .setColor(0x7B2FBE)
        .setDescription("Phân loại các thành viên theo xu hướng gu người yêu bệnh lý:")
        .addFields(
            { name: "🗣️ Bang Hội Nghiện Ăn Chửi (Gu Mỏ Hỗn)", value: renderList(moHonGroup), inline: false },
            { name: "💸 Liên Minh Thèm Ting Ting (Gu Phú Bà/Tổng Tài)", value: renderList(daoMoGroup), inline: false },
            { name: "📴 Gặp Nhau Mới Quấn - Lười Rep Tin Nhắn (Gu Cá Ưỡn)", value: renderList(caUonGroup), inline: false },
            { name: "🧩 Gia Tộc Drama Queen (Gu Overthink)", value: renderList(overthinkGroup), inline: false }
        )
        .setFooter({ text: `Đã thống kê ${guildGuData.length} thành viên đã khai báo gu • BotToan Census`, iconURL: message.client.user?.displayAvatarURL() })
        .setTimestamp();

    await message.reply({ embeds: [embed] }).catch(() => {});
}
