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

const chatHistories = new Map<string, ChatMessage[]>();

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

    const history = chatHistories.get(userId) || [];

    const chat = model.startChat({
        history: history
    });

    const result = await chat.sendMessage(userQuestion);
    const responseText = result.response.text();

    const newHistory = await chat.getHistory();
    chatHistories.set(userId, newHistory.slice(-10) as ChatMessage[]);

    return responseText;
}
