const { GEMINI_KEY, GEMINI_CHAT_MODEL } = require('../dist/config');
const { chatWithGemini, classifyChatError } = require('../dist/services/gemini-chat');

(async () => {
    if (!GEMINI_KEY) {
        console.error('AI_CHECK missing-key: configure GEMINI_API_KEY in the host environment or project .env');
        process.exitCode = 1;
        return;
    }
    const started = Date.now();
    try {
        const reply = await chatWithGemini('diagnostic', 'Reply with only OK.');
        console.log(JSON.stringify({ model: GEMINI_CHAT_MODEL, ok: true, characters: reply.length, elapsedMs: Date.now() - started }));
    } catch (error) {
        const failure = classifyChatError(error);
        console.error(JSON.stringify({ model: GEMINI_CHAT_MODEL, ok: false, code: failure.code, status: failure.status, elapsedMs: Date.now() - started }));
        process.exitCode = 1;
    }
})();