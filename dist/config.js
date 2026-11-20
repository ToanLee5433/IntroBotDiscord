"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fullAgentsByRole = exports.agentIcons = exports.WARMUP_CHANNEL_ID = exports.VALORANT_API_KEY = exports.ATLAS_DATA_SOURCE = exports.ATLAS_APP_ID = exports.ATLAS_DATA_API_KEY = exports.MONGO_URI = exports.GEMINI_CHAT_MODEL = exports.GEMINI_KEY = exports.TOKEN = exports.PORT = void 0;
exports.loadAgentIcons = loadAgentIcons;
const node_path_1 = require("node:path");
// Node giữ nguyên biến do môi trường deploy cấp nếu trùng tên trong .env.
try {
    process.loadEnvFile((0, node_path_1.resolve)(__dirname, '../.env'));
}
catch (error) {
    if (error.code !== 'ENOENT')
        throw error;
}
exports.PORT = Number(process.env.PORT || 8080);
exports.TOKEN = process.env.DISCORD_TOKEN || process.env.TOKEN;
exports.GEMINI_KEY = [process.env.GEMINI_API_KEY, process.env.GEMINI_KEY, process.env.GEMINI_API]
    .map(value => value?.trim()).find(Boolean);
exports.GEMINI_CHAT_MODEL = process.env.GEMINI_CHAT_MODEL?.trim() || 'gemini-3.5-flash-lite';
exports.MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
exports.ATLAS_DATA_API_KEY = process.env.ATLAS_DATA_API_KEY || "";
exports.ATLAS_APP_ID = process.env.ATLAS_APP_ID || "";
exports.ATLAS_DATA_SOURCE = process.env.ATLAS_DATA_SOURCE || "Cluster0";
exports.VALORANT_API_KEY = process.env.VALORANT_API_KEY;
exports.WARMUP_CHANNEL_ID = process.env.WARMUP_CHANNEL_ID || "";
exports.agentIcons = new Map();
/**
 * Tải danh sách ảnh đại diện của các tướng Valorant từ API công khai
 */
async function loadAgentIcons() {
    try {
        const res = await fetch("https://valorant-api.com/v1/agents");
        const json = await res.json();
        if (json && json.status === 200 && Array.isArray(json.data)) {
            for (const agent of json.data) {
                if (agent.isPlayableCharacter) {
                    exports.agentIcons.set(agent.displayName.toLowerCase().trim(), agent.displayIcon);
                }
            }
            console.log(`[VALORANT-API] Đã nạp thành công ${exports.agentIcons.size} ảnh đại diện tướng.`);
        }
    }
    catch (error) {
        console.error("[VALORANT-API LỖI] Lỗi nạp dữ liệu tướng:", error);
    }
}
exports.fullAgentsByRole = {
    "Duelist": ["Iso", "Jett", "Neon", "Phoenix", "Raze", "Reyna", "Waylay", "Yoru", "Clove"],
    "Initiator": ["Breach", "Fade", "Gekko", "KAY/O", "Skye", "Sova", "Tejo"],
    "Controller": ["Astra", "Brimstone", "Harbor", "Miks", "Omen", "Viper"],
    "Sentinel": ["Chamber", "Cypher", "Deadlock", "Killjoy", "Sage", "Veto", "Vyse"]
};
