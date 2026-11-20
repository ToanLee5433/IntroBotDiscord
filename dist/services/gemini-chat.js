"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatWithGemini = exports.GeminiChatError = void 0;
exports.classifyChatError = classifyChatError;
exports.getChatErrorReply = getChatErrorReply;
exports.createGeminiChat = createGeminiChat;
const genai_1 = require("@google/genai");
const config_1 = require("../config");
const CHAT_INSTRUCTION = 'Bạn là BotToan, trợ lý Discord hài hước. Trả lời tiếng Việt, xưng mày-tao, không xúc phạm quá đà, không gửi URL và giữ câu trả lời dưới 900 ký tự.';
const HISTORY_TTL_MS = 60 * 60 * 1000;
const MAX_SESSIONS = 100;
const MAX_HISTORY_MESSAGES = 10;
class GeminiChatError extends Error {
    code;
    status;
    constructor(code, status) {
        super(code);
        this.code = code;
        this.status = status;
        this.name = 'GeminiChatError';
    }
}
exports.GeminiChatError = GeminiChatError;
function classifyChatError(error) {
    if (error instanceof GeminiChatError)
        return error;
    const { name, status, message } = (error ?? {});
    if (name === 'TimeoutError' || name === 'AbortError' || status === 408 || status === 504)
        return new GeminiChatError('timeout', status);
    if (status === 401 || status === 403 || (status === 400 && /API_KEY_INVALID|API key (?:not valid|expired)/i.test(message ?? '')))
        return new GeminiChatError('auth', status);
    if (status === 429)
        return new GeminiChatError('quota', status);
    if (status === 404)
        return new GeminiChatError('model', status);
    if (typeof status === 'number' && status >= 500)
        return new GeminiChatError('unavailable', status);
    return new GeminiChatError('request', typeof status === 'number' ? status : undefined);
}
const errorReplies = {
    'missing-key': 'Chat AI chưa được cấu hình. Nhờ admin kiểm tra `GEMINI_API_KEY` trên host nhé.',
    auth: 'Gemini từ chối quyền truy cập. Nhờ admin kiểm tra API key và quyền của project nhé.',
    quota: 'Gemini đang chạm giới hạn lượt gọi hoặc quota. Thử lại sau nhé.',
    model: 'Gemini không tìm thấy model chat. Nhờ admin kiểm tra `GEMINI_CHAT_MODEL` nhé.',
    timeout: 'Gemini phản hồi quá lâu. Thử lại sau nhé.',
    unavailable: 'Gemini đang tạm thời không phản hồi. Thử lại sau nhé.',
    blocked: 'Gemini không thể trả lời nội dung này. Thử diễn đạt khác nhé.',
    empty: 'Gemini không trả về văn bản. Thử hỏi lại ngắn gọn hơn nhé.',
    busy: 'Tao đang trả lời câu trước hoặc đang quá tải. Chờ một chút nhé.',
    request: 'Không gọi được Gemini. Thử lại sau nhé.'
};
function getChatErrorReply(error) {
    return errorReplies[error.code];
}
function createGeminiChat(generate, model) {
    const histories = new Map();
    const pending = new Set();
    return async (sessionId, question) => {
        if (pending.has(sessionId) || pending.size >= 10)
            throw new GeminiChatError('busy');
        const now = Date.now();
        for (const [id, entry] of histories) {
            if (now - entry.updatedAt >= HISTORY_TTL_MS)
                histories.delete(id);
        }
        const messages = [
            ...(histories.get(sessionId)?.messages ?? []),
            { role: 'user', parts: [{ text: question }] }
        ];
        pending.add(sessionId);
        try {
            const result = await generate({
                model,
                contents: messages,
                config: {
                    systemInstruction: CHAT_INSTRUCTION,
                    maxOutputTokens: 1024,
                    abortSignal: AbortSignal.timeout(20_000),
                    httpOptions: { retryOptions: { attempts: 1 } }
                }
            });
            const text = result.text?.replace(/https?:\/\/[^\s]+/gi, '').trim();
            if (!text) {
                const blocked = result.promptFeedback?.blockReason || result.candidates?.some(candidate => ['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION'].includes(candidate.finishReason ?? ''));
                throw new GeminiChatError(blocked ? 'blocked' : 'empty');
            }
            messages.push({ role: 'model', parts: [{ text }] });
            histories.delete(sessionId);
            histories.set(sessionId, { messages: messages.slice(-MAX_HISTORY_MESSAGES), updatedAt: Date.now() });
            if (histories.size > MAX_SESSIONS)
                histories.delete(histories.keys().next().value);
            return text;
        }
        catch (error) {
            throw classifyChatError(error);
        }
        finally {
            pending.delete(sessionId);
        }
    };
}
let client;
exports.chatWithGemini = createGeminiChat(params => {
    if (!config_1.GEMINI_KEY)
        throw new GeminiChatError('missing-key');
    client ??= new genai_1.GoogleGenAI({ apiKey: config_1.GEMINI_KEY });
    return client.models.generateContent(params);
}, config_1.GEMINI_CHAT_MODEL);
