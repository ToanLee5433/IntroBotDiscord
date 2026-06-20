import { Message, EmbedBuilder, AttachmentBuilder, ComponentType, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
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
    id: string;
    name: string;        // Tên tiếng Việt
    englishName: string; // Tên tiếng Anh
    element: string;     // Nguyên tố liên quan (dùng khi phân tích tổ hợp)
    meaningUpright: string;  // Nghĩa xuôi đầy đủ
    meaningReversed: string; // Nghĩa ngược đầy đủ
    keywords: string[];  // Từ khóa cốt lõi để Gemini phân tích sâu hơn
}

// 22 lá bài Major Arcana chuẩn Rider-Waite-Smith với đầy đủ thông tin phong thủy
export const TAROT_DECK: TarotCard[] = [
    { id: "00", name: "Chàng Khờ", englishName: "The Fool", element: "Khí/Không Khí",
      meaningUpright: "Khởi đầu mới, tự do tuyệt đối, tin tưởng vào vũ trụ, phiêu lưu mạo hiểm, ngây thơ thuần khiết.",
      meaningReversed: "Liều lĩnh vô trách nhiệm, bất cẩn, đưa ra quyết định ngớ ngẩn, trì hoãn khởi đầu, sống trong ảo tưởng.",
      keywords: ["khởi đầu", "tự do", "phiêu lưu", "ngây thơ", "vô tư"] },

    { id: "01", name: "Pháp Sư", englishName: "The Magician", element: "Khí/Thủy Ngân",
      meaningUpright: "Sức mạnh ý chí, sáng tạo, tập trung tuyệt đối, khả năng biến ý tưởng thành hiện thực, nắm giữ đủ tài nguyên.",
      meaningReversed: "Thao túng, lừa đảo, ảo tưởng sức mạnh, tài năng bị lãng phí, thiếu tập trung, kế hoạch tồi.",
      keywords: ["ý chí", "sáng tạo", "hành động", "tài năng", "tập trung"] },

    { id: "02", name: "Nữ Tư Tế", englishName: "The High Priestess", element: "Thủy/Mặt Trăng",
      meaningUpright: "Trực giác sâu sắc, tiềm thức, bí ẩn, tri thức bên trong, kiên nhẫn chờ đợi, sự tĩnh lặng tâm hồn.",
      meaningReversed: "Thiếu trực giác, nông cạn hời hợt, bí mật bị che giấu hại người, bất ổn cảm xúc, đưa ra quyết định khi chưa đủ thông tin.",
      keywords: ["trực giác", "bí ẩn", "tiềm thức", "tri thức", "nội tâm"] },

    { id: "03", name: "Nữ Hoàng", englishName: "The Empress", element: "Đất/Kim Tinh",
      meaningUpright: "Sự sung túc dồi dào, thiên nhiên sinh sôi, nuôi dưỡng yêu thương, sáng tạo nghệ thuật, vẻ đẹp và giác quan.",
      meaningReversed: "Thiếu sáng tạo, phụ thuộc cảm xúc, hoang phí xa hoa, kiểm soát quá mức, bế tắc sáng tạo.",
      keywords: ["sung túc", "nuôi dưỡng", "sáng tạo", "thiên nhiên", "phong phú"] },

    { id: "04", name: "Hoàng Đế", englishName: "The Emperor", element: "Lửa/Hỏa Tinh",
      meaningUpright: "Quyền lực lãnh đạo, trật tự kỷ luật, bảo vệ che chở, sự ổn định vững chắc, tư duy lý trí logic.",
      meaningReversed: "Độc đoán chuyên quyền, kiểm soát quá đà, bất lực mất uy, thiếu tổ chức linh hoạt, cứng nhắc bảo thủ.",
      keywords: ["quyền lực", "kỷ luật", "ổn định", "lãnh đạo", "trật tự"] },

    { id: "05", name: "Giáo Hoàng", englishName: "The Hierophant", element: "Đất/Kim Ngưu",
      meaningUpright: "Truyền thống và niềm tin, giáo dục tâm linh, sự phù hợp với chuẩn mực, hướng dẫn tinh thần, tuân theo lề thói.",
      meaningReversed: "Nổi loạn chống đối, tự do tư tưởng cực đoan, giáo điều mù quáng, phá vỡ quy chuẩn, không chịu học hỏi.",
      keywords: ["truyền thống", "niềm tin", "giáo dục", "hướng dẫn", "tâm linh"] },

    { id: "06", name: "Tình Nhân", englishName: "The Lovers", element: "Khí/Song Tử",
      meaningUpright: "Tình yêu hòa hợp, mối quan hệ đích thực, sự lựa chọn quan trọng từ trái tim, sự gắn kết giá trị, sự liên kết tâm hồn.",
      meaningReversed: "Mất cân bằng trong quan hệ, xung đột tình cảm, lựa chọn sai lầm, thiếu cam kết, không hòa hợp giá trị.",
      keywords: ["tình yêu", "lựa chọn", "hòa hợp", "cam kết", "mối quan hệ"] },

    { id: "07", name: "Chiến Xa", englishName: "The Chariot", element: "Thủy/Cự Giải",
      meaningUpright: "Ý chí sắt đá, chiến thắng qua nỗ lực, kiểm soát bản thân và hoàn cảnh, vượt qua mọi trở ngại, định hướng rõ ràng.",
      meaningReversed: "Mất kiểm soát hoàn toàn, thiếu hướng đi, thất bại trước áp lực, bướng bỉnh cố chấp, xung đột nội tâm.",
      keywords: ["ý chí", "chiến thắng", "kiểm soát", "quyết tâm", "vượt khó"] },

    { id: "08", name: "Sức Mạnh", englishName: "Strength", element: "Lửa/Sư Tử",
      meaningUpright: "Sức mạnh nội tâm bền vững, lòng dũng cảm từ bên trong, kiên nhẫn bất khuất, lòng trắc ẩn chữa lành, chế ngự bản năng thú tính.",
      meaningReversed: "Yếu đuối thiếu nghị lực, tự ti mặc cảm, hung hăng mất kiểm soát, thiếu lòng trắc ẩn, để bản năng dẫn đường.",
      keywords: ["nội lực", "dũng cảm", "kiên nhẫn", "trắc ẩn", "kỷ luật bản thân"] },

    { id: "09", name: "Ẩn Sĩ", englishName: "The Hermit", element: "Đất/Xử Nữ",
      meaningUpright: "Chiêm nghiệm sâu sắc, hướng nội tìm kiếm sự thật, trí tuệ qua cô độc, ánh sáng dẫn đường nội tâm, tạm lui về suy ngẫm.",
      meaningReversed: "Cô lập tiêu cực, cô đơn không cần thiết, từ chối lời khuyên người khác, xa cách thực tế, thu mình quá mức.",
      keywords: ["chiêm nghiệm", "cô độc", "trí tuệ", "hướng nội", "tự tìm hiểu"] },

    { id: "10", name: "Vòng Quay Số Phận", englishName: "Wheel of Fortune", element: "Mộc/Mộc Tinh",
      meaningUpright: "Sự thay đổi không ngừng của số phận, may mắn bất ngờ, bước ngoặt cuộc đời, chu kỳ nhân quả, định mệnh vận hành.",
      meaningReversed: "Vận xui liên tiếp, kháng cự thay đổi vô ích, xui xẻo kéo dài, bài học cứ lặp lại, không chịu chấp nhận hoàn cảnh.",
      keywords: ["số phận", "may mắn", "thay đổi", "chu kỳ", "định mệnh"] },

    { id: "11", name: "Công Lý", englishName: "Justice", element: "Khí/Thiên Bình",
      meaningUpright: "Sự công bằng tuyệt đối, chân lý được phơi bày, luật nhân quả hiển hiện, quyết định sáng suốt công tâm, trung thực minh bạch.",
      meaningReversed: "Bất công, che giấu sự thật, thiếu trách nhiệm, phán xét thiên lệch, kết quả không xứng đáng với nỗ lực.",
      keywords: ["công bằng", "sự thật", "nhân quả", "quyết định", "trung thực"] },

    { id: "12", name: "Người Treo", englishName: "The Hanged Man", element: "Thủy/Hải Vương",
      meaningUpright: "Sự hy sinh có mục đích, buông bỏ để nhận điều lớn hơn, góc nhìn hoàn toàn mới, trì hoãn có lý do, kiên nhẫn chờ thời.",
      meaningReversed: "Trì trệ vô ích không đến đâu, phản kháng sự buông bỏ cần thiết, hy sinh không xứng đáng, ích kỷ giữ chặt cái cũ.",
      keywords: ["hy sinh", "buông bỏ", "góc nhìn mới", "kiên nhẫn", "chuyển hóa"] },

    { id: "13", name: "Tử Thần", englishName: "Death", element: "Thủy/Bọ Cạp",
      meaningUpright: "Kết thúc hoàn toàn một giai đoạn, chuyển hóa sâu sắc không thể đảo ngược, tái sinh từ tro tàn, buông bỏ hoàn toàn cái cũ.",
      meaningReversed: "Sợ hãi sự thay đổi cần thiết, trì hoãn điều không thể tránh khỏi, mắc kẹt trong quá khứ, kháng cự sự chuyển hóa.",
      keywords: ["kết thúc", "chuyển hóa", "tái sinh", "buông bỏ", "thay đổi tất yếu"] },

    { id: "14", name: "Tiết Độ", englishName: "Temperance", element: "Lửa/Nhân Mã",
      meaningUpright: "Cân bằng hoàn hảo, ôn hòa kiên định, kiên nhẫn lâu dài, sự hòa hợp giữa các mặt đối lập, mục đích rõ ràng và bền vững.",
      meaningReversed: "Mất cân bằng nghiêm trọng, thừa thãi cực đoan, xung đột lợi ích, vội vã thiếu kiên nhẫn, thiếu sự điều hòa.",
      keywords: ["cân bằng", "ôn hòa", "kiên nhẫn", "hòa hợp", "điều độ"] },

    { id: "15", name: "Ác Quỷ", englishName: "The Devil", element: "Đất/Ma Kết",
      meaningUpright: "Ràng buộc bởi vật chất và cám dỗ, nghiện ngập mất kiểm soát, nỗi sợ hãi vô hình trói buộc, bị tư duy hạn hẹp giam cầm.",
      meaningReversed: "Giải thoát khỏi ràng buộc, nhận thức được xiềng xích vô hình, vượt qua cám dỗ, lấy lại tự do ý chí thực sự.",
      keywords: ["ràng buộc", "cám dỗ", "nghiện ngập", "ảo tưởng", "xiềng xích"] },

    { id: "16", name: "Tòa Tháp", englishName: "The Tower", element: "Lửa/Hỏa Tinh",
      meaningUpright: "Sụp đổ đột ngột không thể tránh, thảm họa phá vỡ nền tảng sai lầm, biến động lớn lao, vỡ mộng toàn diện, sự thật trần trụi phơi bày.",
      meaningReversed: "Tránh được tai họa lớn nhờ thay đổi kịp thời, trì hoãn thảm họa, sợ hãi sự đổ vỡ cần thiết, chặn đứng được thảm kịch.",
      keywords: ["sụp đổ", "thảm họa", "biến động", "vỡ mộng", "phá hủy"] },

    { id: "17", name: "Ngôi Sao", englishName: "The Star", element: "Khí/Bảo Bình",
      meaningUpright: "Hy vọng rực rỡ sau bóng tối, niềm tin vào tương lai, chữa lành tâm hồn, nguồn cảm hứng bất tận, sự thanh thản và bình yên.",
      meaningReversed: "Mất hy vọng sâu sắc, tuyệt vọng kéo dài, tự ti không xứng đáng, thiếu cảm hứng sáng tạo, thất vọng về tương lai.",
      keywords: ["hy vọng", "chữa lành", "cảm hứng", "bình yên", "thanh thản"] },

    { id: "18", name: "Mặt Trăng", englishName: "The Moon", element: "Thủy/Song Ngư",
      meaningUpright: "Ảo giác và hoang mang, nỗi sợ hãi tiềm ẩn, trực giác nhạy bén dẫn đường trong bóng tối, bất an từ tiềm thức, điều chưa được phơi bày.",
      meaningReversed: "Giải tỏa nỗi sợ và hoang mang, sự thật dối trá được phơi bày, trực giác thức tỉnh rõ ràng, vượt qua ảo tưởng, minh bạch hóa.",
      keywords: ["ảo giác", "tiềm thức", "nỗi sợ", "bí ẩn", "trực giác bóng tối"] },

    { id: "19", name: "Mặt Trời", englishName: "The Sun", element: "Lửa/Mặt Trời",
      meaningUpright: "Niềm vui thuần túy, thành công rực rỡ, năng lượng tích cực tràn đầy, sự tự tin chói sáng, sự thật rõ ràng và trong sáng.",
      meaningReversed: "Thất vọng tạm thời, kiêu ngạo thái quá, thiếu tự tin vô căn cứ, thành công bị trì hoãn, hào quang nhạt dần.",
      keywords: ["niềm vui", "thành công", "tự tin", "rực rỡ", "trong sáng"] },

    { id: "20", name: "Phán Xét", englishName: "Judgement", element: "Lửa/Diêm Vương",
      meaningUpright: "Thức tỉnh tâm linh sâu sắc, tiếng gọi của định mệnh, tha thứ và giải thoát, phán quyết công bằng cuối cùng, tái sinh ở tầng cao hơn.",
      meaningReversed: "Tự nghi ngờ bản thân, từ chối tiếng gọi định mệnh, phán xét gay gắt không công bằng, thiếu quyết đoán trong bước ngoặt lớn.",
      keywords: ["thức tỉnh", "tha thứ", "tái sinh", "định mệnh", "phán quyết"] },

    { id: "21", name: "Thế Giới", englishName: "The World", element: "Đất/Thổ Tinh",
      meaningUpright: "Hoàn thành viên mãn, trọn vẹn không thiếu sót, thành công đỉnh cao, kết thúc một chu kỳ lớn, mở ra khởi đầu mới toàn diện.",
      meaningReversed: "Thiếu sự hoàn thành, trì hoãn ở vạch đích, nỗ lực chưa đủ để đến đích, chọn đường tắt thất bại, chưa sẵn sàng khép lại.",
      keywords: ["hoàn thành", "trọn vẹn", "thành công", "kết thúc", "viên mãn"] }
];

