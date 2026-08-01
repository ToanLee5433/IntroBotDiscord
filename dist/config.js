"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fullAgentsByRole = exports.agentIcons = exports.WARMUP_CHANNEL_ID = exports.VALORANT_API_KEY = exports.ATLAS_DATA_SOURCE = exports.ATLAS_APP_ID = exports.ATLAS_DATA_API_KEY = exports.MONGO_URI = exports.GEMINI_KEY = exports.TOKEN = exports.PORT = void 0;
exports.loadAgentIcons = loadAgentIcons;
exports.PORT = process.env.PORT || 8080;
exports.TOKEN = process.env.DISCORD_TOKEN || process.env.TOKEN;
exports.GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY || process.env.GEMINI_API;
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
