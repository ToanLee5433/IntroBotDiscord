"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseMyGuCode = parseMyGuCode;
exports.handleMyGuQuiz = handleMyGuQuiz;
exports.startQuizSession = startQuizSession;
exports.handleDoanMyGu = handleDoanMyGu;
exports.handleMyGuMatch = handleMyGuMatch;
exports.handleMyGuList = handleMyGuList;
exports.registerMyGuCollector = registerMyGuCollector;
const discord_js_1 = require("discord.js");
const lunar_javascript_1 = require("lunar-javascript");
const database_1 = require("../database");
const gemini_1 = require("../services/gemini");
const ghepdoi_1 = require("./ghepdoi");
const QUESTIONS = [
    {
        text: "Câu 1: Phong cách Diện mạo & Thời trang bạn muốn ở người ấy?",
        getOptions: (targetGender) => {
            if (targetGender === 'NAM') {
                return [
                    { label: "Hệ chỉn chu, vuốt tóc, xịt nước hoa thơm phức (Mùi lừa tình).", value: "A", emoji: "👔" },
                    { label: "Hệ Minimalist rách rưới: Quần short, áo loang lổ, đi dép crocs.", value: "B", emoji: "🩳" },
                    { label: "Hệ Tri thức nửa mùa: Đeo kính cận, ngoan hiền thích gạ xem Netflix.", value: "C", emoji: "🤓" },
                    { label: "Chỉ cần không hói, răng lợi đầy đủ, biết tắm rửa sạch sẽ.", value: "D", emoji: "🧼" }
                ];
            }
            else if (targetGender === 'NU') {
                return [
                    { label: "Hệ quyến rũ sang chảnh, tóc thơm mùi nhài, makeup lồng lộn.", value: "A", emoji: "💄" },
                    { label: "Hệ ngây thơ bánh bèo: Váy hoa nhí, kẹp tóc nơ, đi giày búp bê.", value: "B", emoji: "👗" },
                    { label: "Hệ tomboy cá tính: Quần túi hộp, nón snapback, nhìn ngầu lòi.", value: "C", emoji: "🧢" },
                    { label: "Chỉ cần da dẻ mịn màng, răng lợi đầy đủ, thơm tho sạch sẽ.", value: "D", emoji: "🧼" }
                ];
            }
            else {
                return [
                    { label: "Hệ chỉn chu, xịt nước hoa thơm phức (Mùi lừa tình).", value: "A", emoji: "✨" },
                    { label: "Hệ Minimalist rách rưới: Quần short, áo phông rộng, đi dép crocs.", value: "B", emoji: "🩳" },
                    { label: "Hệ Tri thức nửa mùa: Đeo kính cận, ngoan hiền thích gạ xem Netflix.", value: "C", emoji: "🤓" },
                    { label: "Chỉ cần răng lợi đầy đủ, không bị hôi nách, biết tắm rửa sạch sẽ.", value: "D", emoji: "🧼" }
                ];
            }
        }
    },
    {
        text: "Câu 2: Tần số \"Mỏ Hỗn\" & Giao tiếp thế nào?",
        getOptions: () => [
            { label: "Ngoài lạnh trong nóng: Với thiên hạ thì câm, với mình thì nhắn tin cháy máy.", value: "A", emoji: "❄️" },
            { label: "Hệ mỏ hỗn vũ trụ: Mở mồm là vả nhau chan chát, không combat là ngứa mồm.", value: "B", emoji: "🗣️" },
            { label: "Hệ Thao túng tâm lý: Nói câu nào rót mật câu đấy, lươn lẹo dẻo mỏ.", value: "C", emoji: "🍯" },
            { label: "Hệ lười rep tin nhắn: Mất hút vài tiếng, hỏi thì quên điện thoại.", value: "D", emoji: "📴" }
        ]
    },
    {
        text: "Câu 3: Tính \"Toxic Ngầm\" nào bạn sẵn sàng dung túng?",
        getOptions: () => [
            { label: "Chúa Tể Chiếm Hữu: Thích check phone, stalk sạch từ bạn bè đến nyc.", value: "A", emoji: "🕵️" },
            { label: "Overthink Overnight: Tự suy diễn, tự dỗi tự block, sáng ra lại bình thường.", value: "B", emoji: "🧩" },
            { label: "Chiến tranh lạnh: Gặp chuyện là im lặng, bắt mình tự đoán xem họ đang nghĩ gì.", value: "C", emoji: "🥶" },
            { label: "Vô tâm vô tri: Không biết dỗi, đầu óc trên mây, chung thủy vì... lười đổi.", value: "D", emoji: "🐠" }
        ]
    },
    {
        text: "Câu 4: Tiêu chuẩn Kinh tế & Cái ví?",
        getOptions: (targetGender) => {
            if (targetGender === 'NAM') {
                return [
                    { label: "Hệ Tổng tài ting ting: Không thiếu gì ngoài tiền, chuyển khoản là cách nói yêu.", value: "A", emoji: "💸" },
                    { label: "Hệ Sòng phẳng: Chia đôi đến từng nghìn lẻ, phải có mã giảm giá mới đi ăn.", value: "B", emoji: "📐" },
                    { label: "Nghèo Sang Chảnh: Ví còn 50k vẫn rủ đi ăn buffet 500k quẹt thẻ tín dụng nợ ngập đầu.", value: "C", emoji: "💳" },
                    { label: "Hệ bám váy/đào mỏ: 'Hôm nay bao anh nhé, tháng sau lãnh lương trả'.", value: "D", emoji: "🪜" }
                ];
            }
            else if (targetGender === 'NU') {
                return [
                    { label: "Hệ Phú bà ting ting: Thích mua sắm tặng quà, bao nuôi không tiếc tiền.", value: "A", emoji: "💸" },
                    { label: "Hệ Sòng phẳng: Chia đôi đến từng nghìn lẻ, phải có mã giảm giá mới đi ăn.", value: "B", emoji: "📐" },
                    { label: "Nghèo Sang Chảnh: Ví còn 50k vẫn rủ đi ăn buffet 500k quẹt thẻ tín dụng nợ ngập đầu.", value: "C", emoji: "💳" },
                    { label: "Hệ đào mỏ: 'Hôm nay bao em nhé, tháng sau lãnh lương trả'.", value: "D", emoji: "🪜" }
                ];
            }
            else {
                return [
                    { label: "Hệ ting ting bao nuôi: Không tiếc tiền chi cho người yêu.", value: "A", emoji: "💸" },
                    { label: "Hệ Sòng phẳng: Chia đôi đến từng nghìn lẻ, phải có mã giảm giá mới đi ăn.", value: "B", emoji: "📐" },
                    { label: "Nghèo Sang Chảnh: Ví còn 50k vẫn rủ đi ăn buffet 500k quẹt thẻ tín dụng nợ ngập đầu.", value: "C", emoji: "💳" },
                    { label: "Hệ đào mỏ/bám váy: Suốt ngày quên ví để đối phương phải bao.", value: "D", emoji: "🪜" }
                ];
            }
        }
    },
    {
        text: "Câu 5: Sở thích vô tri lúc rảnh rỗi?",
        getOptions: (targetGender) => {
            if (targetGender === 'NAM') {
                return [
                    { label: "Nghiện cày game (Valorant, Tốc Chiến): Thà bỏ người yêu chứ không bỏ trận rank.", value: "A", emoji: "🎮" },
                    { label: "Nghiện lướt TikTok: Ngồi cạnh nhau cắm mặt vào máy, share clip vô tri.", value: "B", emoji: "📱" },
                    { label: "Cú đêm đi lượn: 12h đêm rủ đi ăn mì cay hóng biến, ngày ngủ bù như cá ươn.", value: "C", emoji: "🦉" },
                    { label: "Mua sắm tâm linh: Suốt ngày xem bói Tarot, mua đá phong thủy dù nợ nần.", value: "D", emoji: "🔮" }
                ];
            }
            else if (targetGender === 'NU') {
                return [
                    { label: "Chúa tể cày phim: Khóc sướt mướt vì nam chính, thà cày phim chứ không cày game.", value: "A", emoji: "🎬" },
                    { label: "Nghiện lướt TikTok/Shopee: Săn deal, ngồi cạnh nhau share clip vô tri.", value: "B", emoji: "📱" },
                    { label: "Cú đêm đi lượn: 12h đêm rủ đi ăn mì cay hóng biến, ngày ngủ bù như cá ươn.", value: "C", emoji: "🦉" },
                    { label: "Mua sắm tâm linh: Suốt ngày xem bói Tarot, mua đá phong thủy dù nợ nần.", value: "D", emoji: "🔮" }
                ];
            }
            else {
                return [
                    { label: "Nghiện cày game hoặc cày phim: Suốt ngày dán mắt vào màn hình.", value: "A", emoji: "🎮" },
                    { label: "Nghiện lướt mạng xã hội: Ngồi cạnh nhau cắm mặt vào máy share clip vô tri.", value: "B", emoji: "📱" },
                    { label: "Cú đêm đi lượn: 12h đêm rủ đi ăn mì cay hóng biến, ngày ngủ bù như cá ươn.", value: "C", emoji: "🦉" },
                    { label: "Mua sắm tâm linh: Suốt ngày xem bói Tarot, mua đá phong thủy dù nợ nần.", value: "D", emoji: "🔮" }
                ];
            }
        }
    },
    {
        text: "Câu 6: Phản ứng khi hai đứa xảy ra mâu thuẫn?",
        getOptions: (targetGender) => {
            if (targetGender === 'NAM') {
                return [
                    { label: "Khóc lóc ăn vạ: Auto nhận sai xong khóc bù loa bắt dỗ ngược lại.", value: "A", emoji: "😭" },
                    { label: "Combat tới bến: Cãi nhau như toà án, lôi chuyện 3 năm trước ra nhai lại.", value: "B", emoji: "🤺" },
                    { label: "Mua đồ ăn chuộc lỗi: Trà sữa full topping ship đến là xoá bỏ lỗi lầm.", value: "C", emoji: "🧋" },
                    { label: "Bỏ nhà đi bụi: Khóa máy đi nhậu với bạn bè mặc kệ mình lo sốt vó.", value: "D", emoji: "🍺" }
                ];
            }
            else if (targetGender === 'NU') {
                return [
                    { label: "Khóc lóc ăn vạ: Bắt mình dỗ dành 2 tiếng đồng hồ mới chịu nín.", value: "A", emoji: "😭" },
                    { label: "Stalking & Dỗi hờn: Im lặng, hủy kết bạn, chặn số rồi sáng ra tự mở.", value: "B", emoji: "📴" },
                    { label: "Mua đồ ăn chuộc lỗi: Trà sữa full topping ship đến là xoá bỏ lỗi lầm.", value: "C", emoji: "🧋" },
                    { label: "Bỏ đi shopping: Quẹt thẻ của mình đi mua sắm xả stress mặc kệ mình.", value: "D", emoji: "🛍️" }
                ];
            }
            else {
                return [
                    { label: "Khóc lóc dỗi hờn: Muốn đối phương phải dỗ dành chiều chuộng.", value: "A", emoji: "😭" },
                    { label: "Combat tới bến: Cãi nhau nảy lửa, lôi chuyện cũ ra nhai đi nhai lại.", value: "B", emoji: "🤺" },
                    { label: "Trà sữa chuộc lỗi: Full topping ship đến là mọi tội lỗi được tha thứ.", value: "C", emoji: "🧋" },
                    { label: "Khóa máy bỏ đi: Im lặng biến mất mặc kệ đối phương lo sốt vó.", value: "D", emoji: "📴" }
                ];
            }
        }
    }
];
function parseMyGuCode(code) {
    if (!code) {
        return {
            userGender: 'UNKNOWN',
            targetGender: 'UNKNOWN',
            targetGenderInferred: 'UNKNOWN',
            answers: '',
            isInferred: false
        };
    }
    const parts = code.split('_');
    // Định dạng mới: USERGENDER_TARGETGENDER_CODE (ví dụ: NAM_NU_1A2B...)
    if (parts.length === 3) {
        return {
            userGender: parts[0],
            targetGender: parts[1],
            targetGenderInferred: parts[1],
            answers: parts[2],
            isInferred: false
        };
    }
    // Định dạng cũ: USERGENDER_CODE (ví dụ: NAM_1A2B...)
    if (parts.length === 2) {
        const userGender = parts[0];
        const answers = parts[1];
        let targetGenderInferred = 'UNKNOWN';
        if (userGender === 'NAM')
            targetGenderInferred = 'NU';
        else if (userGender === 'NU')
            targetGenderInferred = 'NAM';
        return {
            userGender,
            targetGender: 'UNKNOWN',
            targetGenderInferred,
            answers,
            isInferred: true
        };
    }
    // Không tìm thấy dấu gạch dưới (Hệ cũ nữa hoặc lỗi)
    return {
        userGender: 'UNKNOWN',
        targetGender: 'UNKNOWN',
        targetGenderInferred: 'UNKNOWN',
        answers: code,
        isInferred: true
    };
}
function checkUserException(message) {
    if (message.author.id === '911989602213060688') {
        const username = message.member?.displayName || message.author.username;
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle("🚨 CẢNH BÁO: HỆ THỐNG PHÁT HIỆN GIAN LẬN TÂM LINH!")
            .setColor(0xFF3B30)
            .setDescription(`Ơ cái thằng **${username}** này? Mày có người yêu rồi cơ mà? Định lén lút tìm gu ai nữa đây hả? Máy quét đa vũ trụ của anh đã khóa mục tiêu và tự động reset toàn bộ tiêu chuẩn của mày về mức: **Hệ nghiện người yêu giai đoạn cuối**.\n\n` +
            `**Gu thực sự và duy nhất của mày:** Chị Hằng xinh đẹp tuyệt trần, hoa ghen thua thắm liễu hờn kém xanh, độc nhất vô nhị trên quả đất này!\n\n` +
            `📊 **Chỉ số tương thích:** [████████████████████] **9999%**\n\n` +
            `🎯 **Lời khuyên của BotToan:** Gu mượt thế này rồi thì tắt bot đi mà nhắn tin dỗ dành người ta đi, léng phéng anh mách chị Hằng vả cho sưng mỏ bây giờ! 🤐`)
            .setTimestamp();
        message.reply({ embeds: [embed] }).catch(() => { });
        return true;
    }
    return false;
}
// ============================================================
// =========== TÍNH NĂNG 1: LỆNH TRẮC NGHIỆM @BotToan mygu ===
// ============================================================
async function handleMyGuQuiz(message, rawInput) {
    const today = (0, database_1.getVNDateString)(Date.now());
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
    // Ngoại lệ ẩn
    if (checkUserException(message))
        return;
    const userData = await (0, database_1.getMyGuData)(message.author.id);
    // Nếu ĐÃ TỪNG làm trắc nghiệm thì hiển thị kết quả lưu trữ trọn đời kèm nút Đổi Gu
    if (userData.myGuCode && userData.myGuResultCache) {
        const cachedEmbed = parseResultToEmbed(userData.myGuResultCache, message.author.username, message.client.user?.displayAvatarURL() || '', userData.lastMyGuDate || today);
        const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId(`mygu_reset_${message.author.id}`)
            .setLabel('Tẩy não tìm gu mới 🧠')
            .setStyle(discord_js_1.ButtonStyle.Danger));
        await message.reply({
            content: `🔮 **Bạn đã lưu trữ hồ sơ trắc nghiệm gu rồi!** Dưới đây là kết quả của bạn:`,
            embeds: [cachedEmbed],
            components: [row]
        }).catch(() => { });
        return;
    }
    // Nếu chưa làm bao giờ, chạy luồng trắc nghiệm mới
    await startQuizSession(message, message.author.id);
}
/**
 * Khởi tạo phiên trắc nghiệm mới (Hỗ trợ gọi từ tin nhắn hoặc nút Đổi Gu toàn cục)
 */
