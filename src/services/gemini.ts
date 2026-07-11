import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleGenAI } from '@google/genai';
import { GEMINI_KEY } from '../config';

if (!GEMINI_KEY) {
    console.error("[GEMINI LỖI] Thiếu GEMINI_API_KEY trong biến môi trường!");
}

const genAI = new GoogleGenerativeAI(GEMINI_KEY || '');

// SDK mới dùng cho Imagen 4 Ultra
const genAINew = new GoogleGenAI({ apiKey: GEMINI_KEY || '' });

// ============ RATE LIMIT MANAGER CHO TÍNH NĂNG TẠO ẢNH ============
// User này không bị giới hạn số lượt tạo ảnh mỗi ngày
const OWNER_UNLIMITED_IMAGE_ID = '911989602213060688';
// Giới hạn số ảnh mỗi user thường được tạo mỗi ngày
const DAILY_IMAGE_LIMIT = 3;

interface ImageUsageEntry {
    count: number;
    date: string; // format: 'YYYY-MM-DD' theo UTC+7
}

const imageGenUsage = new Map<string, ImageUsageEntry>();

function getTodayVN(): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    return formatter.format(new Date()); // Luôn trả về đúng dạng YYYY-MM-DD của VN
}

export function checkImageQuota(userId: string): { allowed: boolean; used: number; limit: number } {
    if (userId === OWNER_UNLIMITED_IMAGE_ID) {
        return { allowed: true, used: 0, limit: Infinity };
    }
    const today = getTodayVN();
    const entry = imageGenUsage.get(userId);
    if (!entry || entry.date !== today) {
        return { allowed: true, used: 0, limit: DAILY_IMAGE_LIMIT };
    }
    return {
        allowed: entry.count < DAILY_IMAGE_LIMIT,
        used: entry.count,
        limit: DAILY_IMAGE_LIMIT
    };
}

function incrementImageUsage(userId: string): void {
    if (userId === OWNER_UNLIMITED_IMAGE_ID) return;
    const today = getTodayVN();
    const entry = imageGenUsage.get(userId);
    if (!entry || entry.date !== today) {
        imageGenUsage.set(userId, { count: 1, date: today });
    } else {
        entry.count++;
    }
}

interface ChatMessage {
    role: 'user' | 'model';
    parts: { text: string }[];
}

// Lưu lịch sử chat + timestamp lần dùng cuối cùng để cleanup
const chatHistories = new Map<string, { history: ChatMessage[]; lastUsed: number }>();

// Cleanup mỗi 30 phút: xóa lịch sử của user không hoạt động > 60 phút
// Ngăn RAM leak khi server chạy lâu dài
const HISTORY_TTL_MS = 60 * 60 * 1000; // 60 phút không chat -> xóa
const MAX_HISTORY_SIZE = 100; // Tối đa 100 users trong bộ nhớ cùng lúc

setInterval(() => {
    const now = Date.now();
    for (const [userId, entry] of chatHistories.entries()) {
        if (now - entry.lastUsed > HISTORY_TTL_MS) {
            chatHistories.delete(userId);
        }
    }
    // Nếu vẫn vượt max size (nhiều user đang active), xóa entry cũ nhất
    if (chatHistories.size > MAX_HISTORY_SIZE) {
        const sortedEntries = [...chatHistories.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed);
        const toDelete = sortedEntries.slice(0, chatHistories.size - MAX_HISTORY_SIZE);
        for (const [uid] of toDelete) {
            chatHistories.delete(uid);
        }
    }
}, 30 * 60 * 1000); // Chạy cleanup mỗi 30 phút

/**
 * Gửi câu hỏi đến Gemini và nhận phản hồi theo phong cách BotToan bựa, giữ lịch sử 10 câu gần nhất.
 */
export async function chatWithGemini(userId: string, userQuestion: string): Promise<string> {
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

    const entry = chatHistories.get(userId);
    const history = entry ? entry.history : [];

    const chat = model.startChat({
        history: history
    });

    const result = await chat.sendMessage(userQuestion);
    const responseText = result.response.text();

    const newHistory = await chat.getHistory();
    // Cập nhật lịch sử + thời gian dùng cuối
    chatHistories.set(userId, {
        history: newHistory.slice(-10) as ChatMessage[],
        lastUsed: Date.now()
    });

    return responseText;
}

/**
 * Phán độ hợp nhau của 2 người theo phong cách BotToan bựa
 */