// ================ KIỂU TRẢI BÀI ================
interface SpreadType {
    name: string;
    positions: string[]; // Tên vị trí từng lá
    description: string;
}

const SPREADS: { [key: string]: SpreadType } = {
    love: {
        name: "Trải Bài Tình Duyên 💕",
        positions: ["Tình trạng hiện tại của mối quan hệ", "Trở ngại / Thử thách đang đối mặt", "Kết quả / Tương lai của tình duyên"],
        description: "tình duyên và tình yêu"
    },
    career: {
        name: "Trải Bài Sự Nghiệp 💼",
        positions: ["Năng lực / Tài nguyên hiện có", "Cơ hội / Thách thức trong công việc", "Định hướng / Kết quả sự nghiệp"],
        description: "sự nghiệp và công việc"
    },
    money: {
        name: "Trải Bài Tài Lộc & Tiền Bạc 💰",
        positions: ["Tình hình tài chính hiện tại", "Khó khăn / Rủi ro mất mát tiền bạc", "Cơ hội gia tăng tài lộc / Lời khuyên tài chính"],
        description: "tài chính và tiền bạc"
    }
};

/**
 * Kiểm tra thư viện ảnh Tarot cục bộ.
 * Ảnh phải được đặt thủ công vào thư mục: assets/tarot/
 * Tên file: 00.jpg, 01.jpg, ..., 21.jpg
 */
