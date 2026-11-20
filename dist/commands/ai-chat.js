"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getExplicitChatPrompt = getExplicitChatPrompt;
exports.splitChatReply = splitChatReply;
exports.handleAiChat = handleAiChat;
const config_1 = require("../config");
const gemini_chat_1 = require("../services/gemini-chat");
function getExplicitChatPrompt(input) {
    return /^(?:chat|hỏi ai|hoi ai)(?=$|[\s:])/i.exec(input)
        ? input.replace(/^(?:chat|hỏi ai|hoi ai)[\s:]*/i, '').trim()
        : undefined;
}
function splitChatReply(text) {
    const chunks = [];
    let rest = text.trim();
    while (rest.length > 1900) {
        const softEnd = Math.max(rest.lastIndexOf('\n', 1900), rest.lastIndexOf(' ', 1900));
        let end = softEnd > 950 ? softEnd : 1900;
        if (/[\uD800-\uDBFF]/.test(rest[end - 1]))
            end--;
        chunks.push(rest.slice(0, end).trimEnd());
        rest = rest.slice(end).trimStart();
    }
    if (rest)
        chunks.push(rest);
    return chunks;
}
async function handleAiChat(message, question) {
    const send = (content) => message.reply({ content, allowedMentions: { parse: [], repliedUser: false } });
    const prompt = question.trim();
    if (!prompt) {
        await send('Hỏi tao gì đi! Ví dụ: `@BotToan chat Gợi ý phim hay cho cuối tuần`').catch(() => console.warn('[AI CHAT] Discord reply failed'));
        return;
    }
    if ('sendTyping' in message.channel)
        void message.channel.sendTyping().catch(() => { });
    let chunks;
    try {
        const sessionId = `${message.channelId}:${message.author.id}`;
        chunks = splitChatReply(await (0, gemini_chat_1.chatWithGemini)(sessionId, prompt));
    }
    catch (error) {
        const failure = (0, gemini_chat_1.classifyChatError)(error);
        if (failure.code !== 'busy')
            console.warn('[AI CHAT]', { model: config_1.GEMINI_CHAT_MODEL, code: failure.code, status: failure.status });
        chunks = [(0, gemini_chat_1.getChatErrorReply)(failure)];
    }
    try {
        for (const chunk of chunks)
            await send(chunk);
    }
    catch {
        console.warn('[AI CHAT] Discord reply failed; check channel permissions or message availability');
    }
}