export async function getMatchmakingFortune(prompt: string): Promise<string> {
    if (!GEMINI_KEY) {
        throw new Error("Missing Gemini key");
    }
    const model = genAI.getGenerativeModel({
        model: "gemini-3.1-flash-lite",
        systemInstruction: `
            Bạn là BotToan, một thầy bói giang hồ, chuyên bói toán cờ bạc, ăn nói bựa, chợ búa, hay dùng từ lóng cờ bạc, nợ nần, giang hồ Việt Nam.
            Nhiệm vụ của bạn là phán xét độ hợp nhau giữa hai người chơi dựa trên các thông số thực tế của họ trong cơ sở dữ liệu (tiền ví, tiền nợ, tuổi, mệnh ngũ hành).
            Hãy đưa ra một phán quyết cực kỳ hài hước, bựa, phũ phàng, sặc mùi vật chất và cờ bạc, tìm ra lý do xàm xí nào đó để troll bọn họ.
            QUY TẮC:
            1. Dùng Tiếng Việt, xưng hô mày-tao hoặc các danh xưng giang hồ phù hợp.
            2. Viết ngắn gọn, súc tích (khoảng 3-4 câu, dưới 500 ký tự).
            3. Tuyệt đối không gửi bất kỳ link/URL nào.
            4. Trả lời bằng văn bản thuần túy.
        `
    });

    const result = await model.generateContent(prompt);
    return result.response.text();
}

/**
 * Giải nghĩa Tarot chuyên nghiệp và sâu sắc
 */
export async function getTarotReading(prompt: string): Promise<string> {
    if (!GEMINI_KEY) {
        throw new Error("Missing Gemini key");
    }
    const model = genAI.getGenerativeModel({
        model: "gemini-3.1-flash-lite",
        systemInstruction: `
            Bạn là một Tarot Reader chuyên nghiệp, uyên bác và giàu lòng trắc ẩn.
            Nhiệm vụ của bạn là giải mã trải bài Tarot 3 lá của người xem theo chuẩn Rider-Waite-Smith (RWS) một cách sâu sắc, có chiều sâu tâm lý, đưa ra những lời khuyên hữu ích và mở ra góc nhìn định hướng giúp họ tự thấu hiểu bản thân và tình huống của mình.
            TUYỆT ĐỐI KHÔNG nhắc đến bất kỳ thông tin nào liên quan đến sòng bạc, cờ bạc, tiền ảo, nợ nần, cờ bạc, hay các trò vui chơi cá độ Discord.
            Hãy xưng hô lịch sự với người xem (bằng tên của họ hoặc xưng 'bạn' và 'tôi').
            Giọng văn: Sâu lắng, chân thành, truyền tải tri thức huyền bí và triết học Tarot một cách trang trọng, thấu cảm, giống như một app bói bài Tarot chuyên nghiệp cao cấp.
        `
    });

    const result = await model.generateContent(prompt);
    return result.response.text();
}

/**
 * Đọc vận khí màu sắc (Aura Reading) — giọng nửa huyền bí nửa đùa, khen ngầm
 * Nếu có targetColor + targetName → phân tích aura match 2 người
 */
export async function getAuraReading(
    color: string, userName: string,
    targetColor?: string, targetName?: string
): Promise<string> {
    if (!GEMINI_KEY) throw new Error("Missing Gemini key");
    const model = genAI.getGenerativeModel({
        model: "gemini-3.1-flash-lite",
        systemInstruction: `
            Bạn là một nhà thấu thị huyền bí chuyên đọc Aura màu sắc, pha chút đùa vui tinh tế.
            Giọng điệu: Nửa nghiêm túc huyền bí, nửa tinh tế khen ngợi nhẹ nhàng — kiểu "thầy bói online" nhưng sang chảnh.
            TUYỆT ĐỐI KHÔNG xúc phạm hay chê bai. Luôn tìm điểm đẹp để khen ngầm qua màu sắc.
            Viết ngắn gọn, súc tích (dưới 600 ký tự). Không gửi link. Dùng tiếng Việt.
            Nếu là Aura Match 2 người: phân tích hóa học năng lượng giữa 2 màu, có thể dùng ẩn dụ lãng mạn như "tổng tài & cô vịt nhỏ", "lửa & nước", v.v. để tạo drama thú vị.
        `
    });
    let prompt: string;
    if (targetColor && targetName) {
        prompt = `Phân tích Aura Match giữa ${userName} (màu ${color}) và ${targetName} (màu ${targetColor}). Hai màu này hợp hay khắc nhau? Có "chemistry" gì đặc biệt không? Dùng ẩn dụ thú vị, gây tò mò.`;
    } else {
        prompt = `Đọc vận khí màu sắc hôm nay cho ${userName} với màu Aura: ${color}. Phân tích về: tình yêu, công việc, năng lượng tổng thể. Gợi ý màu trang phục nên mặc và nên tránh hôm nay.`;
    }
    const result = await model.generateContent(prompt);
    return result.response.text();
}