export async function initTarot(): Promise<void> {
    if (!fs.existsSync(ASSETS_DIR)) {
        fs.mkdirSync(ASSETS_DIR, { recursive: true });
        console.log(`[TAROT] 📁 Đã tạo thư mục: ${ASSETS_DIR}`);
    }

    let found = 0;
    const missing: string[] = [];

    for (const card of TAROT_DECK) {
        const filePath = path.join(ASSETS_DIR, `${card.id}.jpg`);
        if (fs.existsSync(filePath) && fs.statSync(filePath).size > 1000) {
            found++;
        } else {
            missing.push(`${card.id}.jpg (${card.name})`);
        }
    }

    if (found === TAROT_DECK.length) {
        console.log(`[TAROT] ✅ Thư viện ảnh đầy đủ ${found}/${TAROT_DECK.length} lá — sẵn sàng!`);
    } else {
        console.warn(`[TAROT] ⚠️ Có ${missing.length} lá thiếu ảnh (hiển thị text only): ${missing.join(', ')}`);
    }
}

/**
 * Xử lý lệnh bói bài Tarot
 */
export async function handleTarot(message: Message, rawInput: string): Promise<void> {
    const userId = message.author.id;
    const cost = 20000;

    // 1. Kiểm tra profile
    const profile = await getProfile(userId);
    if (!profile) {
        await message.reply(`❌ **Mày chưa khai báo lý lịch bói toán!**\nGõ lệnh: \`@BotToan profile [Tên] [Nam/Nu] [Ngày/Tháng/Năm Sinh]\``).catch(() => {});
        return;
    }
    profile.birthday = profile.birthday.replace(/\-/g, '/');

    // 2. Kiểm tra ví tiền (kiểm tra trước, nhưng chưa trừ tiền)
    const balance = await getBalance(userId);
    if (balance < cost) {
        await message.reply(`❌ **Đéo đủ tiền xem bói!** Lệ phí cúng thầy Toàn là **${formatMoney(cost)}**.\nVí mày chỉ có **${formatMoney(balance)}**, cút đi cày cuốc rồi quay lại! 💸`).catch(() => {});
        return;
    }

    // Lấy câu hỏi của user (bỏ trigger word)
    const userQuestion = rawInput
        .replace(/^(bói tarot|boi tarot|tarot|xem tarot|xem bói tarot|xem boi tarot|trải bài tarot|trai bai tarot)/i, '')
        .trim();

    // Dựng 3 nút chọn chủ đề
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('tarot_love').setLabel('💕 Tình Duyên').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('tarot_career').setLabel('💼 Sự Nghiệp').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('tarot_money').setLabel('💰 Tiền Bạc').setStyle(ButtonStyle.Success)
    );

    const embed = new EmbedBuilder()
        .setTitle("🔮 BÓI BÀI TAROT — THẦY TOÀN GIANG HỒ")
        .setDescription(`Chào **${profile.name}**, vũ trụ đang lắng nghe mày.\nLệ phí cúng thầy Toàn là **${formatMoney(cost)}**.\n\n👇 Hãy chọn chủ đề mày muốn bói dưới đây để thầy bắt đầu gieo quẻ:`)
        .setColor(0x9B59B6)
        .setFooter({ text: "Thời gian chọn: 60 giây" });

    const tarotPromptMsg = await message.reply({ embeds: [embed], components: [row] }).catch(() => null);
    if (!tarotPromptMsg) return;

    const collector = tarotPromptMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000
    });

    collector.on('collect', async (i: any) => {
        if (i.user.id !== userId) {
            await i.reply({ content: "❌ Đéo phải lượt bói của mày! Tự gõ `@BotToan boi tarot` để xem đi cưng!", ephemeral: true }).catch(() => {});
            return;
        }

        let spread: SpreadType;
        let topicName = "";
        if (i.customId === 'tarot_love') {
            spread = SPREADS.love;
            topicName = "Tình Duyên 💕";
        } else if (i.customId === 'tarot_career') {
            spread = SPREADS.career;
            topicName = "Sự Nghiệp 💼";
        } else {
            spread = SPREADS.money;
            topicName = "Tiền Bạc 💰";
        }

        collector.stop('selected');

        // Kiểm tra ví lại một lần nữa đề phòng trường hợp rút ví trong lúc đang chọn
        let curBal = await getBalance(userId);
        if (curBal < cost) {
            await i.update({
                content: `❌ **Đột nhiên nghèo đi à?** Lệ phí bói bài là **${formatMoney(cost)}** nhưng ví mày hiện tại chỉ có **${formatMoney(curBal)}**!`,
                embeds: [],
                components: []
            }).catch(() => {});
            return;
        }

        // Thực hiện trừ tiền
        curBal -= cost;
        await updateBalance(userId, curBal);

        // Hiển thị đang xào bài
        await i.update({
            content: `🔮 **Mày đã chọn chủ đề: ${topicName}**\n*Thầy Toàn đang xào bài, gieo quẻ và gửi tin nhắn riêng cho mày...*`,
            embeds: [],
            components: []
        }).catch(() => {});

        if ('sendTyping' in message.channel) {
            await (message.channel as any).sendTyping().catch(() => {});
        }

        // Rút 3 lá ngẫu nhiên không trùng
        const indexes: number[] = [];
        while (indexes.length < 3) {
            const rand = trueRandom(0, 21);
            if (!indexes.includes(rand)) indexes.push(rand);
        }

        const cards = [TAROT_DECK[indexes[0]], TAROT_DECK[indexes[1]], TAROT_DECK[indexes[2]]];
        const orients = cards.map(() => trueRandom(1, 2) === 1 ? 'Xuôi ⬆️' : 'Ngược ⬇️');
        const meanings = cards.map((c, idx) => orients[idx].includes('Xuôi') ? c.meaningUpright : c.meaningReversed);

        // Phân tích tổ hợp 3 lá (đặc trưng của Tarot chuẩn)
        const allKeywords = cards.flatMap(c => c.keywords).join(', ');
        const dominantElements = [...new Set(cards.map(c => c.element))].join(' + ');
        const reversedCount = orients.filter(o => o.includes('Ngược')).length;
        const energyLevel = reversedCount === 0 ? 'Thuận chiều — năng lượng chảy mạnh' :
                            reversedCount === 1 ? 'Nhẹ cản — có một trở ngại cần vượt' :
                            reversedCount === 2 ? 'Cản trở rõ — cần xem xét lại kỹ' :
                            'Nghịch toàn bộ — đang đi ngược dòng chảy của vũ trụ';

        const debt = await getDebt(userId);

        // Prompt Gemini siêu chuẩn Tarot + hài bựa
        const geminiPrompt = `
Bạn là BotToan — thầy bói Tarot giang hồ bựa nhất Việt Nam, vừa nắm chắc kiến thức Tarot học thuật RWS, vừa cà khịa hài hước.

===== THÔNG TIN NGƯỜI XEM BÓI =====
Tên: "${profile.name}" | Giới tính: ${profile.gender} | Sinh: ${profile.birthday}
Ví tiền: ${curBal}k | Đang nợ: ${debt}k
Câu hỏi: "${userQuestion || 'Xem tổng quan vận mệnh'}"

===== KIỂU TRẢI BÀI ĐÃ CHỌN =====
${spread.name} (phù hợp với chủ đề: ${spread.description})

===== 3 LÁ BÀI ĐÃ RÚT =====
🃏 Lá 1 — ${spread.positions[0]}:
   "${cards[0].name}" (${cards[0].englishName}) | Hướng: ${orients[0]} | Nguyên tố: ${cards[0].element}
   Từ khóa: ${cards[0].keywords.join(', ')}
   Ý nghĩa: ${meanings[0]}

🃏 Lá 2 — ${spread.positions[1]}:
   "${cards[1].name}" (${cards[1].englishName}) | Hướng: ${orients[1]} | Nguyên tố: ${cards[1].element}
   Từ khóa: ${cards[1].keywords.join(', ')}
   Ý nghĩa: ${meanings[1]}

🃏 Lá 3 — ${spread.positions[2]}:
   "${cards[2].name}" (${cards[2].englishName}) | Hướng: ${orients[2]} | Nguyên tố: ${cards[2].element}
   Từ khóa: ${cards[2].keywords.join(', ')}
   Ý nghĩa: ${meanings[2]}

===== PHÂN TÍCH TỔ HỢP =====
Nguyên tố tổng: ${dominantElements}
Từ khóa chủ đề: ${allKeywords}
Năng lượng quẻ: ${energyLevel}

===== NHIỆM VỤ =====
Hãy phân tích BÓI TAROT CHUẨN theo từng vị trí trải bài, rồi kết hợp tương tác giữa 3 lá để đưa ra lời tổng kết.
Phong cách: học thuật Tarot nhưng trình bày theo kiểu hài bựa cà khịa giang hồ, xưng mày-tao, troll nhẹ về tài chính nợ nần.

Trả lời theo ĐÚNG FORMAT sau (không thêm gì bên ngoài):
[LA_1]
(2-3 câu: giải nghĩa lá 1 theo vị trí "${spread.positions[0]}", kết hợp ý nghĩa RWS thực sự + troll bựa)
[LA_2]
(2-3 câu: giải nghĩa lá 2 theo vị trí "${spread.positions[1]}", phân tích tương tác với lá 1 + hài hước)
[LA_3]
(2-3 câu: giải nghĩa lá 3 theo vị trí "${spread.positions[2]}", kết nối câu chuyện 3 lá + cà khịa)
[TONG_KET]
(Tổng kết toàn quẻ: đọc câu chuyện 3 lá như một mạch chảy, lời khuyên thực tế từ Tarot + "lời sấm giang hồ" bựa cuối cùng. Tối đa 4 câu.)

Giới hạn: tổng dưới 1000 ký tự.
`;

        let explanation = '';
        try {
            explanation = await getMatchmakingFortune(geminiPrompt);
        } catch (err) {
            console.error('[TAROT LỖI] Gemini:', err);
        }

        // Parse kết quả Gemini
        let texts = ['', '', '', ''];
        if (explanation) {
            const patterns = [
                /\[LA_1\]([\s\S]*?)(?=\[LA_2\]|$)/i,
                /\[LA_2\]([\s\S]*?)(?=\[LA_3\]|$)/i,
                /\[LA_3\]([\s\S]*?)(?=\[TONG_KET\]|$)/i,
                /\[TONG_KET\]([\s\S]*?)$/i
            ];
            patterns.forEach((p, index) => {
                const m = explanation.match(p);
                if (m) texts[index] = m[1].trim();
            });
        }

        // Fallback theo card nếu Gemini fail
        const fallbacks = [
            `Lá **${cards[0].name}** (${orients[0]}) ở vị trí "${spread.positions[0]}" đang nói với mày rằng: ${meanings[0].split('.')[0]}. Nghe không hay nhỉ con?`,
            `Lá **${cards[1].name}** (${orients[1]}) cảnh báo vị trí "${spread.positions[1]}": ${meanings[1].split('.')[0]}. Thầy nói mày có nghe không?`,
            `Lá **${cards[2].name}** (${orients[2]}) báo trước "${spread.positions[2]}": ${meanings[2].split('.')[0]}. Cầu trời đừng ứng nghiệm nhé!`,
            `Đọc tổng quẻ ${spread.name}: ${energyLevel}. Năng lượng ${dominantElements} đang bao quanh. Thầy khuyên mày bớt cờ bạc lại đi con!`
        ];
        texts = texts.map((t, index) => t || fallbacks[index]);

        // Màu embed theo tổng thể năng lượng
        const dangerousIds = ['13', '15', '16'];
        const hasDanger = cards.some(c => dangerousIds.includes(c.id));
        const hasPositive = cards.some((c, idx) => ['19', '17', '21', '10'].includes(c.id) && orients[idx].includes('Xuôi'));

        let embedColor: number;
        if (hasDanger) embedColor = 0x7C0A02;       // Đỏ máu — hung
        else if (reversedCount >= 2) embedColor = 0xE67E22; // Cam — cản trở
        else if (hasPositive) embedColor = 0xF1C40F;  // Vàng — tốt lành
        else embedColor = 0x9B59B6;                   // Tím — bình thường

        // Chuẩn bị attachments ảnh
        const attachments: AttachmentBuilder[] = [];
        const imgNames = ['card1.jpg', 'card2.jpg', 'card3.jpg'];
        cards.forEach((c, index) => {
            const p = path.join(ASSETS_DIR, `${c.id}.jpg`);
            if (fs.existsSync(p)) attachments.push(new AttachmentBuilder(p, { name: imgNames[index] }));
        });

        // Dựng 4 Embeds
        const buildCardEmbed = (cardIdx: number, posLabel: string, posIcon: string) => {
            const c = cards[cardIdx];
            const o = orients[cardIdx];
            const m = meanings[cardIdx];
            const t = texts[cardIdx];
            const imgName = imgNames[cardIdx];
            const embed = new EmbedBuilder()
                .setTitle(`${posIcon} ${posLabel.toUpperCase()}`)
                .setColor(embedColor)
                .setDescription(
                    `**🃏 ${c.name}** *(${c.englishName})* — Hướng: ${o}\n` +
                    `**🌀 Nguyên tố:** ${c.element} | **🔑 Từ khóa:** ${c.keywords.slice(0, 3).join(' · ')}\n\n` +
                    `**📖 Ý nghĩa chuẩn RWS:**\n*${m}*\n\n` +
                    `**🔮 Lời phán của thầy Toàn:**\n${t}`
                );
            const imgPath = path.join(ASSETS_DIR, `${c.id}.jpg`);
            if (fs.existsSync(imgPath)) embed.setImage(`attachment://${imgName}`);
            return embed;
        };

        const posIcons = ['🕰️', '⚡', '🔭'];
        const embeds = [
            buildCardEmbed(0, `Lá 1 — ${spread.positions[0]}`, posIcons[0]),
            buildCardEmbed(1, `Lá 2 — ${spread.positions[1]}`, posIcons[1]),
            buildCardEmbed(2, `Lá 3 — ${spread.positions[2]}`, posIcons[2]),
        ];

        // Cảnh báo đặc biệt
        let warningText = '';
        if (hasDanger) {
            const dangerCards = cards.filter(c => dangerousIds.includes(c.id)).map(c => `**${c.name}**`).join(', ');
            warningText = `⚠️ **CẢNH BÁO ĐẠI HUNG!** Quẻ bài chứa hung tinh: ${dangerCards}\nNghiệp nặng sắp giáng — tích đức gấp hoặc cúng sòng bài đi con giời! 💀🔥\n\n`;
        }

        const embedSummary = new EmbedBuilder()
            .setTitle(`🃏 ${spread.name} — TỔNG KẾT QUẺ BÓI`)
            .setColor(embedColor)
            .setDescription(
                `${warningText}` +
                `**❓ Câu hỏi:** *"${userQuestion || 'Xem tổng quan vận mệnh'}"*\n\n` +
                `**⚡ Phân tích năng lượng tổng:** ${energyLevel}\n` +
                `**🌀 Nguyên tố kết hợp:** ${dominantElements}\n\n` +
                `**📜 Lời sấm truyền của thầy Toàn:**\n${texts[3]}`
            )
            .addFields({
                name: '💸 Biến Động Tài Chính',
                value: `• Lệ phí bói bài: **-20.000đ**\n• Số dư ví: **${formatMoney(curBal)}** | Nợ: **${formatMoney(debt)}**`
            })
            .setFooter({ text: 'BotToan Tarot — Kết quả bảo mật trong DM', iconURL: message.client.user?.displayAvatarURL() })
            .setTimestamp();

        // Gửi DM bảo mật
        try {
            await message.author.send({
                content: `🔮 **KẾT QUẢ BÓI TAROT RIÊNG TƯ — ${spread.name}** 🔮\n*(Quẻ bài này chỉ mày thấy — không ai ở server nhìn được đâu cưng!)*`,
                embeds: [...embeds, embedSummary],
                files: attachments
            });

            await tarotPromptMsg.edit({
                content: `🔮 **Thầy Toàn đã rút bài ${spread.name} và gửi quẻ kín vào DM rồi!** Mau chui vào góc tối mở tin nhắn riêng ra xem vận mệnh đi con giời! 😉`,
                embeds: [],
                components: []
            }).catch(() => {});
        } catch (err: any) {
            // Hoàn tiền nếu DM bị chặn
            curBal += cost;
            await updateBalance(userId, curBal);
            console.error(`[TAROT LỖI] Không gửi DM được cho ${userId}:`, err.message);
            await tarotPromptMsg.edit({
                content: `❌ **Đéo bói được!** Mày đang chặn DM rồi.\nTao đã **hoàn lại ${formatMoney(cost)}** vào ví. Mở DM lên rồi bói lại nhé! 💸`,
                embeds: [],
                components: []
            }).catch(() => {});
        }
    });

    collector.on('end', async (collected, reason) => {
        if (reason !== 'selected') {
            await tarotPromptMsg.edit({
                content: `❌ **Hết thời gian chọn chủ đề!** Mày lề mề quá cút đi cho thầy bói người khác! ⏳`,
                embeds: [],
                components: []
            }).catch(() => {});
        }
    });
}

