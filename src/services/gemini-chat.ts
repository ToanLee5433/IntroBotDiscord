import { GoogleGenAI, type Content, type GenerateContentParameters } from '@google/genai';
import { GEMINI_CHAT_MODEL, GEMINI_KEY } from '../config';

const CHAT_INSTRUCTION = 'Bạn là BotToan, trợ lý Discord hài hước. Trả lời tiếng Việt, xưng mày-tao, không xúc phạm quá đà, không gửi URL và giữ câu trả lời dưới 900 ký tự.';
const HISTORY_TTL_MS = 60 * 60 * 1000;
const MAX_SESSIONS = 100;
const MAX_HISTORY_MESSAGES = 10;

type ErrorCode = 'missing-key' | 'auth' | 'quota' | 'model' | 'timeout' | 'unavailable' | 'blocked' | 'empty' | 'busy' | 'request';

export class GeminiChatError extends Error {
    constructor(public readonly code: ErrorCode, public readonly status?: number) {
        super(code);
        this.name = 'GeminiChatError';
    }
}

export function classifyChatError(error: unknown): GeminiChatError {
    if (error instanceof GeminiChatError) return error;
    const { name, status, message } = (error ?? {}) as { name?: string; status?: number; message?: string };
    if (name === 'TimeoutError' || name === 'AbortError' || status === 408 || status === 504) return new GeminiChatError('timeout', status);
    if (status === 401 || status === 403 || (status === 400 && /API_KEY_INVALID|API key (?:not valid|expired)/i.test(message ?? ''))) return new GeminiChatError('auth', status);
    if (status === 429) return new GeminiChatError('quota', status);
    if (status === 404) return new GeminiChatError('model', status);
    if (typeof status === 'number' && status >= 500) return new GeminiChatError('unavailable', status);
    return new GeminiChatError('request', typeof status === 'number' ? status : undefined);
}

const errorReplies: Record<ErrorCode, string> = {
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

export function getChatErrorReply(error: GeminiChatError): string {
    return errorReplies[error.code];
}

type GenerateChat = (params: GenerateContentParameters) => Promise<{
    text?: string;
    promptFeedback?: { blockReason?: string };
    candidates?: { finishReason?: string }[];
}>;

export function createGeminiChat(generate: GenerateChat, model: string) {
    const histories = new Map<string, { messages: Content[]; updatedAt: number }>();
    const pending = new Set<string>();

    return async (sessionId: string, question: string): Promise<string> => {
        if (pending.has(sessionId) || pending.size >= 10) throw new GeminiChatError('busy');
        const now = Date.now();
        for (const [id, entry] of histories) {
            if (now - entry.updatedAt >= HISTORY_TTL_MS) histories.delete(id);
        }

        const messages: Content[] = [
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
                const blocked = result.promptFeedback?.blockReason || result.candidates?.some(candidate =>
                    ['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION'].includes(candidate.finishReason ?? ''));
                throw new GeminiChatError(blocked ? 'blocked' : 'empty');
            }
            messages.push({ role: 'model', parts: [{ text }] });
            histories.delete(sessionId);
            histories.set(sessionId, { messages: messages.slice(-MAX_HISTORY_MESSAGES), updatedAt: Date.now() });
            if (histories.size > MAX_SESSIONS) histories.delete(histories.keys().next().value!);
            return text;
        } catch (error) {
            throw classifyChatError(error);
        } finally {
            pending.delete(sessionId);
        }
    };
}

let client: GoogleGenAI | undefined;
export const chatWithGemini = createGeminiChat(params => {
    if (!GEMINI_KEY) throw new GeminiChatError('missing-key');
    client ??= new GoogleGenAI({ apiKey: GEMINI_KEY });
    return client.models.generateContent(params);
}, GEMINI_CHAT_MODEL);