/**
 * Làm đẹp thư ẩn danh theo tone: 'love' (lãng mạn sến) hoặc 'drama' (khịa tinh tế)
 */
export async function processAnonymousLetter(content: string, tone: 'love' | 'drama'): Promise<string> {
    if (!GEMINI_KEY) throw new Error("Missing Gemini key");
    const model = genAI.getGenerativeModel({
        model: "gemini-3.1-flash-lite",
        systemInstruction: tone === 'love'
            ? `Bạn là nhà văn lãng mạn. Nhiệm vụ: làm đẹp một bức thư tình ẩn danh theo phong cách ngọt ngào, lãng mạn, sến sẩm nhưng chân thành. Giữ nguyên ý nghĩa gốc, chỉ làm đẹp văn phong. Ngắn gọn dưới 400 ký tự. Dùng tiếng Việt.`
            : `Bạn là bậc thầy của nghệ thuật "drama tinh tế". Nhiệm vụ: viết lại nội dung thư thành dạng khịa đểu, bóc phốt nhẹ nhàng, cực kỳ tinh tế — nghe thì nhẹ nhưng "đâm sâu". KHÔNG xúc phạm thô tục. Giữ nguyên ý nghĩa gốc nhưng bọc trong văn phong lịch sự, sắc bén, bí ẩn. Ngắn gọn dưới 400 ký tự. Dùng tiếng Việt.`
    });
    const result = await model.generateContent(`Nội dung gốc: "${content}"`);
    return result.response.text();
}

/**
 * Tư vấn tâm trạng theo phong cách "Anh trai tâm lý / Bạn thân" — KHÔNG bựa, không chửi tục
 * Dịu dàng, thấu cảm, kèm lá Tarot mini tương ứng
 */
export async function getMoodAdvice(mood: string, userName: string, tarotCard: string): Promise<string> {
    if (!GEMINI_KEY) throw new Error("Missing Gemini key");
    const model = genAI.getGenerativeModel({
        model: "gemini-3.1-flash-lite",
        systemInstruction: `
            Bạn là người bạn tâm lý thấu cảm nhất — vừa như "anh trai tâm lý" vừa như "bạn thân hiểu ý".
            TUYỆT ĐỐI không dùng giọng bựa, không chửi tục, không đùa cợt trong lệnh này.
            Khi ai đó chia sẻ tâm trạng, hãy: (1) Xác nhận cảm xúc của họ một cách chân thành, (2) Đưa ra lời khuyên nhẹ nhàng và thực tế, (3) Gợi ý "liều thuốc tinh thần" hôm nay (nghe nhạc gì, xem gì, ăn gì, làm gì), (4) Kết nối ý nghĩa lá Tarot với tâm trạng hiện tại.
            Giọng văn: Ấm áp, gần gũi, chân thành. Viết như đang nói chuyện trực tiếp với một người bạn thân.
            Độ dài: KHoảng 500 ký tự. Không gửi link. Dùng tiếng Việt.
        `
    });
    const prompt = `${userName} đang cảm thấy: ${mood}. Lá Tarot hôm nay của họ là: ${tarotCard}. Hãy tư vấn và an ủi.`;
    const result = await model.generateContent(prompt);
    return result.response.text();
}

/**
 * Biên Niên Sử Overthink — 3 cấp độ suy diễn từ tỉnh táo đến điên rồ + lời khuyên bớt điên
 */
