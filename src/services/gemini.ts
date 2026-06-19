import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_KEY } from '../config';

if (!GEMINI_KEY) {
    console.error("[GEMINI LỖI] Thiếu GEMINI_API_KEY trong biến môi trường!");
}

const genAI = new GoogleGenerativeAI(GEMINI_KEY || '');

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
        model: "gemini-2.0-flash-lite",
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