async function startQuizSession(ctx, authorId) {
    const introEmbed = new discord_js_1.EmbedBuilder()
        .setTitle("🔮 HỆ THỐNG MÁY DÒ \"MY GU\" ĐA VŨ TRỤ")
        .setColor(0x7B2FBE)
        .setDescription("Chào mừng bạn đến với máy dò gu của BotToan.\nHãy chọn giới tính của bạn để bắt đầu làm trắc nghiệm!")
        .setFooter({ text: "Chỉ người gọi lệnh mới tương tác được • Hết hạn sau 60s" })
        .setTimestamp();
    const genderRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`mygu_gender_nam_${authorId}`).setLabel('Tôi là Nam 🧑').setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder().setCustomId(`mygu_gender_nu_${authorId}`).setLabel('Tôi là Nữ 👩').setStyle(discord_js_1.ButtonStyle.Danger), new discord_js_1.ButtonBuilder().setCustomId(`mygu_gender_other_${authorId}`).setLabel('Hệ Bí Ẩn 👽').setStyle(discord_js_1.ButtonStyle.Secondary));
    let quizMessage;
    if (ctx.reply) {
        // Gọi từ tin nhắn thô
        quizMessage = await ctx.reply({ embeds: [introEmbed], components: [genderRow] }).catch(() => null);
    }
    else {
        // Gọi từ Interaction (nút bấm Đổi Gu)
        quizMessage = await ctx.update({ embeds: [introEmbed], components: [genderRow], fetchReply: true }).catch(() => null);
    }
    if (!quizMessage)
        return;
    let userGender = '';
    let targetGender = '';
    const answers = [];
    let currentIdx = 0;
    const collector = quizMessage.createMessageComponentCollector({
        filter: (i) => {
            if (i.user.id !== authorId) {
                i.reply({ content: "Né ra chỗ khác cho người ta chọn gu, vô duyên thế! 🙄", ephemeral: true }).catch(() => { });
                return false;
            }
            return true;
        },
        time: 60000 // 60 giây suy nghĩ mỗi bước
    });
    collector.on('collect', async (interaction) => {
        // Reset timeout
        collector.resetTimer();
        if (interaction.isButton()) {
            const cid = interaction.customId;
            // Bước 1: Chọn giới tính bản thân
            if (cid.startsWith('mygu_gender_')) {
                if (cid.includes('_nam_'))
                    userGender = 'NAM';
                else if (cid.includes('_nu_'))
                    userGender = 'NU';
                else
                    userGender = 'OTHER';
                const targetEmbed = new discord_js_1.EmbedBuilder()
                    .setTitle("🔮 BƯỚC 2: XÁC ĐỊNH MỤC TIÊU")
                    .setColor(0x7B2FBE)
                    .setDescription("Giới tính đối phương bạn đang tìm kiếm (Gu của bạn) là gì?")
                    .setFooter({ text: "Chỉ người gọi lệnh mới tương tác được • Hết hạn sau 60s" })
                    .setTimestamp();
                const targetRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`mygu_target_nam_${authorId}`).setLabel('Bạn Trai 🧑').setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder().setCustomId(`mygu_target_nu_${authorId}`).setLabel('Bạn Gái 👩').setStyle(discord_js_1.ButtonStyle.Danger), new discord_js_1.ButtonBuilder().setCustomId(`mygu_target_all_${authorId}`).setLabel('Đa Hệ 🌈').setStyle(discord_js_1.ButtonStyle.Success));
                await interaction.update({ embeds: [targetEmbed], components: [targetRow] }).catch(() => { });
                return;
            }
            // Bước 2: Chọn giới tính Gu
            if (cid.startsWith('mygu_target_')) {
                if (cid.includes('_nam_'))
                    targetGender = 'NAM';
                else if (cid.includes('_nu_'))
                    targetGender = 'NU';
                else
                    targetGender = 'ALL';
                // Bắt đầu show câu hỏi đầu tiên
                await showQuestion(interaction, currentIdx, userGender, targetGender, answers, authorId);
                return;
            }
        }
        if (interaction.isStringSelectMenu()) {
            if (interaction.customId.startsWith('mygu_q_')) {
                const answer = interaction.values[0];
                answers.push(answer);
                currentIdx++;
                if (currentIdx < QUESTIONS.length) {
                    await showQuestion(interaction, currentIdx, userGender, targetGender, answers, authorId);
                }
                else {
                    // Đã hoàn thành 6 câu
                    collector.stop('completed');
                    await interaction.deferUpdate();
                    // Định dạng mã mới: USERGENDER_TARGETGENDER_CODE
                    const answersCode = `${userGender}_${targetGender}_` + QUESTIONS.map((_, i) => `${i + 1}${answers[i]}`).join('');
                    const today = (0, database_1.getVNDateString)(Date.now());
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
                    }
                    else if (allB) {
                        resultText = [
                            "HỆ NGƯỜI YÊU: Chúa Tể Masochist 🪤",
                            "BỆNH LÝ LỤY TÌNH: Bạn nghiện ăn chửi và thích drama cực hạn. Cuộc sống bình yên quá làm bạn ngứa ngáy. Bạn phải tìm được người mỏ hỗn, thích dỗi, thích block vô cớ rồi sáng ra lại mở block như chưa có gì xảy ra để có cảm giác kịch tính.",
                            "MỘT NGÀY HẸN HÒ THỰC TẾ: Đi hẹn hò nhưng cãi nhau từ lúc dắt xe ra ngõ, combat toả khói ở quán buffet nhưng cuối buổi lại ship trà sữa dỗ dành nhau.",
                            "TỈ LỆ SỐNG SÓT: 10%. Lời khuyên: Tình yêu kiểu này sớm muộn gì cũng tổn thọ, đi mua bảo hiểm nhân thọ trước khi chốt đơn yêu nhé!"
                        ].join('\n\n');
                    }
                    else {
                        // Gọi Gemini đọc vị gu
                        const answersSummary = QUESTIONS.map((q, i) => `${q.text} -> ${q.getOptions(targetGender).find(opt => opt.value === answers[i])?.label}`).join('\n');
                        try {
                            resultText = await (0, gemini_1.getRealGuReading)(answersSummary, interaction.user.username);
                        }
                        catch {
                            resultText = [
                                "HỆ NGƯỜI YÊU: Hệ Vô Tri Tiêu Chuẩn 🤷‍♀️",
                                "BỆNH LÝ LỤY TÌNH: Gu của bạn khá cơ bản nhưng lại thích thêm chút muối drama cho đời bớt nhạt.",
                                "MỘT NGÀY HẸN HÒ THỰC TẾ: Đi xem phim rồi đi ăn trà sữa trò chuyện bình thường.",
                                "TỈ LỆ SỐNG SÓT: 50%. Lời khuyên: Yêu đương tỉnh táo lên cưng ơi!"
                            ].join('\n\n');
                        }
                    }
                    // Lưu dữ liệu vĩnh viễn vào DB
                    await (0, database_1.saveMyGuData)(authorId, answersCode, resultText, today);
                    const finalEmbed = parseResultToEmbed(resultText, interaction.user.username, interaction.client.user?.displayAvatarURL() || '', today);
                    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                        .setCustomId(`mygu_reset_${authorId}`)
                        .setLabel('Tẩy não tìm gu mới 🧠')
                        .setStyle(discord_js_1.ButtonStyle.Danger));
                    await quizMessage.edit({
                        embeds: [finalEmbed],
                        components: [row]
                    }).catch(() => { });
                }
            }
        }
    });
    collector.on('end', async (_, reason) => {
        if (reason === 'time' && answers.length < QUESTIONS.length) {
            const timeoutEmbed = new discord_js_1.EmbedBuilder()
                .setTitle("🔮 MÁY DÒ GU THẤT BẠI")
                .setColor(0xFF3B30)
                .setDescription("Chọn gu lâu như chọn nền văn minh, dẹp đi đừng yêu đương gì nữa! 🙄")
                .setTimestamp();
            await quizMessage.edit({ embeds: [timeoutEmbed], components: [] }).catch(() => { });
        }
    });
}
// Helper hiển thị câu hỏi trắc nghiệm động
async function showQuestion(interaction, idx, userGender, targetGender, answers, authorId) {
    const q = QUESTIONS[idx];
    const progress = `[${'■'.repeat(idx)}${'░'.repeat(QUESTIONS.length - idx)}] Câu ${idx + 1}/${QUESTIONS.length}`;
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle(`🔮 MÁY DÒ GU — BẠN: ${userGender} | GU: ${targetGender}`)
        .setColor(0x7B2FBE)
        .setDescription(`💬 **${q.text}**\n\n*Tiến độ: ${progress}*`)
        .setFooter({ text: "Hãy chọn phương án bên dưới" });
    const selectMenu = new discord_js_1.StringSelectMenuBuilder()
        .setCustomId(`mygu_q_${idx}_${authorId}`)
        .setPlaceholder('Chọn câu trả lời của bạn...')
        .addOptions(q.getOptions(targetGender).map(opt => ({
        label: opt.label.substring(0, 100),
        value: opt.value,
        emoji: opt.emoji
    })));
    const row = new discord_js_1.ActionRowBuilder().addComponents(selectMenu);
    await interaction.update({ embeds: [embed], components: [row] }).catch(() => { });
}
// Bóc tách text kết quả Gemini thành Embed
function parseResultToEmbed(text, username, avatarUrl, date) {
    const getPart = (key, nextKey) => {
        const regex = nextKey
            ? new RegExp(`${key}[\\s\\S]*?(?=${nextKey}|$)`, 'i')
            : new RegExp(`${key}[\\s\\S]*$`, 'i');
        const match = text.match(regex);
        if (!match)
            return '*Không rõ...*';
        return match[0].replace(new RegExp(key + '.*?:\n?', 'i'), '').trim();
    };
    const he = getPart('HỆ NGƯỜI YÊU', 'BỆNH LÝ LỤY TÌNH');
    const benhLy = getPart('BỆNH LÝ LỤY TÌNH', 'MỘT NGÀY HẸN HÒ THỰC TẾ');
    const henHo = getPart('MỘT NGÀY HẸN HÒ THỰC TẾ', 'TỈ LỆ SỐNG SÓT');
    const songSot = getPart('TỈ LỆ SỐNG SÓT');
    return new discord_js_1.EmbedBuilder()
        .setTitle(`🔮 HỒ SƠ ĐỌC VỊ GU NGƯỜI YÊU — ${username.toUpperCase()}`)
        .setColor(0xEBCB8B)
        .setDescription(`👤 **Hệ Người Yêu:** **${he}**`)
        .addFields({ name: "🩺 Chẩn Đoán Bệnh Lý Lụy Tình", value: benhLy || "*...*", inline: false }, { name: "🍿 Một Ngày Hẹn Hò Thực Tế", value: henHo || "*...*", inline: false }, { name: "☠️ Tỉ Lệ Sống Sót & Lời Khuyên", value: songSot || "*...*", inline: false })
        .setFooter({ text: `Báo cáo lưu trữ vĩnh viễn • BotToan Máy Dò Đa Vũ Trụ`, iconURL: avatarUrl })
        .setTimestamp();
}
// ============================================================
// =========== TÍNH NĂNG 2: LỆNH ĐOÁN GU NHANH @BotToan doan mygu
// ============================================================
const DOAN_GU_BOYS = [
    "Hệ Trai Phố Cổ Thích Giảng Đạo Lý 🏰",
    "Hệ Tổng Tài Thẻ Tín Dụng Nợ Nhóm 3 💳",
    "Hệ Bboy Hơi Nách Nhưng Chung Thủy 🕺",
    "Hệ Boy Bánh Mì Dân Tổ Mỏ Hỗn 🥖",
    "Hệ Trap Boy Ngoan Hiền Ở Chùa Online 📿",
    "Hệ Phú Ông Tương Lai Đang Đi Vay Tiền Nợ 🏦",
    "Hệ Tổng Tài Cá Ươn Lười Rep Tin Nhắn 💤",
    "Hệ Anh Trai Mưa Chuyên Ship Đồ Ăn Đêm 🛵",
    "Hệ Trí Thức Nửa Mùa Thích Nói Triết Lý 📖"
];
const DOAN_GU_GIRLS = [
    "Hệ Phú Bà Quên Mật Khẩu SmartBanking 💸",
    "Hệ Trap Girl Phóng Xe Máy Điện Không Gương 🛵",
    "Hệ Công Chúa Overthink Bán Hàng Online 🧠",
    "Hệ Gái Ngoan Thích Xem Phim Netflix Lúc 12h Đêm 🎬",
    "Hệ Bồ Ngoan Chỉ Xin Ăn Trà Sữa Full Topping 🧋",
    "Hệ Nữ Thần Tẩy Trang Xong Hết Hồn 💄",
    "Hệ Nương Nương Thích Chỉ Tay Năm Ngón 👑"
];
const DOAN_GU_NEUTRAL = [
    "Hệ Flexer Lương 5 Triệu Tiêu 15 Triệu 💰",
    "Hệ Báo Thủ Valorant Suốt Ngày Kêu Lag 🎮",
    "Hệ Người Yêu Hoàn Hảo Trong Trải Bài Tarot 🔮",
    "Hệ Hướng Nội Part-time, Hướng Ngoại Khi Đi Bar 🥂",
    "Hệ Chiến Thần Combat Bỏ Nhà Đi Bụi 🍺",
    "Hệ Chúa Tể Ghen Tuông Xem Hết Nhật Ký 🕵️"
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
async function handleDoanMyGu(message) {
    if (checkUserException(message))
        return;
    // Hiển thị giao diện chọn giới tính của Gu cần bói nhanh để tránh "Báo thủ"
    const introEmbed = new discord_js_1.EmbedBuilder()
        .setTitle("📡 QUÉT GU VŨ TRỤ — RADAR SÓNG NÃO")
        .setColor(0x34C759)
        .setDescription("Chọn đối tượng bạn muốn quét sóng não hôm nay:")
        .setFooter({ text: "Chỉ người gọi lệnh mới tương tác được • Hết hạn sau 60s" })
        .setTimestamp();
    const targetRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`doangu_target_nam_${message.author.id}`).setLabel('Quét Bạn Trai 🧑').setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder().setCustomId(`doangu_target_nu_${message.author.id}`).setLabel('Quét Bạn Gái 👩').setStyle(discord_js_1.ButtonStyle.Danger), new discord_js_1.ButtonBuilder().setCustomId(`doangu_target_all_${message.author.id}`).setLabel('Quét Đa Hệ 🌈').setStyle(discord_js_1.ButtonStyle.Success));
    const askMsg = await message.reply({ embeds: [introEmbed], components: [targetRow] }).catch(() => null);
    if (!askMsg)
        return;
    const collector = askMsg.createMessageComponentCollector({
        filter: (i) => {
            if (i.user.id !== message.author.id) {
                i.reply({ content: "Né ra cho người ta quét sóng não, vô duyên thế! 🙄", ephemeral: true }).catch(() => { });
                return false;
            }
            return true;
        },
        time: 60000
    });
    collector.on('collect', async (interaction) => {
        collector.stop('selected');
        await interaction.deferUpdate();
        let choice = 'ALL';
        const cid = interaction.customId;
        if (cid.includes('_nam_'))
            choice = 'NAM';
        else if (cid.includes('_nu_'))
            choice = 'NU';
        // Xóa nút bấm, chạy hiệu ứng radar loading 2 tầng
        await askMsg.edit({ embeds: [
                new discord_js_1.EmbedBuilder()
                    .setTitle("📡 Đang quét sóng não... [📡📡░░░░░░░░] 20%")
                    .setColor(0x34C759)
            ], components: [] }).catch(() => { });
        await new Promise(res => setTimeout(res, 1500));
        await askMsg.edit({ embeds: [
                new discord_js_1.EmbedBuilder()
                    .setTitle("🎭 Đo lường độ lươn lẹo phong thủy... [🎭🎭🎭🎭🎭🎭🎭🎭░░] 80%")
                    .setColor(0x34C759)
            ] }).catch(() => { });
        await new Promise(res => setTimeout(res, 1500));
        // Seed-based random
        const today = (0, database_1.getVNDateString)(Date.now());
        let hash = 0;
        const seedStr = message.author.id + today + 'doangu' + choice;
        for (let i = 0; i < seedStr.length; i++) {
            hash = ((hash << 5) - hash) + seedStr.charCodeAt(i);
            hash |= 0;
        }
        const roll = Math.abs(hash);
        // Lọc tệp mẫu hình
        let archetypeList = DOAN_GU_NEUTRAL;
        if (choice === 'NAM')
            archetypeList = DOAN_GU_BOYS;
        else if (choice === 'NU')
            archetypeList = DOAN_GU_GIRLS;
        const archetype = archetypeList[roll % archetypeList.length];
        // Thuộc tính thuộc tệp
        const seedVal1 = (roll % 35) + 150;
        const seedVal2 = roll % 101;
        const seedVal3 = (roll >> 2) % 101;
        let name1 = "", value1 = "", name2 = "", value2 = "", name3 = "", value3 = "";
        const getBar = (pct) => {
            const filled = Math.round(pct / 10);
            return '🟩'.repeat(filled) + '⬜'.repeat(10 - filled);
        };
        if (choice === 'NAM') {
            name1 = "📏 Chiều cao";
            value1 = `${getBar(Math.round(((seedVal1 - 150) / 34) * 100))} **${seedVal1} cm** *(Vừa vặn cốc đầu)*`;
            name2 = "🗣️ Độ mỏ hỗn";
            value2 = `${getBar(seedVal2)} **${seedVal2}%**`;
            name3 = "❤️ Độ chung thủy";
            value3 = `${getBar(seedVal3)} **${seedVal3}%**`;
        }
        else if (choice === 'NU') {
            const eo = (roll % 15) + 55; // 55cm - 69cm
            name1 = "📏 Vòng eo";
            value1 = `${getBar(Math.round(((69 - eo) / 14) * 100))} **${eo} cm** *(Thắt đáy lưng ong)*`;
            name2 = "😭 Độ dỗi hờn";
            value2 = `${getBar(seedVal2)} **${seedVal2}%**`;
            name3 = "❤️ Độ chung thủy";
            value3 = `${getBar(seedVal3)} **${seedVal3}%**`;
        }
        else {
            name1 = "🤪 Độ vô tri";
            value1 = `${getBar(seedVal2)} **${seedVal2}%**`;
            name2 = "😏 Độ lươn lẹo";
            value2 = `${getBar(seedVal3)} **${seedVal3}%**`;
            name3 = "❤️ Độ chung thủy";
            const ct = (roll >> 4) % 101;
            value3 = `${getBar(ct)} **${ct}%**`;
        }
        const place = PLACES[roll % PLACES.length];
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(`📡 QUÉT GU VŨ TRỤ HÔM NAY — ${message.author.username.toUpperCase()}`)
            .setColor(0x34C759)
            .setDescription(`Vũ trụ đã bắt sóng được mẫu hình lý tưởng của bạn ngày hôm nay!`)
            .addFields({ name: "👑 Danh hiệu Gu Vũ Trụ", value: `**${archetype}**`, inline: false }, { name: name1, value: value1, inline: false }, { name: name2, value: value2, inline: false }, { name: name3, value: value3, inline: false }, { name: "📍 Tọa độ hay lui tới", value: place, inline: false })
            .setFooter({ text: `Quét ngày ${today} • Kết quả cố định trong ngày • BotToan Radar`, iconURL: message.client.user?.displayAvatarURL() })
            .setTimestamp();
        await (0, database_1.setLastDoanGuDate)(message.author.id, today);
        await askMsg.edit({ embeds: [embed] }).catch(() => { });
    });
    collector.on('end', async (_, reason) => {
        if (reason !== 'selected') {
            await askMsg.delete().catch(() => { });
        }
    });
}
// ============================================================
// =========== TÍNH NĂNG 3: SO GU THỰC TẾ @BotToan mygu match @User
// ============================================================
async function handleMyGuMatch(message, afterCmd) {
    const mentionedUser = message.mentions.users.filter(u => u.id !== message.client.user?.id).first();
    if (!mentionedUser) {
        await message.reply("❌ **So gu cần tag đối tượng!** Ví dụ: `@BotToan mygu match @Crush`").catch(() => { });
        return;
    }
    if (mentionedUser.id === message.author.id) {
        await message.reply("❌ Tự so gu với chính mình? So xong thấy mình cô đơn gấp đôi à fen? 🙄").catch(() => { });
        return;
    }
    // Đọc hồ sơ phong thủy thực tế của cả 2 người
    const profileA = await (0, database_1.getProfile)(message.author.id);
    const profileB = await (0, database_1.getProfile)(mentionedUser.id);
    if (!profileA || !profileA.gender || !profileA.birthday) {
        await message.reply("❌ **Bạn chưa đăng ký hồ sơ profile phong thủy!** Hãy gõ `@BotToan profile [Tên] [Nam/Nu] [Ngày/Tháng/Năm Sinh]` trước nhé.").catch(() => { });
        return;
    }
    if (!profileB || !profileB.gender || !profileB.birthday) {
        await message.reply(`❌ Đối phương (<@${mentionedUser.id}>) chưa đăng ký hồ sơ bằng lệnh \`@BotToan profile\`! Bảo người ta đăng ký giới tính ngày sinh đi rồi mới so gu được nhé.`).catch(() => { });
        return;
    }
    // Đọc mã gu trắc nghiệm
    const myData = await (0, database_1.getMyGuData)(message.author.id);
    if (!myData || !myData.myGuCode) {
        await message.reply("❌ **Bạn chưa làm trắc nghiệm gu!** Hãy gõ `@BotToan mygu` để làm trắc nghiệm trước đã cưng.").catch(() => { });
        return;
    }
    const targetData = await (0, database_1.getMyGuData)(mentionedUser.id);
    const targetHasQuiz = !!(targetData && targetData.myGuCode);
    const myName = profileA.name || message.member?.displayName || message.author.username;
    const targetName = profileB.name || message.guild?.members.cache.get(mentionedUser.id)?.displayName || mentionedUser.username;
    const processingMsg = await message.reply("🔮 *Đang bóc tách thông tin phong thủy thực tế để so khớp hai chiều...*").catch(() => null);
    // Parse mã gu A
    const parsedA = parseMyGuCode(myData.myGuCode);
    const codePartsA = parsedA.answers;
    const cleanChoicesA = codePartsA.match(/\d[A-D]/g) || [];
    const guSummaryA = cleanChoicesA.map(choice => {
        const qIdx = parseInt(choice.charAt(0)) - 1;
        const val = choice.charAt(1);
        const q = QUESTIONS[qIdx];
        const opt = q?.getOptions(parsedA.targetGender).find(o => o.value === val);
        return `- ${q?.text.split(':')[0]}: ${opt?.label || val}`;
    }).join('\n');
    // Parse mã gu B (nếu có)
    let guSummaryB = "";
    let parsedB = null;
    if (targetHasQuiz) {
        parsedB = parseMyGuCode(targetData.myGuCode);
        const codePartsB = parsedB.answers;
        const cleanChoicesB = codePartsB.match(/\d[A-D]/g) || [];
        guSummaryB = cleanChoicesB.map(choice => {
            const qIdx = parseInt(choice.charAt(0)) - 1;
            const val = choice.charAt(1);
            const q = QUESTIONS[qIdx];
            const opt = q?.getOptions(parsedB.targetGender).find(o => o.value === val);
            return `- ${q?.text.split(':')[0]}: ${opt?.label || val}`;
        }).join('\n');
    }
    // --- TÍNH TOÁN PHONG THỦY HỌC ---
    let zodiacA = "", ganChiA = "", menhA = "", cungA = "";
    let zodiacB = "", ganChiB = "", menhB = "", cungB = "";
    try {
        const birthdayCleanA = profileA.birthday.replace(/\-/g, '/');
        const dobPartsA = birthdayCleanA.split('/');
        const solarA = lunar_javascript_1.Solar.fromYmd(parseInt(dobPartsA[2]), parseInt(dobPartsA[1]), parseInt(dobPartsA[0]));
        const lunarA = solarA.getLunar();
        zodiacA = (0, ghepdoi_1.translateShengXiao)(lunarA.getYearShengXiao());
        ganChiA = (0, ghepdoi_1.translateGanChi)(lunarA.getYearInGanZhi());
        menhA = (0, ghepdoi_1.translateNaYin)(lunarA.getYearNaYin());
        cungA = (0, ghepdoi_1.getCungPhi)(birthdayCleanA, profileA.gender).name;
        const birthdayCleanB = profileB.birthday.replace(/\-/g, '/');
        const dobPartsB = birthdayCleanB.split('/');
        const solarB = lunar_javascript_1.Solar.fromYmd(parseInt(dobPartsB[2]), parseInt(dobPartsB[1]), parseInt(dobPartsB[0]));
        const lunarB = solarB.getLunar();
        zodiacB = (0, ghepdoi_1.translateShengXiao)(lunarB.getYearShengXiao());
        ganChiB = (0, ghepdoi_1.translateGanChi)(lunarB.getYearInGanZhi());
        menhB = (0, ghepdoi_1.translateNaYin)(lunarB.getYearNaYin());
        cungB = (0, ghepdoi_1.getCungPhi)(birthdayCleanB, profileB.gender).name;
    }
    catch (err) {
        console.error("Lỗi tính toán ngày sinh:", err);
    }
    // Điểm cơ bản từ phong thủy học Đông phương
    let baseScore = 50;
    if (zodiacA && zodiacB && menhA && menhB && cungA && cungB) {
        baseScore = (0, ghepdoi_1.getFengShuiScore)(zodiacA.split(' ')[0], zodiacB.split(' ')[0], menhA, menhB, cungA, cungB);
    }
    // --- KIỂM TRA ĐỘ LỆCH PHA GIỚI TÍNH & SUY LUẬN THÔNG MINH ---
    let isWarningB = false;
    let warningMsg = "";
    let penalty = 0;
    // Suy luận thông minh cho người A nếu mã của họ là hệ cũ
    let targetGenderA = parsedA.targetGender;
    if (parsedA.isInferred && targetGenderA === 'UNKNOWN') {
        targetGenderA = parsedA.targetGenderInferred;
    }
    // Suy luận thông minh cho người B nếu mã của họ là hệ cũ
    let targetGenderB = 'UNKNOWN';
    if (targetHasQuiz && parsedB) {
        targetGenderB = parsedB.targetGender;
        if (parsedB.isInferred && targetGenderB === 'UNKNOWN') {
            targetGenderB = parsedB.targetGenderInferred;
            isWarningB = true;
            warningMsg = `(Lưu ý: ${targetName} đang dùng mã gu cũ, giới tính mong muốn được suy luận ngầm là ${targetGenderB === 'NU' ? 'Nữ' : 'Nam'})`;
        }
    }
    // 1. Kiểm tra khớp giới tính từ A -> B
    const genderMatchA = (targetGenderA === 'ALL') ||
        (targetGenderA === 'NAM' && profileB.gender === 'Nam') ||
        (targetGenderA === 'NU' && profileB.gender === 'Nu');
    if (!genderMatchA) {
        penalty += 30;
    }
    // 2. Kiểm tra khớp giới tính từ B -> A (nếu B đã làm trắc nghiệm)
    if (targetHasQuiz) {
        const genderMatchB = (targetGenderB === 'ALL') ||
            (targetGenderB === 'NAM' && profileA.gender === 'Nam') ||
            (targetGenderB === 'NU' && profileA.gender === 'Nu');
        if (!genderMatchB) {
            penalty += 30;
        }
    }
    // Phạt nhỏ 5 điểm nếu dùng mã gu suy luận (unverified)
    if (parsedA.isInferred) {
        penalty += 5;
    }
    if (targetHasQuiz && parsedB && parsedB.isInferred) {
        penalty += 5;
    }
    const finalScore = Math.max(0, Math.min(100, baseScore - penalty));
    // Gom dữ liệu gửi sang cho Gemini
    const targetProfileText = `Giới tính: ${profileB.gender}, Ngày sinh: ${profileB.birthday}, Tên: ${targetName}, Tuổi âm: ${ganChiB} (${zodiacB}), Mệnh: ${menhB}, Cung phi: ${cungB}`;
    const myGuText = `Giới tính bản thân: ${profileA.gender}, Gu đích: ${targetGenderA}. Chi tiết đáp án:\n${guSummaryA}`;
    const targetGuText = targetHasQuiz ? `Giới tính bản thân: ${profileB.gender}, Gu đích: ${targetGenderB}. Chi tiết đáp án:\n${guSummaryB}` : "(Chưa làm trắc nghiệm gu)";
    let matchReading = '';
    try {
        matchReading = await (0, gemini_1.getGuMatchReading)(myName, myGuText + (parsedA.isInferred ? "\n(Lưu ý: Người A đang dùng mã cũ, giới tính đích được suy luận)" : ""), targetName, targetProfileText, targetGuText + (warningMsg ? `\n${warningMsg}` : ""), finalScore);
    }
    catch (err) {
        console.error(err);
        matchReading = "Hai bên có vẻ lệch sóng, vũ trụ khuyên bạn đi uống trà sữa một mình cho lành đầu óc.";
    }
    await processingMsg?.delete().catch(() => { });
    // Vẽ thanh tiến trình tương thích
    const getBar = (pct) => {
        const filled = Math.round(pct / 10);
        return '❤️'.repeat(filled) + '🖤'.repeat(10 - filled);
    };
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle(`🔮 SO GU HAI CHIỀU — ${myName.toUpperCase()} & ${targetName.toUpperCase()}`)
        .setColor(finalScore >= 80 ? 0xFF00FF : (finalScore >= 50 ? 0x00FF00 : 0xFF0000))
        .setDescription(`📊 **Chỉ số Tương thích Gu:** ${getBar(finalScore)} **${finalScore}%**\n\n` +
        `💬 **Lời Phán Của BotToan:**\n${matchReading}`)
        .addFields({ name: `Gu mong muốn của ${myName}`, value: `\`${myData.myGuCode}\` (Đích: ${targetGenderA})`, inline: true }, { name: `Gu mong muốn của ${targetName}`, value: targetHasQuiz ? `\`${targetData.myGuCode}\` (Đích: ${targetGenderB})` : "*Chưa làm trắc nghiệm*", inline: true })
        .setTimestamp();
    // Footer nhắc nhở tương thích ngược
    let footerText = "BotToan Mai Mối Giang Hồ • Trắc nghiệm lưu vĩnh viễn";
    if (parsedA.isInferred || (targetHasQuiz && parsedB && parsedB.isInferred)) {
        footerText += " • ⚠️ Có người dùng mã gu cũ, hãy làm lại @BotToan mygu";
        embed.setFooter({ text: footerText, iconURL: message.client.user?.displayAvatarURL() });
    }
    else {
        embed.setFooter({ text: footerText, iconURL: message.client.user?.displayAvatarURL() });
    }
    await message.reply({ embeds: [embed] }).catch(() => { });
}
// ============================================================
// =========== TÍNH NĂNG 4: BẢNG BANG HỘI @BotToan mygu list ====
// ============================================================
async function handleMyGuList(message) {
    if (!message.guild) {
        await message.reply("❌ Lệnh này chỉ dùng được trong server thôi nha cưng!").catch(() => { });
        return;
    }
    // Lấy list ID thành viên đang có mặt trong server
    const memberIds = Array.from(message.guild.members.cache.keys());
    const guildGuData = await (0, database_1.getServerGuData)(memberIds);
    if (guildGuData.length === 0) {
        await message.reply("📊 **Chưa có bang phái nào được lập!** Hãy bảo mọi người gõ `@BotToan mygu` để làm trắc nghiệm lập hội đi nào! 🎉").catch(() => { });
        return;
    }
    // Phân nhóm
    const moHonGroup = []; // Chứa 2B (Mỏ hỗn vũ trụ)
    const daoMoGroup = []; // Chứa 4A hoặc 4C (Ting ting/Đào mỏ)
    const caUonGroup = []; // Chứa 2D hoặc 3D (Cá ươn lười rep)
    const overthinkGroup = []; // Chứa 3B (Gia tộc Overthink)
    for (const user of guildGuData) {
        const code = user.myGuCode;
        if (!code)
            continue;
        const parsed = parseMyGuCode(code);
        const ans = parsed.answers;
        if (ans.includes("2B"))
            moHonGroup.push(user.userId);
        if (ans.includes("4A") || ans.includes("4C"))
            daoMoGroup.push(user.userId);
        if (ans.includes("2D") || ans.includes("3D"))
            caUonGroup.push(user.userId);
        if (ans.includes("3B"))
            overthinkGroup.push(user.userId);
    }
    const renderList = (ids) => {
        if (ids.length === 0)
            return "*Chưa có thành viên nào gia nhập*";
        const sliced = ids.slice(0, 10);
        const listText = sliced.map((id, index) => `${index + 1}. <@${id}>`).join('\n');
        return ids.length > 10 ? `${listText}\n*và ${ids.length - 10} thành viên khác...*` : listText;
    };
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle(`🚨 BAN CHẤP HÀNH CÁC HỘI NHÓM VÔ TRI — ${message.guild.name.toUpperCase()}`)
        .setColor(0x7B2FBE)
        .setDescription("Phân loại các thành viên theo xu hướng gu người yêu bệnh lý:")
        .addFields({ name: "🗣️ Bang Hội Nghiện Ăn Chửi (Gu Mỏ Hỗn)", value: renderList(moHonGroup), inline: false }, { name: "💸 Liên Minh Thèm Ting Ting (Gu Phú Bà/Tổng Tài)", value: renderList(daoMoGroup), inline: false }, { name: "📴 Gặp Nhau Mới Quấn - Lười Rep Tin Nhắn (Gu Cá Ưỡn)", value: renderList(caUonGroup), inline: false }, { name: "🧩 Gia Tộc Drama Queen (Gu Overthink)", value: renderList(overthinkGroup), inline: false })
        .setFooter({ text: `Đã thống kê ${guildGuData.length} thành viên đã khai báo gu • BotToan Census`, iconURL: message.client.user?.displayAvatarURL() })
        .setTimestamp();
    await message.reply({ embeds: [embed] }).catch(() => { });
}
// ============================================================
// =========== BỘ LẮNG NGHE SỰ KIỆN TƯƠNG TÁC NÚT BẤM TOÀN CỤC ===
// ============================================================
function registerMyGuCollector(client) {
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton())
            return;
        const customId = interaction.customId;
        if (!customId || !customId.startsWith('mygu_reset_'))
            return;
        const authorId = customId.replace('mygu_reset_', '');
        // Kiểm tra đúng người gọi
        if (interaction.user.id !== authorId) {
            await interaction.reply({
                content: "Né ra cho người ta đổi gu, vô duyên thế! 🙄",
                ephemeral: true
            }).catch(() => { });
            return;
        }
        // Kích hoạt luồng trắc nghiệm chọn giới tính mới đè lên tin nhắn cũ
        await startQuizSession(interaction, authorId);
    });
}
