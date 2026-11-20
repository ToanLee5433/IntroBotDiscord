const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createGeminiChat, classifyChatError } = require('../dist/services/gemini-chat');
const { getExplicitChatPrompt, splitChatReply } = require('../dist/commands/ai-chat');

test('explicit chat accepts Vietnamese aliases and preserves the question', () => {
    assert.equal(getExplicitChatPrompt('Hỏi AI: Gợi ý phim về toán'), 'Gợi ý phim về toán');
    assert.equal(getExplicitChatPrompt('chat'), '');
    assert.equal(getExplicitChatPrompt('chatbot là gì?'), undefined);
});

test('long replies keep their content and do not split emoji', () => {
    const text = 'x'.repeat(1899) + '😀' + 'y'.repeat(2000);
    const pieces = splitChatReply(text);
    assert.equal(pieces.join(''), text);
    assert.equal(pieces[0].length, 1899);
    assert.ok(pieces.every(piece => piece.length <= 1900));
});

test('chat uses the configured model and isolates bounded conversation history', async () => {
    const calls = [];
    const chat = createGeminiChat(async request => {
        calls.push({ ...request, contents: [...request.contents] });
        return { text: 'Chào! https://example.com' };
    }, 'gemini-3.5-flash-lite');
    for (let i = 0; i < 7; i++) assert.equal(await chat('channel-a:user', `Câu ${i}`), 'Chào!');
    await chat('channel-b:user', 'Câu mới');
    assert.equal(calls[0].model, 'gemini-3.5-flash-lite');
    assert.equal(calls[0].config.abortSignal.aborted, false);
    assert.deepEqual(calls[1].contents.map(entry => entry.role), ['user', 'model', 'user']);
    assert.equal(calls[6].contents.length, 11);
    assert.equal(calls[7].contents.length, 1);
});

test('one in-flight request per session and failed turns do not enter history', async () => {
    let rejectFirst;
    let contents;
    const chat = createGeminiChat(request => {
        contents = [...request.contents];
        if (!rejectFirst) return new Promise((_, reject) => { rejectFirst = reject; });
        return Promise.resolve({ text: 'OK' });
    }, 'test-model');
    const first = chat('same', 'first');
    await assert.rejects(chat('same', 'duplicate'), { code: 'busy' });
    rejectFirst({ status: 429 });
    await assert.rejects(first, { code: 'quota', status: 429 });
    assert.equal(await chat('same', 'retry'), 'OK');
    assert.equal(contents.length, 1);
});

test('API errors are classified without exposing upstream messages', async () => {
    for (const [error, code] of [
        [{ status: 400, message: 'API_KEY_INVALID' }, 'auth'],
        [{ status: 403 }, 'auth'], [{ status: 404 }, 'model'], [{ status: 429 }, 'quota'],
        [{ status: 503 }, 'unavailable'], [{ name: 'TimeoutError' }, 'timeout']
    ]) assert.equal(classifyChatError(error).message, code);
    await assert.rejects(createGeminiChat(async () => ({ promptFeedback: { blockReason: 'SAFETY' } }), 'model')('s', 'q'), { code: 'blocked' });
    await assert.rejects(createGeminiChat(async () => ({ text: '  ' }), 'model')('s', 'q'), { code: 'empty' });
});