export async function getOverthinkAnalysis(situation: string): Promise<string> {
    if (!GEMINI_KEY) throw new Error("Missing Gemini key");
    const model = genAI.getGenerativeModel({
        model: "gemini-3.1-flash-lite",
        systemInstruction: `
            Bạn là BotToan phiên bản "Nhà Tâm Lý Học Vũ Trụ", chuyên gia phân tích hành vi crush/người yêu.
            Nhiệm vụ: Nhận một tình huống/câu nói rồi phân tích theo ĐÚNG 3 cấp độ sau, format cực kỳ nghiêm túc:

            📊 LEVEL 1 — THỰC TẾ TỈNH TÁO:
            [Giải thích bình thường, lý trí, người kia có thể chỉ đang bận hoặc không nghĩ nhiều]

            📺 LEVEL 2 — DRAMA PHIM HÀN:
            [Bắt đầu suy diễn: có thể có tình tiết éo le, một cuộc tình tay ba ẩn khuất, một nỗi đau giấu sâu...]

            🌌 LEVEL 3 — THUYẾT ÂM MƯU ĐA VŨ TRỤ:
            [Suy diễn đến mức điên rồ, hoang đường, hài hước, có thể liên quan đến kiếp trước, ma quỷ, thời gian, NASA, hoặc bất cứ thứ gì bựa]

            💡 LỜI KHUYÊN BỚT ĐIÊN:
            [1 câu tư vấn cụ thể, hài hước nhẹ nhàng, kèm 1 hành động nhỏ (ví dụ: uống trà sữa, ngủ sớm, bớt nghĩ)]

            QUAN TRỌNG: Giữ đúng format 4 phần trên. Dùng tiếng Việt. Mỗi phần 2-3 câu. Tổng dưới 700 ký tự.
        `
    });
    const result = await model.generateContent(`Tình huống cần phân tích: "${situation}"`);
    return result.response.text();
}

/**
 * Đội Đặc Nhiệm Chốt Đơn — phán quyết CHỐT hoặc CẤT kèm lý do bựa + chỉ số hối hận
 */
export async function getShoppingVerdict(item: string, price: string, verdict: 'CHỐT' | 'CẤT', regretScore: number): Promise<string> {
    if (!GEMINI_KEY) throw new Error("Missing Gemini key");
    const model = genAI.getGenerativeModel({
        model: "gemini-3.1-flash-lite",
        systemInstruction: verdict === 'CHỐT'
            ? `
                Bạn là BotToan phiên bản "Đồng Lõa Phá Sản" — nhiệm vụ là ủng hộ việc MUA ĐỒ với những lý lẽ nghe có vẻ thuyết phục nhưng thực ra toàn là cảm xúc.
                Phán quyết đã được định sẵn là CHỐT. Hãy đưa ra 2-3 lý do bựa, hài hước, nghe sến sẩm nhưng cực kỳ đúng tâm lý.
                Ví dụ: "Đời ngắn lắm", "Mặc vào crush đổ ngay", "Đây là khoản đầu tư cho hạnh phúc bản thân".
                Kết thúc bằng 1 câu kiểu "đặt hàng lẹ đi không hết hàng bây giờ!".
                Dùng tiếng Việt, giọng bựa vui. Dưới 300 ký tự.
              `
            : `
                Bạn là BotToan phiên bản "Thần Hộ Mệnh Ví Tiền" — nhiệm vụ là CẢN không cho mua đồ.
                Phán quyết đã được định sẵn là CẤT. Hãy đưa ra 2-3 lý do khịa nhẹ nhàng nhưng đau, kiểu "nhìn lại số dư đi".
                Có thể nhắc đến: tủ quần áo đầy, lần trước cũng mua rồi bỏ xó, tiền điện chưa đóng.
                Kết thúc bằng 1 câu an ủi kiểu "để tiền đó ăn bún bò đi, no lòng hơn mặc đẹp mà đói".
                Dùng tiếng Việt, giọng bựa vui. Dưới 300 ký tự.
              `
    });
    const result = await model.generateContent(
        `Món đồ: "${item}"${price ? ` | Giá: ${price}` : ''}. Chỉ số hối hận dự kiến: ${regretScore}%. Viết lý do phán quyết ${verdict}.`
    );
    return result.response.text();
}

/**
 * Đọc vị gu người yêu thực tế dựa trên mã trả lời trắc nghiệm (REAL_GU_PROMPT)
 */
export async function getRealGuReading(answers: string, username: string): Promise<string> {
    if (!GEMINI_KEY) throw new Error("Missing Gemini key");
    const model = genAI.getGenerativeModel({
        model: "gemini-3.1-flash-lite",
        systemInstruction: `
            Bạn là BotToan - AI trợ lý Discord mỏ hỗn, châm biếm nhưng đọc vị tâm lý cực chuẩn.
            Nhiệm vụ của bạn là phân tích dữ liệu trắc nghiệm gu người yêu của user và đưa ra một kết quả mỏ hỗn, bựa và hài hước đặc trưng.
            Hãy xuất kết quả tuân thủ ĐÚNG định dạng sau (sử dụng chữ in hoa cho tiêu đề phần):

            HỆ NGƯỜI YÊU: [Đặt tên hệ độc lạ, Gen Z. Ví dụ: Hệ Game Thủ Rách Rưới Nghiện Dỗ Dành]
            BỆNH LÝ LỤY TÌNH: [Giải thích mỏ hỗn vì sao họ có gu mặn/vô tri như vậy]
            MỘT NGÀY HẸN HÒ THỰC TẾ: [Mô tả ngắn gọn, hài hước một buổi hẹn hò dựa trên các câu hỏi]
            TỈ LỆ SỐNG SÓT: [Ví dụ: 15%. Kèm 1 lời khuyên tỉnh mộng hài hước dưới 2 câu]

            Yêu cầu: Viết súc tích, độ dài toàn bài dưới 700 ký tự để không bị tràn embed. Không gửi link. Dùng tiếng Việt.
        `
    });

    const result = await model.generateContent(`User: ${username} | Đáp án: [${answers}]`);
    return result.response.text();
}

