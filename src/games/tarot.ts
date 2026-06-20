import { Message, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import { 
    getProfile, getBalance, updateBalance, getDebt
} from '../database';
import { formatMoney, trueRandom } from '../utils';
import { getMatchmakingFortune } from '../services/gemini';

// Định nghĩa thư mục lưu trữ ảnh cục bộ
const ASSETS_DIR = path.join(process.cwd(), 'assets', 'tarot');

export interface TarotCard {
    id: string; // Chuỗi 2 chữ số (ví dụ: "00", "01", ..., "21")
    name: string; // Tên tiếng Việt
    englishName: string; // Tên tiếng Anh
    wikiName: string; // Tên trên wiki để tải ảnh
    meaningUpright: string; // Nghĩa xuôi
    meaningReversed: string; // Nghĩa ngược
}

// Khai báo 22 lá bài Major Arcana chuẩn Rider-Waite-Smith
export const TAROT_DECK: TarotCard[] = [
    { id: "00", name: "Chàng Khờ", englishName: "The Fool", wikiName: "The_Fool", meaningUpright: "Khởi đầu mới, tự do, phiêu lưu, ngây thơ, tin tưởng vào cuộc sống.", meaningReversed: "Liều lĩnh, bất cẩn, ngây ngô, trì hoãn, sợ hãi rủi ro." },
    { id: "01", name: "Pháp Sư", englishName: "The Magician", wikiName: "The_Magician", meaningUpright: "Sức mạnh ý chí, sáng tạo, tập trung, hành động, biến ước mơ thành hiện thực.", meaningReversed: "Thao túng, ảo tưởng, tài năng bị lãng phí, lập kế hoạch tồi." },
    { id: "02", name: "Nữ Tư Tế", englishName: "The High Priestess", wikiName: "The_High_Priestess", meaningUpright: "Trực giác, tiềm thức, bí ẩn, tri thức bên trong, sự tĩnh lặng.", meaningReversed: "Thiếu trực giác, nông cạn, bí mật bị che giấu, bất ổn cảm xúc." },
    { id: "03", name: "Nữ Hoàng", englishName: "The Empress", wikiName: "The_Empress", meaningUpright: "Sự sung túc, thiên nhiên, sinh sản, nuôi dưỡng, nghệ thuật và vẻ đẹp.", meaningReversed: "Thiếu sáng tạo, phụ thuộc cảm xúc, hoang phí, kiểm soát quá mức." },
    { id: "04", name: "Hoàng Đế", englishName: "The Emperor", wikiName: "The_Emperor", meaningUpright: "Quyền lực, trật tự, kỷ luật, bảo vệ, sự ổn định, tư duy lý trí.", meaningReversed: "Độc đoán, kiểm soát quá đà, bất lực, thiếu tổ chức." },
    { id: "05", name: "Giáo Hoàng", englishName: "The Hierophant", wikiName: "The_Hierophant", meaningUpright: "Truyền thống, niềm tin, giáo dục, sự phù hợp, hướng dẫn tinh thần.", meaningReversed: "Nổi loạn, tự do tư tưởng, giáo điều, phá vỡ quy chuẩn cũ." },
    { id: "06", name: "Tình Nhân", englishName: "The Lovers", wikiName: "The_Lovers", meaningUpright: "Tình yêu, sự hòa hợp, mối quan hệ, sự lựa chọn quan trọng, sự gắn kết.", meaningReversed: "Mất cân bằng, xung đột, lựa chọn sai lầm, thiếu cam kết." },
    { id: "07", name: "Chiến Xa", englishName: "The Chariot", wikiName: "The_Chariot", meaningUpright: "Ý chí quyết tâm, chiến thắng, kiểm soát, vượt qua khó khăn, định hướng mục tiêu.", meaningReversed: "Mất kiểm soát, thiếu hướng đi, thất bại trước áp lực, bướng bỉnh." },
    { id: "08", name: "Sức Mạnh", englishName: "Strength", wikiName: "Strength", meaningUpright: "Sức mạnh nội tâm, lòng dũng cảm, kiên nhẫn, lòng trắc ẩn, chế ngự bản năng.", meaningReversed: "Yếu đuối, tự ti, hung hăng, thiếu tự chủ." },
    { id: "09", name: "Ẩn Sĩ", englishName: "The Hermit", wikiName: "The_Hermit", meaningUpright: "Sự chiêm nghiệm, hướng nội, tìm kiếm sự thật, cô độc, sự dẫn lối sáng suốt.", meaningReversed: "Cô lập, cô đơn, từ chối lời khuyên, xa cách thực tế." },
    { id: "10", name: "Vòng Quay Số Phận", englishName: "Wheel of Fortune", wikiName: "Wheel_of_Fortune", meaningUpright: "Sự thay đổi số phận, may mắn, bước ngoặt cuộc đời, định mệnh, nghiệp quả.", meaningReversed: "Vận xui, kháng cự thay đổi, xui xẻo liên tiếp, bài học lặp lại." },
    { id: "11", name: "Công Lý", englishName: "Justice", wikiName: "Justice", meaningUpright: "Sự công bằng, chân lý, luật nhân quả, quyết định sáng suốt, trung thực.", meaningReversed: "Bất công, dối trá, thiếu trách nhiệm, phán xét thiên lệch." },
    { id: "12", name: "Người Treo", englishName: "The Hanged Man", wikiName: "The_Hanged_Man", meaningUpright: "Sự hy sinh, buông bỏ, góc nhìn mới, sự trì hoãn có mục đích, kiên nhẫn.", meaningReversed: "Trì trệ vô ích, phản kháng buông bỏ, hy sinh vô nghĩa, ích kỷ." },
    { id: "13", name: "Tử Thần", englishName: "Death", wikiName: "Death", meaningUpright: "Sự kết thúc, chuyển giao, đổi mới, buông bỏ cái cũ để bắt đầu cái mới.", meaningReversed: "Sợ hãi thay đổi, trì hoãn không thể tránh khỏi, níu kéo quá khứ." },
    { id: "14", name: "Tiết Độ", englishName: "Temperance", wikiName: "Temperance", meaningUpright: "Sự cân bằng, ôn hòa, kiên nhẫn, sự kết hợp hài hòa, mục đích rõ ràng.", meaningReversed: "Mất cân bằng, thừa thãi, xung đột lợi ích, vội vã thiếu kiên nhẫn." },
    { id: "15", name: "Ác Quỷ", englishName: "The Devil", wikiName: "The_Devil", meaningUpright: "Sự ràng buộc, cám dỗ, vật chất, nghiện ngập, nỗi sợ hãi vô hình.", meaningReversed: "Giải thoát, nhận thức bản thân, vượt qua cám dỗ, lấy lại tự do." },
    { id: "16", name: "Tòa Tháp", englishName: "The Tower", wikiName: "The_Tower", meaningUpright: "Sự sụp đổ đột ngột, thảm họa, biến động lớn, vỡ mộng, sự thật phơi bày.", meaningReversed: "Tránh được tai họa lớn, trì hoãn thảm họa, sợ hãi đổ vỡ." },
    { id: "17", name: "Ngôi Sao", englishName: "The Star", wikiName: "The_Star", meaningUpright: "Hy vọng, niềm tin, chữa lành, nguồn cảm hứng, sự thanh thản tâm hồn.", meaningReversed: "Mất hy vọng, tự ti, thiếu cảm hứng, thất vọng kéo dài." },
    { id: "18", name: "Mặt Trăng", englishName: "The Moon", wikiName: "The_Moon", meaningUpright: "Sự hoang mang, ảo giác, nỗi sợ hãi tiềm ẩn, trực giác nhạy bén, sự bất an.", meaningReversed: "Giải tỏa nỗi sợ, phơi bày dối trá, trực giác thức tỉnh, vượt qua hoang mang." },
    { id: "19", name: "Mặt Trời", englishName: "The Sun", wikiName: "The_Sun", meaningUpright: "Niềm vui, thành công, rực rỡ, năng lượng tích cực, sự tự tin, sự thật rõ ràng.", meaningReversed: "Thất vọng tạm thời, kiêu ngạo, thiếu tự tin, thành công bị trì hoãn." },
    { id: "20", name: "Phán Xét", englishName: "Judgement", wikiName: "Judgement", meaningUpright: "Sự thức tỉnh, tiếng gọi định mệnh, sự tha thứ, phán quyết quan trọng, tái sinh.", meaningReversed: "Nghi ngờ bản thân, từ chối tiếng gọi, phán xét gay gắt, thiếu quyết đoán." },
    { id: "21", name: "Thế Giới", englishName: "The World", wikiName: "The_World", meaningUpright: "Sự hoàn thành, trọn vẹn, thành công viên mãn, du hành, kết thúc một hành trình.", meaningReversed: "Thiếu hoàn thành, trì hoãn vạch đích, nỗ lực chưa đủ, đi đường tắt thất bại." }
];

/**
 * Tải tất cả ảnh từ Wikimedia Commons về máy chủ cục bộ khi bot khởi động.
 * Đảm bảo 100% hiển thị ảnh trên Discord chat mà không bị Cloudflare chặn.
 */
export async function initTarot(): Promise<void> {
    if (!fs.existsSync(ASSETS_DIR)) {
        fs.mkdirSync(ASSETS_DIR, { recursive: true });
    }

    console.log("[TAROT] Đang kiểm tra thư viện ảnh Tarot cục bộ...");
    for (const card of TAROT_DECK) {
        const filePath = path.join(ASSETS_DIR, `${card.id}.jpg`);
        if (!fs.existsSync(filePath)) {
            console.log(`[TAROT] Đang tải ảnh lá bài ${card.englishName} từ Wikimedia...`);
            const url = `https://commons.wikimedia.org/wiki/Special:Redirect/file/Pictorial_Key_to_the_Tarot_${card.id}_${card.wikiName}.jpg`;
            try {
                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                });
                if (!response.ok) {
                    throw new Error(`HTTP Error: status ${response.status}`);
                }
                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                fs.writeFileSync(filePath, buffer);
                console.log(`[TAROT] Đã lưu thành công lá bài ${card.englishName}`);
            } catch (err: any) {
                console.error(`[TAROT LỖI] Lỗi tải ảnh cho lá ${card.englishName}:`, err.message);
            }
        }
    }
    console.log("[TAROT] Kiểm tra thư viện ảnh Tarot hoàn tất!");
}

