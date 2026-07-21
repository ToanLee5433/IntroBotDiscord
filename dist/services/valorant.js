"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchValorantRank = fetchValorantRank;
const config_1 = require("../config");
/**
 * Lấy thông tin xếp hạng MMR từ API HenrikDev
 */
async function fetchValorantRank(name, tag) {
    try {
        if (!config_1.VALORANT_API_KEY) {
            return { success: false, message: "Riot API Key chưa được cài đặt trên Server! Hãy báo Admin cấu hình `VALORANT_API_KEY` trên Render." };
        }
        const encodedName = encodeURIComponent(name);
        const encodedTag = encodeURIComponent(tag);
        const url = `https://api.henrikdev.xyz/valorant/v2/mmr/ap/${encodedName}/${encodedTag}`;
        const res = await fetch(url, {
            headers: {
                "Authorization": config_1.VALORANT_API_KEY
            }
        });
        if (res.status === 429) {
            return { success: false, message: "Server API quá tải (Rate limit), chờ một lát rồi thử lại nhé!" };
        }
        const json = await res.json();
        if (!json || json.status !== 200 || !json.data) {
            if (json && json.errors && json.errors[0]) {
                return { success: false, message: `API báo lỗi: ${json.errors[0].message}` };
            }
            return { success: false, message: "Không tìm thấy thông tin rank. Hãy chắc chắn Riot ID đã nhập đúng (Ví dụ: GameName#Tag) và tài khoản đã hoàn thành trận đấu rank mùa này!" };
        }
        const data = json.data;
        const currentData = data.current_data;
        const highestRank = data.highest_rank;
        return {
            success: true,
            name: data.name,
            tag: data.tag,
            currentRank: currentData ? currentData.currenttier_patched : "Unranked",
            rr: currentData ? currentData.ranking_in_tier : 0,
            mmrChange: currentData ? currentData.mmr_change_to_last_game : 0,
            elo: currentData ? currentData.elo : 0,
            rankIcon: currentData && currentData.images ? (currentData.images.large || currentData.images.small) : "",
            highestRank: highestRank ? highestRank.patched_tier : "Unranked"
        };
    }
    catch (error) {
        console.error("Lỗi fetch rank Valorant:", error);
        return { success: false, message: "Mạng lag hay API lỗi rồi, đéo lấy được thông tin rank lúc này!" };
    }
}