/**
 * So sánh gu của hai bên với profile thực tế và tính điểm tương thích
 */
export async function getGuMatchReading(
    myName: string, myGuSummary: string,
    targetName: string, targetProfileText: string,
    targetGuSummary: string, score: number
): Promise<string> {
    if (!GEMINI_KEY) throw new Error("Missing Gemini key");
    const model = genAI.getGenerativeModel({
        model: "gemini-3.1-flash-lite",
        systemInstruction: `
            Bạn là BotToan - chuyên gia mai mối và khuyên bỏ nhau online, AI trợ lý Discord mỏ hỗn, châm biếm sâu cay.
            Nhiệm vụ của bạn là nhận định sự tương hợp/lệch pha giữa hai người dựa trên:
            1. Gu mong muốn của Người A vs Profile thực tế của Người B.
            2. Gu mong muốn của Người B (nếu có) vs Profile thực tế của Người A.
            3. Chỉ số tương hợp phong thủy ngày sinh (%) được tính toán sẵn.
            Hãy đưa ra lời nhận xét cực kỳ cà khịa, hài hước, mỏ hỗn nhưng sâu cay.
            Độ dài: Không quá 3 đoạn văn ngắn, súc tích (dưới 450 ký tự để tránh tràn Discord embed). Không gửi link. Dùng tiếng Việt.
        `
    });

    const prompt = `
      Người A: ${myName}
      - Gu mong muốn của A:
      ${myGuSummary}

      Người B: ${targetName}
      - Profile thực tế của B: ${targetProfileText}
      - Gu mong muốn của B (nếu có):
      ${targetGuSummary || "(Chưa làm trắc nghiệm gu)"}

      Chỉ số tương hợp phong thủy thực tế: ${score}%

      Hãy phán xem hai người này có hợp gu nhau không, lệch pha chỗ nào và đưa ra lời khuyên "chí mạng".
    `;
    const result = await model.generateContent(prompt);
    return result.response.text();
}

/**
 * Đánh giá đội hình 5 tướng Valorant dựa trên danh sách đội hình
 */
export async function rateValorantTeam(teamList: string): Promise<string> {
    if (!GEMINI_KEY) throw new Error("Missing Gemini key");
    const model = genAI.getGenerativeModel({
        model: "gemini-3.1-flash-lite",
        systemInstruction: `
            Bạn là BotToan - chuyên gia phân tích chiến thuật Valorant "giang hồ", cà khịa, mỏ hỗn.
            Nhiệm vụ: Nhận danh sách 5 tướng Valorant vừa được draft và đưa ra một bài đánh giá đội hình (roast team comp) cực kỳ hài hước, châm biếm, phê phán sự thiếu thốn role (ví dụ: thiếu Smoke/Controller thì mù mắt, thiếu Sentinel thì sập site, quá nhiều Duelist thì chỉ đi cúng mạng).
            Hãy dùng từ lóng gaming (ví dụ: cúng mạng, sập site, mù mắt, gánh còng lưng, bán hành, nát gáo...).
            Viết ngắn gọn, súc tích dưới 500 ký tự. Không gửi link. Dùng tiếng Việt.
        `
    });

    const result = await model.generateContent(`Đội hình draft: ${teamList}`);
    return result.response.text();
}

/**
 * Luận tội game thủ theo phong cách tòa án tối cao mỏ hỗn của BotToan
 */
