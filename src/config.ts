export const PORT = process.env.PORT || 8080;
export const TOKEN = process.env.DISCORD_TOKEN || process.env.TOKEN;
export const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY || process.env.GEMINI_API;
export const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
export const VALORANT_API_KEY = process.env.VALORANT_API_KEY;

export const agentIcons = new Map<string, string>();

/**
 * Tải danh sách ảnh đại diện của các tướng Valorant từ API công khai
 */
export async function loadAgentIcons(): Promise<void> {
    try {
        const res = await fetch("https://valorant-api.com/v1/agents");
        const json = await res.json() as any;
        if (json && json.status === 200 && Array.isArray(json.data)) {
            for (const agent of json.data) {
                if (agent.isPlayableCharacter) {
                    agentIcons.set(agent.displayName.toLowerCase().trim(), agent.displayIcon);
                }
            }
            console.log(`[VALORANT-API] Đã nạp thành công ${agentIcons.size} ảnh đại diện tướng.`);
        }
    } catch (error) {
        console.error("[VALORANT-API LỖI] Lỗi nạp dữ liệu tướng:", error);
    }
}

export const fullAgentsByRole: { [key: string]: string[] } = {

    "Duelist": ["Iso", "Jett", "Neon", "Phoenix", "Raze", "Reyna", "Waylay", "Yoru", "Clove"],
    "Initiator": ["Breach", "Fade", "Gekko", "KAY/O", "Skye", "Sova", "Tejo"],
    "Controller": ["Astra", "Brimstone", "Harbor", "Miks", "Omen", "Viper"],
    "Sentinel": ["Chamber", "Cypher", "Deadlock", "Killjoy", "Sage", "Veto", "Vyse"]
};