/**
 * Xử lý lệnh bói bài Tarot
 */
export async function handleTarot(message: Message, rawInput: string): Promise<void> {
    const userId = message.author.id;
    const cost = 20000; // Phí bói bài 20k

    // 1. Kiểm tra đăng ký profile
    const profile = await getProfile(userId);
    if (!profile) {
        await message.reply(`❌ **Mày chưa khai báo lý lịch (profile) bói toán!**\nHãy gõ lệnh sau để tạo hồ sơ trước:\n\`@BotToan profile [Tên] [Nam/Nu] [Ngày/Tháng/Năm Sinh]\``).catch(()=>{});
        return;
    }
    profile.birthday = profile.birthday.replace(/\-/g, '/');

    // 2. Kiểm tra tài chính (ví tiền)
    let balance = await getBalance(userId);
    if (balance < cost) {
        await message.reply(`❌ **Đéo đủ tiền xem bói!** Lệ phí cúng thầy Toàn bói Tarot là **${formatMoney(cost)}**.\nVí mày hiện tại chỉ có **${formatMoney(balance)}**, cút đi cày cuốc hoặc xin vay tiền rồi quay lại đây! 💸`).catch(()=>{});
        return;
    }

    // 3. Trừ tiền đặt cọc trước
    balance -= cost;
    await updateBalance(userId, balance);

    // Báo hiệu đang xử lý
    if ('sendTyping' in message.channel) {
        await (message.channel as any).sendTyping().catch(()=>{});
    }

    // 4. Rút 3 lá bài ngẫu nhiên không trùng nhau
    const indexes: number[] = [];
    while (indexes.length < 3) {
        const rand = trueRandom(0, 21);
        if (!indexes.includes(rand)) {
            indexes.push(rand);
        }
    }

    const card1 = TAROT_DECK[indexes[0]];
    const card2 = TAROT_DECK[indexes[1]];
    const card3 = TAROT_DECK[indexes[2]];

    // Roll hướng bài (50% xuôi, 50% ngược)
    const orient1 = trueRandom(1, 2) === 1 ? 'Xuôi' : 'Ngược';
    const orient2 = trueRandom(1, 2) === 1 ? 'Xuôi' : 'Ngược';
    const orient3 = trueRandom(1, 2) === 1 ? 'Xuôi' : 'Ngược';

    const card1Meaning = orient1 === 'Xuôi' ? card1.meaningUpright : card1.meaningReversed;
    const card2Meaning = orient2 === 'Xuôi' ? card2.meaningUpright : card2.meaningReversed;
    const card3Meaning = orient3 === 'Xuôi' ? card3.meaningUpright : card3.meaningReversed;

    // Lọc câu hỏi của người dùng
    const userQuestion = rawInput
        .replace(/^(boi tarot|tarot|xem tarot|trai bai tarot)/i, "")
        .trim();

    const debt = await getDebt(userId);

    // 5. Gửi prompt cho Gemini giải quẻ bựa
    const geminiPrompt = `
        Bạn là BotToan, một thầy bói giang hồ bựa, chuyên bói toán cờ bạc, dùng từ lóng giang hồ và cờ bạc Việt Nam.
        Người chơi "${profile.name}" (${profile.gender}, sinh ngày ${profile.birthday}) vừa cúng 20k để rút 3 lá bài Tarot Major Arcana (vận mệnh quá khứ, hiện tại sự nghiệp, tương lai tình duyên).
        Câu hỏi của họ: "${userQuestion || "Xem tổng quan vận mệnh"}"
        Thông số tài chính: Ví ${balance}k, đang nợ bot ${debt}k.

        Thông tin 3 lá bài họ đã rút:
        1. Quá Khứ (Vận Mệnh): Lá "${card1.name}" (${card1.englishName}) - Hướng: ${orient1}
           - Ý nghĩa gốc: "${card1Meaning}"
        2. Hiện Tại (Sự Nghiệp): Lá "${card2.name}" (${card2.englishName}) - Hướng: ${orient2}
           - Ý nghĩa gốc: "${card2Meaning}"
        3. Tương Lai (Tình Duyên): Lá "${card3.name}" (${card3.englishName}) - Hướng: ${orient3}
           - Ý nghĩa gốc: "${card3Meaning}"

        Nhiệm vụ của bạn: Hãy đưa ra lời giải nghĩa cực kỳ hài bựa, châm biếm sâu cay dưới góc nhìn sới bạc giang hồ cho từng lá bài và một lời tổng kết sấm truyền.
        Hãy trả về câu trả lời có chứa đúng 4 thẻ đánh dấu sau để tôi tách văn bản ra làm các Embed:
        [LA_1]
        (Viết 1 đoạn giải thích hài bựa khoảng 2-3 câu cho lá thứ nhất, xưng mày-tao, châm chọc vận mệnh quá khứ cờ bạc)
        [LA_2]
        (Viết 1 đoạn giải thích hài bựa khoảng 2-3 câu cho lá thứ hai, cà khịa sự nghiệp hiện tại ăn hại)
        [LA_3]
        (Viết 1 đoạn giải thích hài bựa khoảng 2-3 câu cho lá thứ ba, troll tình duyên tương lai simp lỏ)
        [TONG_KET]
        (Viết đoạn tổng kết sấm truyền giang hồ cuối cùng, chửi bới khuyên bảo cờ bạc, lô đề)

        YÊU CẦU BẮT BUỘC:
        - Không được viết bất kỳ lời dẫn chào hỏi hay giải thích bên ngoài các thẻ [LA_1], [LA_2], [LA_3], [TONG_KET].
        - Viết ngắn gọn, súc tích (tổng văn bản dưới 900 ký tự).
    `;

    let explanation = "";
    try {
        explanation = await getMatchmakingFortune(geminiPrompt);
    } catch (err) {
        console.error("[TAROT LỖI] Lỗi gọi Gemini giải quẻ:", err);
    }

    // 6. Phân tách câu trả lời của Gemini
    let la1Text = "";
    let la2Text = "";
    let la3Text = "";
    let tongKetText = "";

    if (explanation) {
        const regex1 = /\[LA_1\]([\s\S]*?)(?:\[LA_2\]|$)/i;
        const regex2 = /\[LA_2\]([\s\S]*?)(?:\[LA_3\]|$)/i;
        const regex3 = /\[LA_3\]([\s\S]*?)(?:\[TONG_KET\]|$)/i;
        const regexTk = /\[TONG_KET\]([\s\S]*?)$/i;

        const m1 = explanation.match(regex1);
        const m2 = explanation.match(regex2);
        const m3 = explanation.match(regex3);
        const mTk = explanation.match(regexTk);

        if (m1) la1Text = m1[1].trim();
        if (m2) la2Text = m2[1].trim();
        if (m3) la3Text = m3[1].trim();
        if (mTk) tongKetText = mTk[1].trim();
    }

    // Fallback nếu Gemini không trả về đúng định dạng
    if (!la1Text || !la2Text || !la3Text || !tongKetText) {
        const paragraphs = explanation ? explanation.split('\n').filter(p => p.trim().length > 0) : [];
        la1Text = paragraphs[0] || `Vận mệnh quá khứ của mày trôi nổi như cánh bèo, chỉ có bốc bát họ và chơi lô đề thôi con ạ.`;
        la2Text = paragraphs[1] || `Sự nghiệp hiện tại đang bế tắc, nghèo xơ nghèo xác, ăn mì gói qua ngày đòi làm đại gia à.`;
        la3Text = paragraphs[2] || `Tình duyên tương lai chán chả buồn nói, kiếp simp lỏ liếm chân người ta cả đời cũng đéo sơ múi được gì.`;
        tongKetText = paragraphs[3] || `Nói chung là vận mệnh đen tối, thầy khuyên mày nên giải tán sới bài cờ bạc đi kiếm việc đàng hoàng mà làm!`;
    }

    // 7. Xác định màu sắc Embed và Cảnh báo Nguy hiểm (Death, Devil, Tower)
    const dangerousIds = ["13", "15", "16"];
    const hasDanger = dangerousIds.includes(card1.id) || dangerousIds.includes(card2.id) || dangerousIds.includes(card3.id);
    const color = hasDanger ? 0x7C0A02 : 0x9B59B6; // Đỏ máu nếu có bài nguy hiểm, Tím huyền bí nếu bình thường

    // Tạo các file đính kèm hình ảnh cục bộ
    const path1 = path.join(ASSETS_DIR, `${card1.id}.jpg`);
    const path2 = path.join(ASSETS_DIR, `${card2.id}.jpg`);
    const path3 = path.join(ASSETS_DIR, `${card3.id}.jpg`);

    const attachments: AttachmentBuilder[] = [];
    if (fs.existsSync(path1)) attachments.push(new AttachmentBuilder(path1, { name: 'card1.jpg' }));
    if (fs.existsSync(path2)) attachments.push(new AttachmentBuilder(path2, { name: 'card2.jpg' }));
    if (fs.existsSync(path3)) attachments.push(new AttachmentBuilder(path3, { name: 'card3.jpg' }));

    // 8. Dựng 4 Embeds
    const embed1 = new EmbedBuilder()
        .setTitle(`🔮 LÁ 1 - QUÁ KHỨ (VẬN MỆNH): ${card1.name} (${card1.englishName}) - Hướng ${orient1}`)
        .setColor(color)
        .setDescription(`• **Ý nghĩa chuẩn RWS:** *${card1Meaning}*\n\n• **Lời thầy sấm phán:** ${la1Text}`);
    if (fs.existsSync(path1)) {
        embed1.setImage('attachment://card1.jpg');
    }

    const embed2 = new EmbedBuilder()
        .setTitle(`🔮 LÁ 2 - HIỆN TẠI (SỰ NGHIỆP): ${card2.name} (${card2.englishName}) - Hướng ${orient2}`)
        .setColor(color)
        .setDescription(`• **Ý nghĩa chuẩn RWS:** *${card2Meaning}*\n\n• **Lời thầy sấm phán:** ${la2Text}`);
    if (fs.existsSync(path2)) {
        embed2.setImage('attachment://card2.jpg');
    }

    const embed3 = new EmbedBuilder()
        .setTitle(`🔮 LÁ 3 - TƯƠNG LAI (TÌNH DUYÊN): ${card3.name} (${card3.englishName}) - Hướng ${orient3}`)
        .setColor(color)
        .setDescription(`• **Ý nghĩa chuẩn RWS:** *${card3Meaning}*\n\n• **Lời thầy sấm phán:** ${la3Text}`);
    if (fs.existsSync(path3)) {
        embed3.setImage('attachment://card3.jpg');
    }

    // Embed tổng kết
    let warningText = "";
    if (hasDanger) {
        const dangerousPulled = [card1, card2, card3]
            .filter(c => dangerousIds.includes(c.id))
            .map(c => `**${c.name}** (${c.englishName})`)
            .join(", ");
        warningText = `⚠️ **CẢNH BÁO ĐẠI HUNG - QUẺ BÀI CHẾT CHÓC!**\nMày vừa bốc phải hung tinh chết người: ${dangerousPulled}. Khôn hồn thì tích đức gấp hoặc cúng sòng bài đi con giời, nghiệp nặng sắp giáng xuống đầu rồi! 💀🔥\n\n`;
    }

    const embedSummary = new EmbedBuilder()
        .setTitle(`🃏 BẢN TỔNG KẾT QUẺ TAROT KÍN HÀNG ĐẦU`)
        .setColor(color)
        .setDescription(`${warningText}• **Câu hỏi của mày:** *${userQuestion || "Xem tổng quan vận mệnh"}*\n\n• **Lời khuyên sấm truyền từ thầy bói BotToan:**\n${tongKetText}`)
        .addFields({
            name: "💸 Biến Động Tài Chính",
            value: `• Lệ phí bói bài: **-20.000đ**\n• Số dư ví hiện tại: **${formatMoney(balance)}** | Đang nợ: **${formatMoney(debt)}**`
        })
        .setFooter({ text: "BotToan Tarot - Bói kín trong DM (Thông tin bảo mật tuyệt đối)", iconURL: message.client.user?.displayAvatarURL() })
        .setTimestamp();

    const embedsToSend = [embed1, embed2, embed3, embedSummary];

    // 9. Gửi tin nhắn riêng (DM) bảo mật tuyệt đối cho người gọi bói
    try {
        await message.author.send({
            content: `🔮 **KẾT QUẢ BÓI TAROT RIÊNG TƯ DÀNH CHO CON GIỜI <@${userId}>** 🔮\n*(Thông tin quẻ bài này được bảo mật hoàn toàn, sới bạc cộng đồng không ai nhìn thấy đâu cưng!)*`,
            embeds: embedsToSend,
            files: attachments
        });

        // Phản hồi công khai trên sới là đã gửi DM thành công
        await message.reply(`🔮 **Thầy Toàn đã rút bài và gửi quẻ Tarot kín vào DM của mày rồi!** Mau chui vào góc tối mở tin nhắn riêng ra xem vận hạn đi con giời, ảnh bài load siêu nét siêu đẹp ở trỏng đó. 😉`).catch(()=>{});
    } catch (err: any) {
        // HOÀN TIỀN NẾU KHÔNG GỬI ĐƯỢC DM
        balance += cost;
        await updateBalance(userId, balance);

        console.error(`[TAROT LỖI] Không thể gửi DM cho user ${userId}:`, err.message);
        await message.reply(`❌ **Đéo bói được!** Thầy Toàn không thể gửi tin nhắn riêng (DM) cho mày. Mày đang chặn nhận tin nhắn từ thành viên server đúng không?\nTao đã **hoàn lại ${formatMoney(cost)}** vào ví của mày rồi. Hãy mở cài đặt quyền riêng tư DM lên rồi gõ lệnh bói lại nhé! 💸`).catch(()=>{});
    }
}