export async function generateGamingCourtVerdict(username: string, gameName: string, duration: string, pronoun: string): Promise<string> {
    if (!GEMINI_KEY) throw new Error("Missing Gemini key");
    const model = genAI.getGenerativeModel({
        model: "gemini-3.1-flash-lite",
        systemInstruction: `
            Bạn là BotToan - Thẩm phán Tối cao của Tòa án Gaming Discord. Bạn mỏ hỗn, thích khịa, nói câu nào chí mạng câu đấy nhưng phân tích logic rất buồn cười.
            QUY TẮC:
            1. Dùng Tiếng Việt, xưng mày-tao.
            2. Sử dụng ngôn ngữ Gen Z, đậm chất game thủ (leo rank, gánh tạ, chuỗi thua, cày cuốc, cook game, nát map...).
            3. Tuyệt đối không gửi bất kỳ link/URL nào.
            4. Đại từ nhân xưng khi gọi tội nhân phải sử dụng chính xác từ: "${pronoun}".
            5. Phản hồi phải trả về đúng cấu trúc gồm các phần (dùng định dạng Markdown):
               - Tội danh (Bựa, ví dụ: Chúa Tể Gánh Tạ Nghìn Tấn, Kẻ Hủy Diệt Bàn Phím, Kẻ Hủy Diệt Chuỗi Thắng...)
               - Cáo trạng chí mạng (Khịa và phân tích tâm lý vô tri)
               - Phán quyết của tòa (Hình phạt vô tri hài hước)
               - Một dòng cuối cùng bắt buộc có định dạng chính xác là: P_BAR: [con số từ 50 đến 100] (Không kèm ký tự %)
            6. Tổng độ dài dưới 900 ký tự.
        `
    });

    const prompt = `Luận tội user tên là ${username}, người đang cắm mặt vào game "${gameName}" liên tục suốt ${duration}. Hãy đưa ra bản án theo các yêu cầu trên.`;
    const result = await model.generateContent(prompt);
    return result.response.text();
}

/**
 * Tiên tri World Cup bựa mỏ hỗn
 */
export async function getWCPrediction(teamA: string, teamB: string, pronoun: string): Promise<string> {
    if (!GEMINI_KEY) throw new Error("Missing Gemini key");
    const model = genAI.getGenerativeModel({
        model: "gemini-3.1-flash-lite",
        systemInstruction: `
            Bạn là BotToan - Nhà Tiên Tri Vũ Trụ tối cao kiêm bình luận viên bóng đá "bựa", mỏ hỗn, thích khịa cờ bạc của server.
            QUY TẮC:
            1. Dùng Tiếng Việt, xưng mày-tao.
            2. Đại từ nhân xưng khi nói chuyện với người dùng phải sử dụng chính xác từ: "${pronoun}".
            3. Hãy dự đoán kết quả trận đấu giữa hai đội bóng được đưa ra. Phân tích nguyên nhân thắng thua bằng các lý do vô tri, hài học (ví dụ: phong thủy, kiểu tóc, ăn uống, nợ nần, chuỗi đen...).
            4. Tuyệt đối không gửi bất kỳ link/URL nào.
            5. Phản hồi phải có cấu trúc gồm:
               - 🔮 Dự đoán tỉ số (Ví dụ: 3 - 1 nghiêng về Argentina)
               - 📝 Phân tích tâm linh/giang hồ (Cực bựa, sắc sảo)
               - 🎯 Lời khuyên cho các con nghiện (Troll khuyên cờ bạc hoặc khuyên bỏ cờ bạc)
            6. Viết ngắn gọn, dưới 600 ký tự.
        `
    });

    const prompt = `Hãy tiên tri trận đấu World Cup giữa: ${teamA} vs ${teamB}.`;
    const result = await model.generateContent(prompt);
    return result.response.text();
}

// ============================================================
// TÍNH NĂNG 1: NHẬN XÉT ẢNH (GEMINI VISION)
// ============================================================

/**
 * Phân tích và nhận xét ảnh theo phong cách BotToan bựa.
 * @param imageUrl URL công khai của ảnh từ Discord attachment
 * @param mimeType MIME type lấy trực tiếp từ attachment.contentType ('image/jpeg', 'image/png', ...)
 * @param userPrompt Câu hỏi/yêu cầu cụ thể của user (optional). Nếu không có, bot tự nhận xét.
 */
