import type { Message } from 'discord.js';
import { GEMINI_CHAT_MODEL } from '../config';
import { chatWithGemini, classifyChatError, getChatErrorReply } from '../services/gemini-chat';

export function getExplicitChatPrompt(input: string): string | undefined {
    return /^(?:chat|hỏi ai|hoi ai)(?=$|[\s:])/i.exec(input)
        ? input.replace(/^(?:chat|hỏi ai|hoi ai)[\s:]*/i, '').trim()
        : undefined;
}

export function splitChatReply(text: string): string[] {
    const chunks: string[] = [];
    let rest = text.trim();
    while (rest.length > 1900) {
        const softEnd = Math.max(rest.lastIndexOf('\n', 1900), rest.lastIndexOf(' ', 1900));
        let end = softEnd > 950 ? softEnd : 1900;
        if (/[\uD800-\uDBFF]/.test(rest[end - 1])) end--;
        chunks.push(rest.slice(0, end).trimEnd());
        rest = rest.slice(end).trimStart();
    }
    if (rest) chunks.push(rest);
    return chunks;
}

export async function handleAiChat(message: Message, question: string): Promise<void> {
    const send = (content: string) => message.reply({ content, allowedMentions: { parse: [], repliedUser: false } });
    const prompt = question.trim();
    if (!prompt) {
        await send('Hỏi tao gì đi! Ví dụ: `@BotToan chat Gợi ý phim hay cho cuối tuần`').catch(() => console.warn('[AI CHAT] Discord reply failed'));
        return;
    }

    if ('sendTyping' in message.channel) void message.channel.sendTyping().catch(() => {});
    let chunks: string[];
    try {
        const sessionId = `${message.channelId}:${message.author.id}`;
        chunks = splitChatReply(await chatWithGemini(sessionId, prompt));
    } catch (error) {
        const failure = classifyChatError(error);
        if (failure.code !== 'busy') console.warn('[AI CHAT]', { model: GEMINI_CHAT_MODEL, code: failure.code, status: failure.status });
        chunks = [getChatErrorReply(failure)];
    }

    try {
        for (const chunk of chunks) await send(chunk);
    } catch {
        console.warn('[AI CHAT] Discord reply failed; check channel permissions or message availability');
    }
}