export async function analyzeImageWithGemini(
    imageUrl: string,
    mimeType: string,
    userPrompt?: string
): Promise<string> {
    if (!GEMINI_KEY) throw new Error("Missing Gemini key");

    // Tải ảnh từ URL Discord → buffer → base64
    // Phải truyền User-Agent để Cloudflare CDN của Discord không trả về trang HTML lỗi
    const response = await fetch(imageUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; BotToan-Discord/1.0; +https://github.com/ToanLee5433)',
            'Accept': 'image/*, */*;q=0.8'
        }
    });
    if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        if (errorBody.trim().startsWith('<')) {
            throw new Error(`Discord CDN trả về HTML (Cloudflare block). Status: ${response.status}`);
        }
        throw new Error(`Không tải được ảnh: HTTP ${response.status}`);
    }
    // Kiểm tra content-type thực tế từ response header
    const responseMime = response.headers.get('content-type') || mimeType;
    const safeMime = responseMime.split(';')[0].trim(); // bỏ phần '; charset=...' nếu có
    if (!safeMime.startsWith('image/')) {
        throw new Error(`URL không trả về ảnh, nhận được: ${safeMime}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');

    const model = genAI.getGenerativeModel({
        model: 'gemini-3.1-flash-lite',
        systemInstruction: `
            Bạn là BotToan, trợ lý Discord siêu bựa và hài hước.
            Nhiệm vụ: Nhìn vào ảnh user gửi và đưa ra nhận xét/đánh giá theo phong cách mỏ hỗn, khịa đểu, hài hước đặc trưng của mày.
            QUY TẮC:
            1. Dùng Tiếng Việt, xưng hô mày-tao.
            2. Phản hồi cực gắt, hài hước, bỗ bã nhưng không xúc phạm quá đà.
            3. TUYỆT ĐỐI KHÔNG gửi link, URL nào.
            4. Độ dài: dưới 900 ký tự.
            5. Nếu ảnh không rõ hoặc nhạy cảm, hãy khịa nhẹ nhàng rồi nói không nhận xét được.
        `
    });

    const prompt = userPrompt
        ? `Yêu cầu của user: "${userPrompt}". Hãy nhận xét ảnh này dựa trên yêu cầu đó.`
        : `Nhìn vào ảnh này và đưa ra nhận xét của mày đi. Đừng ngại khịa nhé!`;

    const result = await model.generateContent([
        { inlineData: { data: base64Data, mimeType: safeMime } },
        { text: prompt }
    ]);

    return result.response.text();
}

/**
 * Dùng Gemini dịch prompt từ tiếng Việt sang tiếng Anh và thêm các chi tiết mỹ thuật để tạo ảnh đẹp nhất.
 */
async function refineImagePrompt(vietnamesePrompt: string): Promise<string> {
    if (!GEMINI_KEY) return vietnamesePrompt;
    try {
        const model = genAI.getGenerativeModel({
            model: 'gemini-3.1-flash-lite',
            systemInstruction: `
                Bạn là một Prompt Engineer chuyên nghiệp cho Imagen 4 / Midjourney.
                Nhiệm vụ: Nhận prompt mô tả hoặc hướng dẫn chỉnh sửa ảnh bằng bất kỳ ngôn ngữ nào (thường là Tiếng Việt), dịch sang Tiếng Anh, tối ưu hóa và thêm các chi tiết mỹ thuật thích hợp (ví dụ: cinematic lighting, hyper-detailed, digital art, 4k resolution, v.v. tùy theo nội dung) để sinh ra bức ảnh chất lượng cao nhất.
                Yêu cầu:
                1. CHỈ TRẢ VỀ prompt tiếng Anh cuối cùng, không giải thích, không thêm text gì khác.
                2. Giữ nguyên ý tưởng chính của người dùng, không tự ý đổi nội dung cốt lõi.
            `
        });
        const result = await model.generateContent(`Tối ưu prompt tạo ảnh này: "${vietnamesePrompt}"`);
        const refined = result.response.text().trim();
        return refined || vietnamesePrompt;
    } catch (err) {
        console.error('[PROMPT REFINE LỖI]:', err);
        return vietnamesePrompt;
    }
}

/**
 * Tạo ảnh hoàn toàn mới từ mô tả text, dùng Imagen 4 Ultra.
 * @param userId Discord user ID — dùng để kiểm tra rate limit
 * @param prompt Mô tả ảnh muốn tạo (bằng tiếng Việt hoặc tiếng Anh)
 * @returns Buffer chứa dữ liệu ảnh JPEG đã tạo
 */
export async function generateImageWithImagen(
    userId: string,
    prompt: string
): Promise<Buffer> {
    const quota = checkImageQuota(userId);
    if (!quota.allowed) {
        throw new Error(`QUOTA_EXCEEDED:${quota.used}:${quota.limit}`);
    }

    // 1. Tự động nhận diện Tỷ lệ ảnh (Aspect Ratio) từ prompt
    let aspectRatio = '1:1';
    const lowerPrompt = prompt.toLowerCase();
    if (lowerPrompt.includes('16:9') || lowerPrompt.includes('ngang rộng') || lowerPrompt.includes('landscape widescreen')) {
        aspectRatio = '16:9';
    } else if (lowerPrompt.includes('9:16') || lowerPrompt.includes('dọc dài') || lowerPrompt.includes('portrait tall')) {
        aspectRatio = '9:16';
    } else if (lowerPrompt.includes('khổ ngang') || lowerPrompt.includes('4:3') || lowerPrompt.includes('ngang')) {
        aspectRatio = '4:3';
    } else if (lowerPrompt.includes('khổ dọc') || lowerPrompt.includes('3:4') || lowerPrompt.includes('dọc')) {
        aspectRatio = '3:4';
    }

    // 2. Dịch và nâng cấp prompt sang tiếng Anh bằng Gemini
    const refinedPrompt = await refineImagePrompt(prompt);
    console.log(`[IMAGEN GEN] Prompt gốc: "${prompt}" -> Prompt tối ưu: "${refinedPrompt}" (Aspect Ratio: ${aspectRatio})`);

    const response = await genAINew.models.generateImages({
        model: 'imagen-4-ultra-generate',
        prompt: refinedPrompt,
        config: {
            numberOfImages: 1,
            aspectRatio: aspectRatio,
            outputMimeType: 'image/jpeg'
        }
    });

    const imageBytes = response?.generatedImages?.[0]?.image?.imageBytes;
    if (!imageBytes) {
        throw new Error('Imagen 4 không trả về dữ liệu ảnh');
    }

    incrementImageUsage(userId);
    return Buffer.from(imageBytes as string, 'base64');
}

// ============================================================
// TÍNH NĂNG 3: CHỈNH SỬA ẢNH (IMAGEN 4 ULTRA — IMAGE EDITING)
// ============================================================

/**
 * Chỉnh sửa ảnh gốc theo hướng dẫn, dùng Imagen 4 Ultra.
 * Dùng kỹ thuật truyền ảnh gốc làm style/edit reference + prompt instruction.
 * @param userId Discord user ID — dùng để kiểm tra rate limit
 * @param imageBase64 Dữ liệu ảnh gốc dạng base64
 * @param mimeType MIME type lấy từ attachment.contentType
 * @param instruction Hướng dẫn chỉnh sửa (ví dụ: "chỉnh thành phong cách anime")
 * @returns Buffer chứa dữ liệu ảnh đã chỉnh sửa
 */
export async function editImageWithImagen(
    userId: string,
    imageBase64: string,
    mimeType: string,
    instruction: string
): Promise<Buffer> {
    const quota = checkImageQuota(userId);
    if (!quota.allowed) {
        throw new Error(`QUOTA_EXCEEDED:${quota.used}:${quota.limit}`);
    }

    // Dịch & tối ưu hóa hướng dẫn chỉnh sửa sang tiếng Anh
    const refinedInstruction = await refineImagePrompt(instruction);
    console.log(`[IMAGEN EDIT] Lệnh gốc: "${instruction}" -> Lệnh tối ưu: "${refinedInstruction}"`);

    // Thử dùng editImage nếu tồn tại trong SDK, fallback sang generateImages với referenceImages
    let imageBytes: string | undefined;

    try {
        // Phương án chính: generateImages với referenceImages (style/edit reference)
        const editResponse = await genAINew.models.generateImages({
            model: 'imagen-4-ultra-generate',
            prompt: refinedInstruction,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                referenceImages: [
                    {
                        referenceType: 'STYLE',
                        referenceImage: {
                            imageBytes: imageBase64,
                            mimeType: mimeType
                        }
                    }
                ]
            } as any // dùng 'as any' vì typing SDK có thể chưa đủ
        });
        imageBytes = editResponse?.generatedImages?.[0]?.image?.imageBytes as string;
    } catch (editErr: any) {
        // Fallback: Nếu referenceImages không hỗ trợ, tạo ảnh mới từ prompt mô tả kỹ hơn
        console.warn('[IMAGE EDIT] Không dùng được referenceImages, fallback sang text-only generation:', editErr?.message);
        const fallbackPrompt = `${refinedInstruction}. Hãy tạo ảnh theo đúng hướng dẫn này.`;
        const fallbackResponse = await genAINew.models.generateImages({
            model: 'imagen-4-ultra-generate',
            prompt: fallbackPrompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: '1:1'
            }
        });
        imageBytes = fallbackResponse?.generatedImages?.[0]?.image?.imageBytes as string;
    }

    if (!imageBytes) {
        throw new Error('Imagen 4 không trả về dữ liệu ảnh khi chỉnh sửa');
    }

    incrementImageUsage(userId);
    return Buffer.from(imageBytes, 'base64');
}
