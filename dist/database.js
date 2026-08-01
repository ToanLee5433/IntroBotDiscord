"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.banChat = banChat;
exports.getChatBanExpires = getChatBanExpires;
exports.connectDB = connectDB;
exports.getBalance = getBalance;
exports.updateBalance = updateBalance;
exports.getVNDateString = getVNDateString;
exports.claimDaily = claimDaily;
exports.dodgeDebt = dodgeDebt;
exports.getLeaderboard = getLeaderboard;
exports.transferMoney = transferMoney;
exports.getDebt = getDebt;
exports.borrowMoney = borrowMoney;
exports.payDebt = payDebt;
exports.getBalancesAndDebts = getBalancesAndDebts;
exports.getAllBalancesAndDebts = getAllBalancesAndDebts;
exports.registerValorantId = registerValorantId;
exports.getValorantId = getValorantId;
exports.buyLotteryTicket = buyLotteryTicket;
exports.getLotteryInfo = getLotteryInfo;
exports.drawLottery = drawLottery;
exports.getLastLotteryDraw = getLastLotteryDraw;
exports.getSnitchCooldown = getSnitchCooldown;
exports.updateSnitchDate = updateSnitchDate;
exports.saveProfile = saveProfile;
exports.getProfile = getProfile;
exports.updateCrush = updateCrush;
exports.getCrush = getCrush;
exports.getWhoCrushedMe = getWhoCrushedMe;
exports.incrementCrushChange = incrementCrushChange;
exports.incrementFailedMatch = incrementFailedMatch;
exports.setSimpLo = setSimpLo;
exports.getSimpLoExpires = getSimpLoExpires;
exports.hasGieoQueToday = hasGieoQueToday;
exports.markGieoQueToday = markGieoQueToday;
exports.hasTarotToday = hasTarotToday;
exports.recordTarotPlay = recordTarotPlay;
exports.cancelTarotPlay = cancelTarotPlay;
exports.getLotteryTicketsForDate = getLotteryTicketsForDate;
exports.getLotteryState = getLotteryState;
exports.getLastAuraDate = getLastAuraDate;
exports.setLastAuraDate = setLastAuraDate;
exports.getAnonymousLetterData = getAnonymousLetterData;
exports.incrementAnonymousLetterCount = incrementAnonymousLetterCount;
exports.getMoodData = getMoodData;
exports.saveMood = saveMood;
exports.getMyGuData = getMyGuData;
exports.saveMyGuData = saveMyGuData;
exports.getLastDoanGuDate = getLastDoanGuDate;
exports.setLastDoanGuDate = setLastDoanGuDate;
exports.addWCMatch = addWCMatch;
exports.lockWCMatch = lockWCMatch;
exports.getActiveWCMatches = getActiveWCMatches;
exports.getWCMatch = getWCMatch;
exports.placeWCBet = placeWCBet;
exports.settleWCMatch = settleWCMatch;
exports.getAllWCMatches = getAllWCMatches;
exports.updateWCMatch = updateWCMatch;
exports.deleteWCMatch = deleteWCMatch;
exports.getUserWCBets = getUserWCBets;
exports.getActiveWCBets = getActiveWCBets;
exports.getServerGuData = getServerGuData;
exports.claimWelcomeGift = claimWelcomeGift;
exports.addWarmupVideo = addWarmupVideo;
exports.getWarmupVideos = getWarmupVideos;
exports.deleteWarmupVideo = deleteWarmupVideo;
exports.updateWarmupVideo = updateWarmupVideo;
const mongoose_1 = __importStar(require("mongoose"));
const config_1 = require("./config");
const utils_1 = require("./utils");
// Fallback in-memory store in case MONGO_URI is missing or connection fails
const playerBalancesInMemory = {};
const playerLastDailyInMemory = {};
const playerDebtsInMemory = {};
const playerStreaksInMemory = {};
const playerValorantIdsInMemory = {};
const playerChatBansInMemory = {};
const playerLastDodgeDebtInMemory = {};
const playerLastSnitchDatesInMemory = {};
const playerProfilesInMemory = {};
const playerCrushesInMemory = {};
const playerCrushChangesTodayInMemory = {};
const playerLastCrushChangeDateInMemory = {};
const playerFailedMatchesTodayInMemory = {};
const playerLastFailedMatchDateInMemory = {};
const playerSimpLoUntilInMemory = {};
const playerLastQueDateInMemory = {};
const playerLastTarotDateInMemory = {};
const playerLastTarotTimestampInMemory = {};
const playerTarotStreakInMemory = {};
// Aura
const playerLastAuraDatesInMemory = {};
// Anonymous Letter
const playerLetterCountInMemory = {};
const playerLastLetterDateInMemory = {};
// Mood
const playerLastMoodDateInMemory = {};
const playerLastMoodInMemory = {};
const playerMoodStreakInMemory = {};
const playerWeeklyMoodsInMemory = {}; // JSON
// MyGu
const playerLastMyGuDateInMemory = {};
const playerMyGuCodeInMemory = {};
const playerMyGuResultCacheInMemory = {};
const playerLastDoanGuDateInMemory = {};
const playerClaimedWelcomeInMemory = {};
let useMongoDB = false;
const userSchema = new mongoose_1.Schema({
    userId: { type: String, required: true, unique: true },
    balance: { type: Number, default: 100 },
    lastDaily: { type: Number, default: 0 },
    debt: { type: Number, default: 0 },
    streak: { type: Number, default: 0 },
    valorantId: { type: String, default: "" },
    chatBanUntil: { type: Number, default: 0 },
    lastDodgeDebt: { type: Number, default: 0 },
    lastSnitchDate: { type: String, default: "" },
    name: { type: String, default: "" },
    gender: { type: String, default: "" },
    birthday: { type: String, default: "" },
    crushUserId: { type: String, default: "" },
    crushChangesToday: { type: Number, default: 0 },
    lastCrushChangeDate: { type: String, default: "" },
    failedMatchesToday: { type: Number, default: 0 },
    lastFailedMatchDate: { type: String, default: "" },
    simpLoUntil: { type: Number, default: 0 },
    lastQueDate: { type: String, default: "" },
    lastTarotDate: { type: String, default: "" },
    lastTarotTimestamp: { type: Number, default: 0 },
    tarotStreak: { type: Number, default: 0 },
    // Aura
    lastAuraDate: { type: String, default: "" },
    // Anonymous Letter
    anonymousLettersSentToday: { type: Number, default: 0 },
    lastAnonymousLetterDate: { type: String, default: "" },
    // Mood Diary
    moodStreak: { type: Number, default: 0 },
    lastMoodDate: { type: String, default: "" },
    lastMood: { type: String, default: "" },
    weeklyMoods: { type: String, default: "[]" },
    // MyGu
    lastMyGuDate: { type: String, default: "" },
    myGuCode: { type: String, default: "" },
    myGuResultCache: { type: String, default: "" },
    lastDoanGuDate: { type: String, default: "" },
    hasClaimedWelcome: { type: Boolean, default: false }
});
const UserModel = (0, mongoose_1.model)('User', userSchema);
const lotteryTicketSchema = new mongoose_1.Schema({
    userId: { type: String, required: true },
    number: { type: String, required: true },
    date: { type: String, required: true }
});
const LotteryTicketModel = (0, mongoose_1.model)('LotteryTicket', lotteryTicketSchema);
const lotteryStateSchema = new mongoose_1.Schema({
    date: { type: String, required: true, unique: true },
    jackpotPool: { type: Number, default: 200 },
    winningNumbers: { type: [String], default: [] },
    drawn: { type: Boolean, default: false }
});
const LotteryStateModel = (0, mongoose_1.model)('LotteryState', lotteryStateSchema);
const worldCupMatchSchema = new mongoose_1.Schema({
    matchId: { type: String, required: true, unique: true },
    teamA: { type: String, required: true },
    teamB: { type: String, required: true },
    odds: { type: String, required: true },
    status: { type: String, default: 'open' },
    winner: { type: String, default: "" }
});
const WorldCupMatchModel = (0, mongoose_1.model)('WorldCupMatch', worldCupMatchSchema);
const worldCupBetSchema = new mongoose_1.Schema({
    userId: { type: String, required: true },
    matchId: { type: String, required: true },
    team: { type: String, required: true },
    amount: { type: Number, required: true },
    settled: { type: Boolean, default: false }
});
const WorldCupBetModel = (0, mongoose_1.model)('WorldCupBet', worldCupBetSchema);
// Fallback RAM DB
let inMemoryJackpotPool = 200; // 200k base
const inMemoryTickets = [];
const inMemoryLotteryStates = {};
const inMemoryWCMatches = [];
const inMemoryWCBets = [];
/**
 * Cấm chat người dùng bằng cách lưu thời hạn cấm ở cấp độ Bot (RAM / MongoDB)
 */
async function banChat(userId, durationMs) {
    const expires = Date.now() + durationMs;
    if (useMongoDB) {
        try {
            await UserModel.findOneAndUpdate({ userId }, { chatBanUntil: expires }, { upsert: true, new: true });
            return;
        }
        catch (error) {
            console.error("[DB LỖI] Lỗi cấm chat trên MongoDB:", error);
        }
    }
    playerChatBansInMemory[userId] = expires;
}
/**
 * Lấy thời gian hết hạn cấm chat của người dùng (0 nếu không bị cấm)
 */
async function getChatBanExpires(userId) {
    if (useMongoDB) {
        try {
            const user = await UserModel.findOne({ userId });
            return user && user.chatBanUntil ? user.chatBanUntil : 0;
        }
        catch (error) {
            console.error("[DB LỖI] Lỗi lấy thời gian cấm chat từ MongoDB:", error);
        }
    }
    return playerChatBansInMemory[userId] || 0;
}
/**
 * Thực hiện kết nối tới MongoDB
 */
async function connectDB() {
    if (!config_1.MONGO_URI) {
        console.warn("[DB CẢNH BÁO] Thiếu MONGO_URI trong biến môi trường. Bot sẽ sử dụng bộ nhớ tạm (RAM) làm database!");
        useMongoDB = false;
        return;
    }
    const connectOptions = {
        serverSelectionTimeoutMS: 15000,
        connectTimeoutMS: 15000
    };
    // Đợt 1: Kết nối bằng MONGO_URI gốc kèm TLS bypass
    try {
        console.log("[DB] Đang thử kết nối MongoDB đợt 1 (TLS bypass)...");
        await mongoose_1.default.connect(config_1.MONGO_URI, connectOptions);
        console.log("[DB] ✅ Kết nối MongoDB thành công ở đợt 1!");
        useMongoDB = true;
        return;
    }
    catch (error) {
        console.error("[DB LỖI] Thử kết nối MongoDB đợt 1 thất bại:", error?.message || error);
    }
    // Đợt 2: Tự động chuyển đổi sang Standard Direct Connection String (bỏ qua DNS SRV) nếu đợt 1 thất bại
    try {
        let fallbackUri = config_1.MONGO_URI;
        if (config_1.MONGO_URI.includes('mongodb+srv://')) {
            const match = config_1.MONGO_URI.match(/mongodb\+srv:\/\/([^@]+)@([^\/]+)\/?([^?]*)/);
            if (match) {
                const creds = match[1]; // user:pass
                const dbName = (match[3] && match[3].trim()) ? match[3].trim() : 'intro-bot';
                fallbackUri = `mongodb://${creds}@ac-z161zes-shard-00-00.tjagckz.mongodb.net:27017,ac-z161zes-shard-00-01.tjagckz.mongodb.net:27017,ac-z161zes-shard-00-02.tjagckz.mongodb.net:27017/${dbName}?ssl=true&replicaSet=atlas-14ogil-shard-0&authSource=admin&tlsAllowInvalidCertificates=true`;
            }
        }
        console.log("[DB] Đang thử kết nối lại MongoDB đợt 2 với Standard Direct ReplicaSet...");
        await mongoose_1.default.connect(fallbackUri, connectOptions);
        console.log("[DB] ✅ Kết nối MongoDB thành công ở đợt 2 (Standard Direct)!");
        useMongoDB = true;
    }
    catch (error2) {
        console.error("[DB LỖI] Lỗi kết nối MongoDB đợt 2:", error2?.message || error2);
        console.warn("[DB CẢNH BÁO] Chuyển hướng sử dụng bộ nhớ tạm (RAM) vì không thể kết nối MongoDB!");
        useMongoDB = false;
    }
}
/**
 * Lấy số dư ví tiền của người dùng. Tự động cấp vốn 100k nếu là người chơi mới (chưa có bản ghi).
 * LƯU Ý: KHÔNG tự động reset ví về 100k nếu balance = 0 — người chơi cháy túi phải tự vay tiền.
 */
async function getBalance(userId) {
    if (useMongoDB) {
        try {
            let user = await UserModel.findOne({ userId });
            if (!user) {
                // Người chơi mới lần đầu → cấp vốn ban đầu 100k
                user = await UserModel.findOneAndUpdate({ userId }, { $setOnInsert: { balance: 100 } }, { new: true, upsert: true });
            }
            return user ? user.balance : 100;
        }
        catch (error) {
            console.error("[DB LỖI] Lỗi lấy ví tiền từ MongoDB:", error);
        }
    }
    // Fallback to In-Memory
    if (playerBalancesInMemory[userId] === undefined) {
        // Người chơi mới lần đầu → cấp vốn ban đầu 100k
        playerBalancesInMemory[userId] = 100;
    }
    return playerBalancesInMemory[userId];
}
/**
 * Cập nhật số dư ví tiền của người dùng
 */
async function updateBalance(userId, amount) {
    if (useMongoDB) {
        try {
            const user = await UserModel.findOneAndUpdate({ userId }, { balance: amount }, { new: true, upsert: true });
            return user ? user.balance : amount;
        }
        catch (error) {
            console.error("[DB LỖI] Lỗi cập nhật ví tiền trên MongoDB:", error);
        }
    }
    // Fallback to In-Memory
    playerBalancesInMemory[userId] = amount;
    return playerBalancesInMemory[userId];
}
/**
 * Tạo thanh tiến trình chuỗi điểm danh hàng ngày bằng emojis sinh động
 */
function getStreakProgressBar(streak) {
    const maxTrack = 5;
    let track = "";
    for (let i = 1; i <= maxTrack; i++) {
        if (i < streak) {
            track += "🔥 ";
        }
        else if (i === streak) {
            track += streak >= 5 ? "👑 " : "🟠 ";
        }
        else {
            track += "⚪ ";
        }
    }
    if (streak >= 5) {
        return `🔥 **Chuỗi:** ${track} *(Chuỗi đỉnh cao: **${streak} ngày**!)*`;
    }
    return `🔥 **Chuỗi:** ${track} *(${streak}/${maxTrack} ngày)*`;
}
/**
 * Điểm danh nhận tiền hàng ngày (24 giờ một lần). Có chuỗi đăng nhập liên tiếp nhận thêm bonus.
 */
function getVNDate(timestamp) {
    return new Date(timestamp + 7 * 60 * 60 * 1000);
}
function getVNDateString(timestamp) {
    const d = getVNDate(timestamp);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
function getCalendarDayDifference(t1, t2) {
    if (t1 === 0 || t2 === 0)
        return 999;
    const d1 = getVNDate(t1);
    const d2 = getVNDate(t2);
    const date1 = Date.UTC(d1.getUTCFullYear(), d1.getUTCMonth(), d1.getUTCDate());
    const date2 = Date.UTC(d2.getUTCFullYear(), d2.getUTCMonth(), d2.getUTCDate());
    return Math.round((date2 - date1) / (24 * 60 * 60 * 1000));
}
function getTimeLeftUntilVNNextDay(now) {
    const vnNow = getVNDate(now);
    const vnTomorrow = Date.UTC(vnNow.getUTCFullYear(), vnNow.getUTCMonth(), vnNow.getUTCDate() + 1);
    const timeLeftMs = (vnTomorrow - 7 * 60 * 60 * 1000) - now;
    const hours = Math.floor(timeLeftMs / (60 * 60 * 1000));
    const minutes = Math.floor((timeLeftMs % (60 * 60 * 1000)) / (60 * 1000));
    return { hours, minutes };
}
function getFunnyDailyMessage(streak, reward, progress, isDebtPaid, garnishment = 0, newBalance = 0, newDebt = 0) {
    const formatReward = (0, utils_1.formatMoney)(reward);
    const formatGarnishment = (0, utils_1.formatMoney)(garnishment);
    const formatBalance = (0, utils_1.formatMoney)(newBalance);
    const formatDebt = (0, utils_1.formatMoney)(newDebt);
    const checkInTrolls = [
        `Mày đã liên tục báo danh được **${streak} ngày** rồi đó, chăm chỉ cày thuê cuốc mướn thế này tao rất ưng! Nhận ngay cọc tiền cờ bạc nào!`,
        `Báo danh thành công ngày thứ **${streak}**! Tao thí cho mày ít tiền cơm cháo lẻ này con ạ.`,
        `Chuỗi điểm danh **${streak} ngày**! Kỷ lục gia cờ bạc nghèo đói đây rồi, cầm lấy tiền trợ cấp đi!`,
        `Vỗ tay tuyên dương con nghiện chăm chỉ điểm danh **${streak} ngày** liên tiếp! Cầm tiền lẹ đi!`,
        `Báo danh ngày thứ **${streak}** thành công! Mày nhận được tiền trợ cấp xã hội để đi nướng sòng bài.`
    ];
    const baseTroll = checkInTrolls[Math.floor(Math.random() * checkInTrolls.length)];
    if (isDebtPaid) {
        return `🎉 **ĐIỂM DANH THÀNH CÔNG!**\n\n${baseTroll}\n👉 Mày nhận được **${formatReward}**, nhưng vì đang nợ ngân hàng đầm đìa nên tao tự động cấn trừ **${formatGarnishment}** nợ nhé, còn lại **${(0, utils_1.formatMoney)(reward - garnishment)}** bỏ túi cờ bạc tiếp đi con trai!\n\n${progress}\n\n💰 **Ví hiện tại:** **${formatBalance}** | 🏦 **Nợ còn lại:** **${formatDebt}**`;
    }
    else {
        return `🎉 **ĐIỂM DANH THÀNH CÔNG!**\n\n${baseTroll}\n👉 Cầm lấy **${formatReward}** này đi cúng sòng bạc tiếp đi.\n\n${progress}\n\n💰 **Số dư hiện tại:** **${formatBalance}**`;
    }
}
/**
 * Điểm danh nhận tiền hàng ngày (theo ngày Việt Nam UTC+7, reset lúc 00:00). Có chuỗi đăng nhập liên tiếp nhận thêm bonus.
 */
async function claimDaily(userId) {
    const now = Date.now();
    const todayStr = getVNDateString(now);
    const baseReward = Math.floor(Math.random() * (50 - 10 + 1)) + 10; // Ngẫu nhiên 10k - 50k
    if (useMongoDB) {
        try {
            let user = await UserModel.findOne({ userId });
            if (!user) {
                user = await UserModel.create({ userId, balance: 100, lastDaily: 0, streak: 0 });
            }
            const lastDailyStr = getVNDateString(user.lastDaily || 0);
            if (todayStr === lastDailyStr) {
                const timeLeft = getTimeLeftUntilVNNextDay(now);
                const progress = getStreakProgressBar(user.streak || 0);
                return {
                    success: false,
                    amount: 0,
                    balance: user.balance,
                    message: `Mày tham lam quá! Chờ thêm **${timeLeft.hours} giờ ${timeLeft.minutes} phút** nữa (qua 00:00 đêm giờ Việt Nam) mới được điểm danh tiếp nhé!\n\n${progress}`
                };
            }
            // Tính chuỗi liên tiếp (streak)
            const diffDays = getCalendarDayDifference(user.lastDaily || 0, now);
            let currentStreak = user.streak || 0;
            if (diffDays === 1) {
                currentStreak += 1;
            }
            else {
                currentStreak = 1; // Đứt chuỗi, reset về 1
            }
            const streakBonus = Math.min(25, currentStreak * 5); // Tối đa bonus 25k ở ngày thứ 5+
            const totalReward = baseReward + streakBonus;
            // Khấu trừ nợ tự động (20% - 30%)
            let garnishment = 0;
            let rewardLeft = totalReward;
            if (user.debt && user.debt > 0) {
                const garnishmentPercent = 20 + Math.floor(Math.random() * 11);
                garnishment = Math.min(user.debt, Math.floor(totalReward * (garnishmentPercent / 100)));
                user.debt -= garnishment;
                rewardLeft = totalReward - garnishment;
            }
            user.balance += rewardLeft;
            user.lastDaily = now;
            user.streak = currentStreak;
            await user.save();
            const progress = getStreakProgressBar(currentStreak);
            const msg = getFunnyDailyMessage(currentStreak, totalReward, progress, garnishment > 0, garnishment, user.balance, user.debt);
            return {
                success: true,
                amount: rewardLeft,
                balance: user.balance,
                message: msg
            };
        }
        catch (error) {
            console.error("[DB LỖI] Lỗi điểm danh trên MongoDB:", error);
        }
    }
    // Fallback to In-Memory
    const lastDaily = playerLastDailyInMemory[userId] || 0;
    const lastDailyStr = getVNDateString(lastDaily);
    if (todayStr === lastDailyStr) {
        const timeLeft = getTimeLeftUntilVNNextDay(now);
        const progress = getStreakProgressBar(playerStreaksInMemory[userId] || 0);
        const currentBalance = await getBalance(userId);
        return {
            success: false,
            amount: 0,
            balance: currentBalance,
            message: `Mày tham lam quá! Chờ thêm **${timeLeft.hours} giờ ${timeLeft.minutes} phút** nữa (qua 00:00 đêm giờ Việt Nam) mới được điểm danh tiếp nhé!\n\n${progress}`
        };
    }
    const diffDays = getCalendarDayDifference(lastDaily, now);
    let currentStreak = playerStreaksInMemory[userId] || 0;
    if (diffDays === 1) {
        currentStreak += 1;
    }
    else {
        currentStreak = 1;
    }
    const streakBonus = Math.min(25, currentStreak * 5);
    const totalReward = baseReward + streakBonus;
    let balance = await getBalance(userId);
    let debt = await getDebt(userId);
    let garnishment = 0;
    let rewardLeft = totalReward;
    if (debt > 0) {
        const garnishmentPercent = 20 + Math.floor(Math.random() * 11);
        garnishment = Math.min(debt, Math.floor(totalReward * (garnishmentPercent / 100)));
        debt -= garnishment;
        rewardLeft = totalReward - garnishment;
        playerDebtsInMemory[userId] = debt;
    }
    balance += rewardLeft;
    playerBalancesInMemory[userId] = balance;
    playerLastDailyInMemory[userId] = now;
    playerStreaksInMemory[userId] = currentStreak;
    const progress = getStreakProgressBar(currentStreak);
    const msg = getFunnyDailyMessage(currentStreak, totalReward, progress, garnishment > 0, garnishment, balance, debt);
    return {
        success: true,
        amount: rewardLeft,
        balance,
        message: msg
    };
}
/**
 * Thử vận may bùng nợ ngân hàng BotToan (Mỗi ngày thử 1 lần, không cho bùng khi nợ >= 500k)
 */
async function dodgeDebt(userId) {
    const now = Date.now();
    const todayStr = getVNDateString(now);
    let balance = await getBalance(userId);
    let debt = await getDebt(userId);
    // 1. Kiểm tra xem có nợ không
    if (debt <= 0) {
        return {
            success: false,
            message: `❌ **ẢO ĐÁ À CON?** Mày có nợ nần đéo gì tao đâu mà đòi bùng? Ví còn sạch sẽ **${(0, utils_1.formatMoney)(balance)}**, đi cờ bạc nợ nần đi rồi quay lại đây nói chuyện!`,
            newDebt: 0
        };
    }
    // 2. Kiểm tra nếu nợ kịch trần (>= 500k)
    if (debt >= 500) {
        return {
            success: false,
            message: `❌ **CHỦ NỢ CANH GÁC 24/7!** Số nợ của mày đã kịch khung **${(0, utils_1.formatMoney)(debt)}**. Bọn giang hồ và đòi nợ thuê đang túc trực quanh nhà mày gắt gao từng giây, đéo thể trốn bùng nợ nổi lúc này đâu con ạ! Bắt buộc phải tự cày tiền trả tay đi!`,
            newDebt: debt
        };
    }
    // 3. Kiểm tra xem hôm nay đã bùng nợ chưa
    let lastDodge = 0;
    if (useMongoDB) {
        try {
            const user = await UserModel.findOne({ userId });
            lastDodge = user && user.lastDodgeDebt ? user.lastDodgeDebt : 0;
        }
        catch (err) { }
    }
    else {
        lastDodge = playerLastDodgeDebtInMemory[userId] || 0;
    }
    const lastDodgeStr = getVNDateString(lastDodge);
    if (todayStr === lastDodgeStr) {
        const timeLeft = getTimeLeftUntilVNNextDay(now);
        return {
            success: false,
            message: `❌ **HÔM NAY BÙNG THẾ ĐỦ RỒI!** Mày đã thử bùng nợ hôm nay rồi con ạ. Chờ thêm **${timeLeft.hours} giờ ${timeLeft.minutes} phút** nữa (qua 00:00 đêm giờ Việt Nam) để chủ nợ lơ là cảnh giác rồi mới thử giật tiếp được nhé!`,
            newDebt: debt
        };
    }
    // Cập nhật mốc thời gian bùng nợ hôm nay
    if (useMongoDB) {
        try {
            await UserModel.findOneAndUpdate({ userId }, { lastDodgeDebt: now }, { upsert: true });
        }
        catch (err) { }
    }
    else {
        playerLastDodgeDebtInMemory[userId] = now;
    }
    // 4. May rủi bùng nợ 50/50
    const isSuccess = Math.random() < 0.5;
    if (isSuccess) {
        // Bùng thành công! Giảm từ 30% đến 50% số nợ, hoặc xóa sạch nếu nợ < 100k
        let wipeAmount = 0;
        if (debt < 100) {
            wipeAmount = debt;
            debt = 0;
        }
        else {
            const percent = 30 + Math.floor(Math.random() * 21); // 30% - 50%
            wipeAmount = Math.floor(debt * (percent / 100));
            debt -= wipeAmount;
        }
        if (useMongoDB) {
            try {
                await UserModel.findOneAndUpdate({ userId }, { debt });
            }
            catch (err) { }
        }
        else {
            playerDebtsInMemory[userId] = debt;
        }
        return {
            success: true,
            message: `😱 **ÔI TRỜI ĐẤT ƠI! TRỐN NỢ THÀNH CÔNG!** Mày lủi nhanh như chạch làm tay chân của tao mất dấu, tao đành ngậm ngùi xóa bớt **${(0, utils_1.formatMoney)(wipeAmount)}** nợ cho mày.\n🏦 **Nợ còn lại:** **${(0, utils_1.formatMoney)(debt)}**. Khôn hồn thì nằm im góc tối, đừng để tao bắt được!`,
            newDebt: debt
        };
    }
    else {
        // Bùng thất bại! Phạt nhân 1.5 lần số nợ
        const penalty = Math.floor(debt * 0.5);
        debt += penalty;
        if (useMongoDB) {
            try {
                await UserModel.findOneAndUpdate({ userId }, { debt });
            }
            catch (err) { }
        }
        else {
            playerDebtsInMemory[userId] = debt;
        }
        return {
            success: false,
            message: `🚔 **BẮT ĐƯỢC CON NỢ GIẬT NỢ!** Mày định bùng **${(0, utils_1.formatMoney)(debt - penalty)}** nợ của ngân hàng BotToan à? Con giời quá non! Đàn em giang hồ của tao đã tóm cổ mày lôi cổ về đồn, **phạt x1.5 số nợ** (Nợ mới: **${(0, utils_1.formatMoney)(debt)}**), đồng thời áp giải vào **Nhà Tù** khóa mõm 3 phút cho chừa thói khôn lỏi!`,
            doubleDebt: true,
            newDebt: debt
        };
    }
}
/**
 * Lấy danh sách Top 5 Đại gia và Top 5 Cái bang
 */
async function getLeaderboard() {
    if (useMongoDB) {
        try {
            const rich = await UserModel.find({}).sort({ balance: -1 }).limit(5);
            const poor = await UserModel.find({}).sort({ balance: 1 }).limit(5);
            return {
                rich: rich.map(u => ({ userId: u.userId, balance: u.balance })),
                poor: poor.map(u => ({ userId: u.userId, balance: u.balance }))
            };
        }
        catch (error) {
            console.error("[DB LỖI] Lỗi lấy BXH từ MongoDB:", error);
        }
    }
    // Fallback to In-Memory
    const userArray = Object.keys(playerBalancesInMemory).map(userId => ({
        userId,
        balance: playerBalancesInMemory[userId]
    }));
    const rich = [...userArray].sort((a, b) => b.balance - a.balance).slice(0, 5);
    const poor = [...userArray].sort((a, b) => a.balance - b.balance).slice(0, 5);
    return { rich, poor };
}
/**
 * Giao dịch chuyển tiền giữa 2 người chơi
 */
async function transferMoney(senderId, receiverId, amount) {
    if (amount <= 0) {
        const senderBal = await getBalance(senderId);
        return { success: false, message: "Số tiền chuyển phải lớn hơn 0 chứ mày!", senderBalance: senderBal };
    }
    if (senderId === receiverId) {
        const senderBal = await getBalance(senderId);
        return { success: false, message: "Mày bị ảo à, tự chuyển tiền cho mình làm gì?", senderBalance: senderBal };
    }
    if (useMongoDB) {
        try {
            let sender = await UserModel.findOne({ userId: senderId });
            if (!sender)
                sender = await UserModel.create({ userId: senderId, balance: 100 });
            if (sender.balance < amount) {
                return {
                    success: false,
                    message: `Số dư không đủ! Mày chỉ còn **${(0, utils_1.formatMoney)(sender.balance)}**, đéo đủ để chuyển **${(0, utils_1.formatMoney)(amount)}**.`,
                    senderBalance: sender.balance
                };
            }
            let receiver = await UserModel.findOne({ userId: receiverId });
            if (!receiver)
                receiver = await UserModel.create({ userId: receiverId, balance: 100 });
            sender.balance -= amount;
            receiver.balance += amount;
            await sender.save();
            await receiver.save();
            return {
                success: true,
                message: `💸 Chuyển tiền thành công! Mày đã gửi **${(0, utils_1.formatMoney)(amount)}** cho <@${receiverId}>.`,
                senderBalance: sender.balance
            };
        }
        catch (error) {
            console.error("[DB LỖI] Lỗi giao dịch chuyển khoản trên MongoDB:", error);
        }
    }
    // Fallback to In-Memory
    let senderBal = await getBalance(senderId);
    if (senderBal < amount) {
        return {
            success: false,
            message: `Số dư không đủ! Mày chỉ còn **${(0, utils_1.formatMoney)(senderBal)}**, đéo đủ để chuyển **${(0, utils_1.formatMoney)(amount)}**.`,
            senderBalance: senderBal
        };
    }
    let receiverBal = await getBalance(receiverId);
    senderBal -= amount;
    receiverBal += amount;
    playerBalancesInMemory[senderId] = senderBal;
    playerBalancesInMemory[receiverId] = receiverBal;
    return {
        success: true,
        message: `💸 Chuyển tiền thành công (RAM DB)! Mày đã gửi **${(0, utils_1.formatMoney)(amount)}** cho <@${receiverId}>.`,
        senderBalance: senderBal
    };
}
/**
 * Lấy khoản nợ hiện tại của người chơi
 */
async function getDebt(userId) {
    if (useMongoDB) {
        try {
            const user = await UserModel.findOne({ userId });
            return user && user.debt !== undefined ? user.debt : 0;
        }
        catch (error) {
            console.error("[DB LỖI] Lỗi lấy tiền nợ từ MongoDB:", error);
        }
    }
    return playerDebtsInMemory[userId] || 0;
}
/**
 * Thực hiện vay tiền ngân hàng (100k)
 */
async function borrowMoney(userId) {
    const currentBalance = await getBalance(userId);
    const debt = await getDebt(userId);
    if (debt >= 500) {
        return {
            success: false,
            balance: currentBalance,
            debt: debt,
            message: `❌ **HẠN MỨC NỢ KỊCH TRẦN!** Mày đang nợ tao kịch khung **${(0, utils_1.formatMoney)(debt)}** rồi con ạ! Trả bớt nợ đi rồi tao mới cho vay tiếp, đéo cho vay khôn thế đâu!`
        };
    }
    if (currentBalance >= 10) {
        return {
            success: false,
            balance: currentBalance,
            debt: debt,
            message: `Đĩ thõa, ví mày còn **${(0, utils_1.formatMoney)(currentBalance)}** mà đòi vay? Bao giờ nhẵn túi tao mới cho vay!`
        };
    }
    const borrowAmount = 100;
    if (useMongoDB) {
        try {
            let user = await UserModel.findOne({ userId });
            if (!user) {
                user = await UserModel.create({ userId, balance: 100, debt: 0 });
            }
            user.balance += borrowAmount;
            user.debt = (user.debt || 0) + borrowAmount;
            await user.save();
            return {
                success: true,
                balance: user.balance,
                debt: user.debt,
                message: `🏦 **NGÂN HÀNG BOTTOAN GIẢI NGÂN:**\nBơm thêm **${(0, utils_1.formatMoney)(borrowAmount)}** vào ví chung. Mày đang nợ tao tổng **${(0, utils_1.formatMoney)(user.debt)}**. Gỡ lẹ đi!`
            };
        }
        catch (error) {
            console.error("[DB LỖI] Lỗi vay tiền trên MongoDB:", error);
        }
    }
    // Fallback to In-Memory
    const newDebt = (playerDebtsInMemory[userId] || 0) + borrowAmount;
    playerDebtsInMemory[userId] = newDebt;
    playerBalancesInMemory[userId] = currentBalance + borrowAmount;
    return {
        success: true,
        balance: playerBalancesInMemory[userId],
        debt: newDebt,
        message: `🏦 **NGÂN HÀNG BOTTOAN GIẢI NGÂN (RAM DB):**\nBơm thêm **${(0, utils_1.formatMoney)(borrowAmount)}** vào ví chung. Mày đang nợ tao tổng **${(0, utils_1.formatMoney)(newDebt)}**. Gỡ lẹ đi!`
    };
}
/**
 * Thực hiện trả nợ ngân hàng tự nguyện
 */
async function payDebt(userId, target) {
    let balance = await getBalance(userId);
    let debt = await getDebt(userId);
    if (debt <= 0) {
        return {
            success: false,
            message: `Mày có nợ nần gì tao đâu mà đòi trả? Lo đi cờ bạc tiếp đi con ạ! Ví còn **${(0, utils_1.formatMoney)(balance)}**.`
        };
    }
    let payAmount = 0;
    if (!target || target === 'het' || target === 'all') {
        payAmount = Math.min(balance, debt);
    }
    else {
        const parsed = (0, utils_1.parseMoneyInput)(target);
        if (parsed === null || parsed <= 0) {
            return {
                success: false,
                message: `Cú pháp trả nợ sai rồi! Nhập dạng \`tra no 50k\` hoặc \`tra no het\`.`
            };
        }
        payAmount = Math.min(balance, debt, parsed);
    }
    if (payAmount <= 0) {
        return {
            success: false,
            message: `Mày làm đéo gì còn đồng nào trong ví mà đòi trả nợ? Đi điểm danh hoặc vay tiếp (nếu chưa kịch trần) đi con ạ!`
        };
    }
    balance -= payAmount;
    debt -= payAmount;
    await updateBalance(userId, balance);
    if (useMongoDB) {
        try {
            await UserModel.findOneAndUpdate({ userId }, { debt });
        }
        catch (err) {
            console.error("Lỗi cập nhật nợ trên MongoDB:", err);
        }
    }
    else {
        playerDebtsInMemory[userId] = debt;
    }
    if (debt === 0) {
        return {
            success: true,
            message: `🎉 **TUNG HÔ QUÝ NHÂN UY TÍN!** 🎉\n<@${userId}> đã hoàn thành nghĩa vụ quốc gia, trả sạch toàn bộ nợ nần! Anh em trong server vỗ tay tuyên dương người chơi hệ uy tín này nào! 👏👏👏\n\n💰 **Ví hiện tại:** **${(0, utils_1.formatMoney)(balance)}**`
        };
    }
    else {
        return {
            success: true,
            message: `🏦 **Trả nợ thành công!** Mày đã trả **${(0, utils_1.formatMoney)(payAmount)}**.\n💰 **Số dư còn lại:** **${(0, utils_1.formatMoney)(balance)}**\n🏦 **Nợ còn lại:** **${(0, utils_1.formatMoney)(debt)}**`
        };
    }
}
/**
 * Lấy số dư và nợ của danh sách người dùng
 */
async function getBalancesAndDebts(userIds) {
    if (useMongoDB) {
        try {
            const users = await UserModel.find({ userId: { $in: userIds } });
            const userMap = new Map(users.map(u => [u.userId, u]));
            const results = [];
            for (const id of userIds) {
                const u = userMap.get(id);
                if (u) {
                    results.push({ userId: id, balance: u.balance, debt: u.debt || 0 });
                }
                else {
                    results.push({ userId: id, balance: 100, debt: 0 });
                }
            }
            return results;
        }
        catch (error) {
            console.error("[DB LỖI] Lỗi lấy danh sách ví từ MongoDB:", error);
        }
    }
    // Fallback to In-Memory
    return userIds.map(id => {
        return {
            userId: id,
            balance: playerBalancesInMemory[id] ?? 0, // 0 nếu chưa từng tương tác với bot
            debt: playerDebtsInMemory[id] || 0
        };
    });
}
/**
 * Lấy toàn bộ số dư và nợ trong hệ thống
 */
async function getAllBalancesAndDebts() {
    if (useMongoDB) {
        try {
            const users = await UserModel.find({});
            return users.map(u => ({ userId: u.userId, balance: u.balance, debt: u.debt || 0 }));
        }
        catch (error) {
            console.error("[DB LỖI] Lỗi lấy toàn bộ ví từ MongoDB:", error);
        }
    }
    // Fallback to In-Memory
    return Object.keys(playerBalancesInMemory).map(id => ({
        userId: id,
        balance: playerBalancesInMemory[id],
        debt: playerDebtsInMemory[id] || 0
    }));
}
/**
 * Đăng ký Riot ID (Valorant) cho người dùng
 */
async function registerValorantId(userId, valorantId) {
    if (useMongoDB) {
        try {
            await UserModel.findOneAndUpdate({ userId }, { valorantId }, { upsert: true, new: true });
            return;
        }
        catch (error) {
            console.error("[DB LỖI] Lỗi đăng ký Riot ID trên MongoDB:", error);
        }
    }
    playerValorantIdsInMemory[userId] = valorantId;
}
/**
 * Lấy Riot ID (Valorant) đã đăng ký của người dùng
 */
async function getValorantId(userId) {
    if (useMongoDB) {
        try {
            const user = await UserModel.findOne({ userId });
            return user && user.valorantId ? user.valorantId : "";
        }
        catch (error) {
            console.error("[DB LỖI] Lỗi lấy Riot ID từ MongoDB:", error);
        }
    }
    return playerValorantIdsInMemory[userId] || "";
}
/**
 * Mua vé số kiến thiết BotToan (10k/vé, tối đa 5 vé/người/ngày)
 */
async function buyLotteryTicket(userId, num) {
    const ticketCost = 10; // 10k
    const now = Date.now();
    const todayStr = getVNDateString(now);
    // Check if already drawn today (Security Loophole block)
    if (useMongoDB) {
        try {
            const state = await LotteryStateModel.findOne({ date: todayStr });
            if (state && state.drawn) {
                return {
                    success: false,
                    message: "❌ **ĐỢT QUAY HÔM NAY ĐÃ KẾT THÚC!** Đợt quay thưởng lúc 18:30 hôm nay đã kết thúc rồi. Vui lòng quay lại mua vé vào ngày mai!",
                    jackpotPool: state.jackpotPool
                };
            }
        }
        catch (err) { }
    }
    else {
        if (inMemoryLotteryStates[todayStr] && inMemoryLotteryStates[todayStr].drawn) {
            return {
                success: false,
                message: "❌ **ĐỢT QUAY HÔM NAY ĐÃ KẾT THÚC!** Đợt quay thưởng lúc 18:30 hôm nay đã kết thúc rồi. Vui lòng quay lại mua vé vào ngày mai!",
                jackpotPool: inMemoryJackpotPool
            };
        }
    }
    // 1. Kiểm tra số dư ví
    let balance = await getBalance(userId);
    if (balance < ticketCost) {
        return {
            success: false,
            message: `❌ **ĐÉO ĐỦ TIỀN MUA VÉ!** Ví mày còn đúng **${(0, utils_1.formatMoney)(balance)}**, đéo đủ 10k để mua 1 tờ vé số kiến thiết!`,
            jackpotPool: await getCurrentJackpotPool(todayStr)
        };
    }
    // 2. Kiểm tra xem người dùng đã mua bao nhiêu vé hôm nay
    let todayTicketsCount = 0;
    if (useMongoDB) {
        try {
            todayTicketsCount = await LotteryTicketModel.countDocuments({ userId, date: todayStr });
        }
        catch (err) { }
    }
    else {
        todayTicketsCount = inMemoryTickets.filter(t => t.userId === userId && t.date === todayStr).length;
    }
    if (todayTicketsCount >= 5) {
        return {
            success: false,
            message: `❌ **QUÁ HẠN MỨC MUA VÉ!** Mỗi đấu sĩ chỉ được mua tối đa **5 vé / ngày** để tránh ôm đồm phá hoại thị trường! Hôm nay mày mua đủ 5 vé rồi con ạ.`,
            jackpotPool: await getCurrentJackpotPool(todayStr)
        };
    }
    // 3. Trừ tiền cược và tăng hũ tích lũy Jackpot
    balance -= ticketCost;
    await updateBalance(userId, balance);
    let newJackpot = 200;
    if (useMongoDB) {
        try {
            // Thêm vé
            await LotteryTicketModel.create({ userId, number: num, date: todayStr });
            // Tìm hoặc tạo LotteryState cho hôm nay, cộng thêm 10 vào jackpotPool
            let state = await LotteryStateModel.findOne({ date: todayStr });
            if (!state) {
                // Lấy hũ lũy kế từ ngày hôm trước nếu có
                const yesterdayStr = getVNDateString(now - 24 * 60 * 60 * 1000);
                const prev = await LotteryStateModel.findOne({ date: yesterdayStr });
                const prevPool = prev ? prev.jackpotPool : 200;
                state = await LotteryStateModel.create({ date: todayStr, jackpotPool: prevPool });
            }
            state.jackpotPool += ticketCost;
            await state.save();
            newJackpot = state.jackpotPool;
        }
        catch (err) {
            console.error("Lỗi mua vé trên MongoDB:", err);
        }
    }
    else {
        inMemoryTickets.push({ userId, number: num, date: todayStr });
        inMemoryJackpotPool += ticketCost;
        newJackpot = inMemoryJackpotPool;
    }
    return {
        success: true,
        message: `🎟️ **MUA VÉ SỐ THÀNH CÔNG!** Mày đã mua vé số số **${num}** với giá **10k**. 10k này đã được cúng trực tiếp vào hũ Jackpot!\n💰 **Số dư còn lại:** **${(0, utils_1.formatMoney)(balance)}**`,
        jackpotPool: newJackpot
    };
}
async function getLotteryInfo(userId) {
    const now = Date.now();
    const todayStr = getVNDateString(now);
    const yesterdayStr = getVNDateString(now - 24 * 60 * 60 * 1000);
    let pool = 200;
    let myTickets = [];
    let lastWinningNum = "";
    let lastDrawDate = "";
    if (useMongoDB) {
        try {
            // Lấy hũ hôm nay
            let state = await LotteryStateModel.findOne({ date: todayStr });
            if (!state) {
                const prev = await LotteryStateModel.findOne({ date: yesterdayStr });
                const prevPool = prev ? prev.jackpotPool : 200;
                state = await LotteryStateModel.create({ date: todayStr, jackpotPool: prevPool });
            }
            pool = state.jackpotPool;
            // Lấy vé của tôi hôm nay
            const tickets = await LotteryTicketModel.find({ userId, date: todayStr });
            myTickets = tickets.map(t => t.number);
            // Tìm đợt quay thưởng gần nhất trước ngày hôm nay
            const lastState = await LotteryStateModel.findOne({ drawn: true }).sort({ date: -1 });
            if (lastState && lastState.winningNumbers && lastState.winningNumbers.length > 0) {
                lastWinningNum = lastState.winningNumbers.join(" - ");
                lastDrawDate = lastState.date;
            }
        }
        catch (err) { }
    }
    else {
        pool = inMemoryJackpotPool;
        myTickets = inMemoryTickets.filter(t => t.userId === userId && t.date === todayStr).map(t => t.number);
        // Tìm ngày quay thưởng gần nhất trong RAM
        const dates = Object.keys(inMemoryLotteryStates).filter(d => inMemoryLotteryStates[d].drawn).sort();
        if (dates.length > 0) {
            const lastD = dates[dates.length - 1];
            lastWinningNum = inMemoryLotteryStates[lastD].winningNumbers.join(" - ");
            lastDrawDate = lastD;
        }
    }
    return {
        jackpotPool: pool,
        myTickets,
        lastWinningNum,
        lastDrawDate
    };
}
async function getCurrentJackpotPool(dateStr) {
    if (useMongoDB) {
        try {
            const state = await LotteryStateModel.findOne({ date: dateStr });
            return state ? state.jackpotPool : 200;
        }
        catch (err) { }
    }
    return inMemoryJackpotPool;
}
/**
 * Thực hiện quay thưởng xổ số kiến thiết ngày hôm nay
 */
async function drawLottery(dateStr) {
    if (useMongoDB) {
        try {
            let state = await LotteryStateModel.findOne({ date: dateStr });
            if (!state) {
                const now = Date.now();
                const yesterdayStr = getVNDateString(now - 24 * 60 * 60 * 1000);
                const prev = await LotteryStateModel.findOne({ date: yesterdayStr });
                const prevPool = prev ? prev.jackpotPool : 200;
                state = await LotteryStateModel.create({ date: dateStr, jackpotPool: prevPool });
            }
            if (state.drawn) {
                return { success: false }; // Đã quay rồi
            }
            // 1. Quay 5 số ngẫu nhiên duy nhất từ 00 đến 99
            const winningNumbers = [];
            while (winningNumbers.length < 5) {
                const rand = Math.floor(Math.random() * 100);
                const numStr = String(rand).padStart(2, '0');
                if (!winningNumbers.includes(numStr)) {
                    winningNumbers.push(numStr);
                }
            }
            // 2. Tìm tất cả các vé số trúng thưởng ngày hôm nay
            const matchingTickets = await LotteryTicketModel.find({ date: dateStr, number: { $in: winningNumbers } });
            const totalWinningTickets = matchingTickets.length;
            const pool = state.jackpotPool;
            let winnersList = [];
            let payoutPerTicket = 0;
            let nextJackpotPool = pool;
            if (totalWinningTickets > 0) {
                payoutPerTicket = Math.floor(pool / totalWinningTickets);
                const userTicketCounts = {};
                for (const t of matchingTickets) {
                    userTicketCounts[t.userId] = (userTicketCounts[t.userId] || 0) + 1;
                }
                winnersList = Object.keys(userTicketCounts).map(uId => ({
                    userId: uId,
                    ticketsCount: userTicketCounts[uId]
                }));
                for (const winner of winnersList) {
                    const totalReward = payoutPerTicket * winner.ticketsCount;
                    let bal = await getBalance(winner.userId);
                    bal += totalReward;
                    await updateBalance(winner.userId, bal);
                }
                nextJackpotPool = 200;
            }
            state.winningNumbers = winningNumbers;
            state.drawn = true;
            await state.save();
            const tomorrowStr = getVNDateString(Date.now() + 24 * 60 * 60 * 1000);
            await LotteryStateModel.findOneAndUpdate({ date: tomorrowStr }, { jackpotPool: nextJackpotPool }, { upsert: true, new: true });
            return {
                success: true,
                winningNumbers,
                winners: winnersList,
                payoutPerTicket,
                jackpotPool: pool
            };
        }
        catch (err) {
            console.error("Lỗi quay thưởng xổ số trên MongoDB:", err);
            return { success: false };
        }
    }
    // Fallback to In-Memory
    if (inMemoryLotteryStates[dateStr] && inMemoryLotteryStates[dateStr].drawn) {
        return { success: false };
    }
    const winningNumbers = [];
    while (winningNumbers.length < 5) {
        const rand = Math.floor(Math.random() * 100);
        const numStr = String(rand).padStart(2, '0');
        if (!winningNumbers.includes(numStr)) {
            winningNumbers.push(numStr);
        }
    }
    const matchingTickets = inMemoryTickets.filter(t => t.date === dateStr && winningNumbers.includes(t.number));
    const totalWinningTickets = matchingTickets.length;
    const pool = inMemoryJackpotPool;
    let winnersList = [];
    let payoutPerTicket = 0;
    if (totalWinningTickets > 0) {
        payoutPerTicket = Math.floor(pool / totalWinningTickets);
        const userTicketCounts = {};
        for (const t of matchingTickets) {
            userTicketCounts[t.userId] = (userTicketCounts[t.userId] || 0) + 1;
        }
        winnersList = Object.keys(userTicketCounts).map(uId => ({
            userId: uId,
            ticketsCount: userTicketCounts[uId]
        }));
        for (const winner of winnersList) {
            const totalReward = payoutPerTicket * winner.ticketsCount;
            let bal = await getBalance(winner.userId);
            bal += totalReward;
            await updateBalance(winner.userId, bal);
        }
        inMemoryJackpotPool = 200;
    }
    inMemoryLotteryStates[dateStr] = {
        winningNumbers,
        drawn: true
    };
    return {
        success: true,
        winningNumbers,
        winners: winnersList,
        payoutPerTicket,
        jackpotPool: pool
    };
}
async function getLastLotteryDraw() {
    if (useMongoDB) {
        try {
            const lastState = await LotteryStateModel.findOne({ drawn: true }).sort({ date: -1 });
            if (!lastState)
                return null;
            // Tìm các vé trúng thưởng vào ngày này
            const matchingTickets = await LotteryTicketModel.find({ date: lastState.date, number: { $in: lastState.winningNumbers } });
            const totalWinningTickets = matchingTickets.length;
            const payoutPerTicket = totalWinningTickets > 0 ? Math.floor(lastState.jackpotPool / totalWinningTickets) : 0;
            const userTicketCounts = {};
            for (const t of matchingTickets) {
                userTicketCounts[t.userId] = (userTicketCounts[t.userId] || 0) + 1;
            }
            const winners = Object.keys(userTicketCounts).map(uId => ({
                userId: uId,
                ticketsCount: userTicketCounts[uId],
                payout: payoutPerTicket * userTicketCounts[uId]
            }));
            return {
                success: true,
                date: lastState.date,
                winningNumbers: lastState.winningNumbers,
                jackpotPool: lastState.jackpotPool,
                winners
            };
        }
        catch (err) {
            console.error("Lỗi lấy thông tin kqxs từ MongoDB:", err);
            return null;
        }
    }
    // Fallback to In-Memory
    const drawnDates = Object.keys(inMemoryLotteryStates).filter(d => inMemoryLotteryStates[d].drawn).sort();
    if (drawnDates.length === 0)
        return null;
    const lastDate = drawnDates[drawnDates.length - 1];
    const winNums = inMemoryLotteryStates[lastDate].winningNumbers;
    const matchingTickets = inMemoryTickets.filter(t => t.date === lastDate && winNums.includes(t.number));
    const totalWinningTickets = matchingTickets.length;
    const payoutPerTicket = totalWinningTickets > 0 ? Math.floor(inMemoryJackpotPool / totalWinningTickets) : 0;
    const userTicketCounts = {};
    for (const t of matchingTickets) {
        userTicketCounts[t.userId] = (userTicketCounts[t.userId] || 0) + 1;
    }
    const winners = Object.keys(userTicketCounts).map(uId => ({
        userId: uId,
        ticketsCount: userTicketCounts[uId],
        payout: payoutPerTicket * userTicketCounts[uId]
    }));
    return {
        success: true,
        date: lastDate,
        winningNumbers: winNums,
        jackpotPool: inMemoryJackpotPool,
        winners
    };
}
/**
 * Lấy trạng thái cooldown báo án của người dùng (1 lần / ngày theo ngày VN UTC+7)
 */
async function getSnitchCooldown(userId) {
    const now = Date.now();
    const todayStr = getVNDateString(now);
    let lastSnitchDate = "";
    if (useMongoDB) {
        try {
            const user = await UserModel.findOne({ userId });
            lastSnitchDate = user && user.lastSnitchDate ? user.lastSnitchDate : "";
        }
        catch (err) {
            console.error("[DB LỖI] Lỗi lấy ngày báo án từ MongoDB:", err);
        }
    }
    else {
        lastSnitchDate = playerLastSnitchDatesInMemory[userId] || "";
    }
    return {
        canSnitch: lastSnitchDate !== todayStr,
        todayStr
    };
}
/**
 * Cập nhật ngày báo án gần nhất của người dùng sang ngày hiện tại
 */
async function updateSnitchDate(userId, todayStr) {
    if (useMongoDB) {
        try {
            await UserModel.findOneAndUpdate({ userId }, { lastSnitchDate: todayStr }, { upsert: true });
        }
        catch (err) {
            console.error("[DB LỖI] Lỗi cập nhật ngày báo án trên MongoDB:", err);
        }
    }
    else {
        playerLastSnitchDatesInMemory[userId] = todayStr;
    }
}
/**
 * Lưu hồ sơ thông tin cá nhân của người dùng
 */
async function saveProfile(userId, name, gender, birthday) {
    if (useMongoDB) {
        try {
            await UserModel.findOneAndUpdate({ userId }, { name, gender, birthday }, { upsert: true, new: true });
            return;
        }
        catch (error) {
            console.error("[DB LỖI] Lỗi lưu hồ sơ trên MongoDB:", error);
        }
    }
    playerProfilesInMemory[userId] = { name, gender, birthday };
}
/**
 * Lấy hồ sơ thông tin cá nhân của người dùng
 */
async function getProfile(userId) {
    if (useMongoDB) {
        try {
            const user = await UserModel.findOne({ userId });
            if (user && user.name && user.gender && user.birthday) {
                return {
                    name: user.name,
                    gender: user.gender,
                    birthday: user.birthday
                };
            }
            return null;
        }
        catch (error) {
            console.error("[DB LỖI] Lỗi lấy hồ sơ từ MongoDB:", error);
        }
    }
    const local = playerProfilesInMemory[userId];
    return local || null;
}
/**
 * Cập nhật thông tin crush của người dùng
 */
async function updateCrush(userId, crushId) {
    let oldCrush = "";
    if (useMongoDB) {
        try {
            const user = await UserModel.findOne({ userId });
            oldCrush = user && user.crushUserId ? user.crushUserId : "";
            await UserModel.findOneAndUpdate({ userId }, { crushUserId: crushId }, { upsert: true, new: true });
        }
        catch (error) {
            console.error("[DB LỖI] Lỗi cập nhật crush trên MongoDB:", error);
        }
    }
    else {
        oldCrush = playerCrushesInMemory[userId] || "";
        playerCrushesInMemory[userId] = crushId;
    }
    return oldCrush;
}
/**
 * Lấy thông tin crush hiện tại của người dùng
 */
async function getCrush(userId) {
    if (useMongoDB) {
        try {
            const user = await UserModel.findOne({ userId });
            return user && user.crushUserId ? user.crushUserId : "";
        }
        catch (error) {
            console.error("[DB LỖI] Lỗi lấy thông tin crush từ MongoDB:", error);
        }
    }
    return playerCrushesInMemory[userId] || "";
}
/**
 * Lấy danh sách ID những người đang thích userId này (Thám tử / Bán đứng)
 */
async function getWhoCrushedMe(userId) {
    if (useMongoDB) {
        try {
            const users = await UserModel.find({ crushUserId: userId });
            return users.map(u => u.userId);
        }
        catch (error) {
            console.error("[DB LỖI] Lỗi lấy danh sách crush từ MongoDB:", error);
        }
    }
    // Fallback to RAM
    return Object.keys(playerCrushesInMemory).filter(k => playerCrushesInMemory[k] === userId);
}
/**
 * Tăng số lần thay đổi crush của người dùng trong ngày và trả về số lần hiện tại
 */
async function incrementCrushChange(userId, todayStr) {
    if (useMongoDB) {
        try {
            let user = await UserModel.findOne({ userId });
            if (!user) {
                user = await UserModel.create({ userId });
            }
            if (user.lastCrushChangeDate !== todayStr) {
                user.crushChangesToday = 1;
                user.lastCrushChangeDate = todayStr;
            }
            else {
                user.crushChangesToday = (user.crushChangesToday || 0) + 1;
            }
            await user.save();
            return user.crushChangesToday || 1;
        }
        catch (error) {
            console.error("[DB LỖI] Lỗi cập nhật số lần đổi crush trên MongoDB:", error);
        }
    }
    // Fallback to RAM
    if (playerLastCrushChangeDateInMemory[userId] !== todayStr) {
        playerCrushChangesTodayInMemory[userId] = 1;
        playerLastCrushChangeDateInMemory[userId] = todayStr;
    }
    else {
        playerCrushChangesTodayInMemory[userId] = (playerCrushChangesTodayInMemory[userId] || 0) + 1;
    }
    return playerCrushChangesTodayInMemory[userId];
}
/**
 * Tăng số lần ghép đôi thất bại (< 20%) trong ngày và trả về số lần hiện tại
 */
async function incrementFailedMatch(userId, todayStr) {
    if (useMongoDB) {
        try {
            let user = await UserModel.findOne({ userId });
            if (!user) {
                user = await UserModel.create({ userId });
            }
            if (user.lastFailedMatchDate !== todayStr) {
                user.failedMatchesToday = 1;
                user.lastFailedMatchDate = todayStr;
            }
            else {
                user.failedMatchesToday = (user.failedMatchesToday || 0) + 1;
            }
            await user.save();
            return user.failedMatchesToday || 1;
        }
        catch (error) {
            console.error("[DB LỖI] Lỗi cập nhật ghép đôi thất bại trên MongoDB:", error);
        }
    }
    // Fallback to RAM
    if (playerLastFailedMatchDateInMemory[userId] !== todayStr) {
        playerFailedMatchesTodayInMemory[userId] = 1;
        playerLastFailedMatchDateInMemory[userId] = todayStr;
    }
    else {
        playerFailedMatchesTodayInMemory[userId] = (playerFailedMatchesTodayInMemory[userId] || 0) + 1;
    }
    return playerFailedMatchesTodayInMemory[userId];
}
/**
 * Set thời gian chịu phạt Simp Lỏ của người dùng
 */
async function setSimpLo(userId, expires) {
    if (useMongoDB) {
        try {
            await UserModel.findOneAndUpdate({ userId }, { simpLoUntil: expires }, { upsert: true });
            return;
        }
        catch (error) {
            console.error("[DB LỖI] Lỗi cập nhật trạng thái Simp Lỏ trên MongoDB:", error);
        }
    }
    playerSimpLoUntilInMemory[userId] = expires;
}
/**
 * Lấy thời gian hết hạn chịu phạt Simp Lỏ của người dùng
 */
async function getSimpLoExpires(userId) {
    if (useMongoDB) {
        try {
            const user = await UserModel.findOne({ userId });
            return user && user.simpLoUntil ? user.simpLoUntil : 0;
        }
        catch (error) {
            console.error("[DB LỖI] Lỗi lấy thời gian hết hạn Simp Lỏ từ MongoDB:", error);
        }
    }
    return playerSimpLoUntilInMemory[userId] || 0;
}
/**
 * Kiểm tra xem người dùng đã gieo quẻ hôm nay chưa
 */
async function hasGieoQueToday(userId, todayStr) {
    if (useMongoDB) {
        try {
            const user = await UserModel.findOne({ userId });
            return user && user.lastQueDate === todayStr ? true : false;
        }
        catch (error) {
            console.error("[DB LỖI] Lỗi kiểm tra ngày gieo quẻ từ MongoDB:", error);
        }
    }
    return playerLastQueDateInMemory[userId] === todayStr;
}
/**
 * Đánh dấu người dùng đã gieo quẻ hôm nay (lưu ngày gieo quẻ lập tức)
 */
async function markGieoQueToday(userId, todayStr) {
    if (useMongoDB) {
        try {
            await UserModel.findOneAndUpdate({ userId }, { lastQueDate: todayStr }, { upsert: true, new: true });
            return;
        }
        catch (error) {
            console.error("[DB LỖI] Lỗi lưu ngày gieo quẻ lên MongoDB:", error);
        }
    }
    playerLastQueDateInMemory[userId] = todayStr;
}
/**
 * Kiểm tra xem người dùng đã bói Tarot hôm nay chưa
 */
async function hasTarotToday(userId, todayStr) {
    if (useMongoDB) {
        try {
            const user = await UserModel.findOne({ userId });
            return user && user.lastTarotDate === todayStr ? true : false;
        }
        catch (error) {
            console.error("[DB LỖI] Lỗi kiểm tra ngày Tarot từ MongoDB:", error);
        }
    }
    return playerLastTarotDateInMemory[userId] === todayStr;
}
/**
 * Ghi nhận lượt chơi Tarot hôm nay và cập nhật streak, trả về streak mới
 */
async function recordTarotPlay(userId, todayStr, now) {
    let newStreak = 1;
    if (useMongoDB) {
        try {
            let user = await UserModel.findOne({ userId });
            if (!user) {
                user = await UserModel.create({ userId });
            }
            const lastTimestamp = user.lastTarotTimestamp || 0;
            if (lastTimestamp > 0) {
                const diffDays = getCalendarDayDifference(lastTimestamp, now);
                if (diffDays === 1) {
                    newStreak = (user.tarotStreak || 0) + 1;
                }
                else if (diffDays === 0) {
                    newStreak = user.tarotStreak || 1;
                }
                else {
                    newStreak = 1;
                }
            }
            else {
                newStreak = 1;
            }
            user.lastTarotDate = todayStr;
            user.lastTarotTimestamp = now;
            user.tarotStreak = newStreak;
            await user.save();
            return newStreak;
        }
        catch (error) {
            console.error("[DB LỖI] Lỗi recordTarotPlay trên MongoDB:", error);
        }
    }
    // Fallback to RAM
    const lastTimestamp = playerLastTarotTimestampInMemory[userId] || 0;
    if (lastTimestamp > 0) {
        const diffDays = getCalendarDayDifference(lastTimestamp, now);
        if (diffDays === 1) {
            newStreak = (playerTarotStreakInMemory[userId] || 0) + 1;
        }
        else if (diffDays === 0) {
            newStreak = playerTarotStreakInMemory[userId] || 1;
        }
        else {
            newStreak = 1;
        }
    }
    else {
        newStreak = 1;
    }
    playerLastTarotDateInMemory[userId] = todayStr;
    playerLastTarotTimestampInMemory[userId] = now;
    playerTarotStreakInMemory[userId] = newStreak;
    return newStreak;
}
/**
 * Hoàn tác lượt chơi Tarot nếu gửi kết quả qua DM bị lỗi
 */
async function cancelTarotPlay(userId) {
    if (useMongoDB) {
        try {
            let user = await UserModel.findOne({ userId });
            if (user) {
                user.lastTarotDate = "";
                user.lastTarotTimestamp = 0;
                if (user.tarotStreak && user.tarotStreak > 0) {
                    user.tarotStreak = user.tarotStreak - 1;
                }
                await user.save();
            }
            return;
        }
        catch (error) {
            console.error("[DB LỖI] Lỗi cancelTarotPlay trên MongoDB:", error);
        }
    }
    playerLastTarotDateInMemory[userId] = "";
    playerLastTarotTimestampInMemory[userId] = 0;
    if (playerTarotStreakInMemory[userId] && playerTarotStreakInMemory[userId] > 0) {
        playerTarotStreakInMemory[userId] = playerTarotStreakInMemory[userId] - 1;
    }
}
/**
 * Lấy tất cả vé số đã mua trong ngày
 */
async function getLotteryTicketsForDate(dateStr) {
    if (useMongoDB) {
        try {
            const tickets = await LotteryTicketModel.find({ date: dateStr });
            return tickets.map(t => ({ userId: t.userId, number: t.number }));
        }
        catch (err) {
            console.error("Lỗi lấy vé số theo ngày trên MongoDB:", err);
            return [];
        }
    }
    return inMemoryTickets.filter(t => t.date === dateStr).map(t => ({ userId: t.userId, number: t.number }));
}
/**
 * Lấy trạng thái xổ số theo ngày
 */
async function getLotteryState(dateStr) {
    if (useMongoDB) {
        try {
            const state = await LotteryStateModel.findOne({ date: dateStr });
            if (state) {
                return {
                    jackpotPool: state.jackpotPool,
                    winningNumbers: state.winningNumbers,
                    drawn: state.drawn
                };
            }
            return null;
        }
        catch (err) {
            return null;
        }
    }
    // Fallback RAM
    const state = inMemoryLotteryStates[dateStr];
    if (state) {
        return {
            jackpotPool: inMemoryJackpotPool,
            winningNumbers: state.winningNumbers,
            drawn: state.drawn
        };
    }
    return null;
}
// ============================================================
// =========== CÁC HÀM DB: AURA / ANONYMOUS / MOOD ===========
// ============================================================
/**
 * Lấy ngày bói aura gần nhất của user
 */
async function getLastAuraDate(userId) {
    if (useMongoDB) {
        try {
            const user = await UserModel.findOne({ userId });
            return user?.lastAuraDate || "";
        }
        catch (err) {
            console.error("[DB LỖI] getLastAuraDate:", err);
        }
    }
    return playerLastAuraDatesInMemory[userId] || "";
}
/**
 * Lưu ngày bói aura hôm nay
 */
async function setLastAuraDate(userId, dateStr) {
    if (useMongoDB) {
        try {
            await UserModel.findOneAndUpdate({ userId }, { lastAuraDate: dateStr }, { upsert: true });
            return;
        }
        catch (err) {
            console.error("[DB LỖI] setLastAuraDate:", err);
        }
    }
    playerLastAuraDatesInMemory[userId] = dateStr;
}
/**
 * Lấy số thư ẩn danh đã gửi hôm nay và ngày gửi gần nhất
 */
async function getAnonymousLetterData(userId) {
    if (useMongoDB) {
        try {
            const user = await UserModel.findOne({ userId });
            return {
                count: user?.anonymousLettersSentToday || 0,
                lastDate: user?.lastAnonymousLetterDate || ""
            };
        }
        catch (err) {
            console.error("[DB LỖI] getAnonymousLetterData:", err);
        }
    }
    return {
        count: playerLetterCountInMemory[userId] || 0,
        lastDate: playerLastLetterDateInMemory[userId] || ""
    };
}
/**
 * Tăng số thư ẩn danh đã gửi hôm nay (reset nếu sang ngày mới)
 */
async function incrementAnonymousLetterCount(userId, todayStr) {
    if (useMongoDB) {
        try {
            const user = await UserModel.findOne({ userId });
            const currentDate = user?.lastAnonymousLetterDate || "";
            const currentCount = currentDate === todayStr ? (user?.anonymousLettersSentToday || 0) : 0;
            await UserModel.findOneAndUpdate({ userId }, { anonymousLettersSentToday: currentCount + 1, lastAnonymousLetterDate: todayStr }, { upsert: true });
            return;
        }
        catch (err) {
            console.error("[DB LỖI] incrementAnonymousLetterCount:", err);
        }
    }
    const currentDate = playerLastLetterDateInMemory[userId] || "";
    if (currentDate !== todayStr) {
        playerLetterCountInMemory[userId] = 0;
    }
    playerLetterCountInMemory[userId] = (playerLetterCountInMemory[userId] || 0) + 1;
    playerLastLetterDateInMemory[userId] = todayStr;
}
/**
 * Lấy dữ liệu mood: streak, ngày cuối, tâm trạng gần nhất, lịch sử 7 ngày
 */
async function getMoodData(userId) {
    let raw = { streak: 0, lastDate: "", lastMood: "", weeklyMoodsJson: "[]" };
    if (useMongoDB) {
        try {
            const user = await UserModel.findOne({ userId });
            raw = {
                streak: user?.moodStreak || 0,
                lastDate: user?.lastMoodDate || "",
                lastMood: user?.lastMood || "",
                weeklyMoodsJson: user?.weeklyMoods || "[]"
            };
        }
        catch (err) {
            console.error("[DB LỖI] getMoodData:", err);
        }
    }
    else {
        raw = {
            streak: playerMoodStreakInMemory[userId] || 0,
            lastDate: playerLastMoodDateInMemory[userId] || "",
            lastMood: playerLastMoodInMemory[userId] || "",
            weeklyMoodsJson: playerWeeklyMoodsInMemory[userId] || "[]"
        };
    }
    let weeklyMoods = [];
    try {
        weeklyMoods = JSON.parse(raw.weeklyMoodsJson);
    }
    catch {
        weeklyMoods = [];
    }
    return { streak: raw.streak, lastDate: raw.lastDate, lastMood: raw.lastMood, weeklyMoods };
}
/**
 * Lưu tâm trạng hôm nay, cập nhật streak và lịch sử 7 ngày
 */
async function saveMood(userId, mood, todayStr) {
    const data = await getMoodData(userId);
    // Tính streak: nếu hôm qua cũng ghi mood thì +1, không thì reset về 1
    const yesterday = new Date(Date.now() + 7 * 60 * 60 * 1000 - 86400000);
    const yesterdayStr = `${yesterday.getUTCFullYear()}-${String(yesterday.getUTCMonth() + 1).padStart(2, '0')}-${String(yesterday.getUTCDate()).padStart(2, '0')}`;
    const newStreak = data.lastDate === yesterdayStr ? data.streak + 1 : 1;
    // Cập nhật lịch sử 7 ngày (chỉ giữ 7 entry gần nhất, bỏ trùng ngày)
    let history = data.weeklyMoods.filter(e => e.date !== todayStr);
    history.push({ date: todayStr, mood });
    if (history.length > 7)
        history = history.slice(history.length - 7);
    const historyJson = JSON.stringify(history);
    if (useMongoDB) {
        try {
            await UserModel.findOneAndUpdate({ userId }, { moodStreak: newStreak, lastMoodDate: todayStr, lastMood: mood, weeklyMoods: historyJson }, { upsert: true });
        }
        catch (err) {
            console.error("[DB LỖI] saveMood:", err);
        }
    }
    else {
        playerMoodStreakInMemory[userId] = newStreak;
        playerLastMoodDateInMemory[userId] = todayStr;
        playerLastMoodInMemory[userId] = mood;
        playerWeeklyMoodsInMemory[userId] = historyJson;
    }
    return newStreak;
}
// ============================================================
// =========== CÁC HÀM DB: HỆ THỐNG MÁY DÒ MY GU ==============
// ============================================================
/**
 * Lấy dữ liệu trắc nghiệm MyGu của user
 */
async function getMyGuData(userId) {
    if (useMongoDB) {
        try {
            const user = await UserModel.findOne({ userId });
            return {
                lastMyGuDate: user?.lastMyGuDate || "",
                myGuCode: user?.myGuCode || "",
                myGuResultCache: user?.myGuResultCache || ""
            };
        }
        catch (err) {
            console.error("[DB LỖI] getMyGuData:", err);
        }
    }
    return {
        lastMyGuDate: playerLastMyGuDateInMemory[userId] || "",
        myGuCode: playerMyGuCodeInMemory[userId] || "",
        myGuResultCache: playerMyGuResultCacheInMemory[userId] || ""
    };
}
/**
 * Lưu kết quả trắc nghiệm MyGu của user
 */
async function saveMyGuData(userId, code, result, todayStr) {
    if (useMongoDB) {
        try {
            await UserModel.findOneAndUpdate({ userId }, { lastMyGuDate: todayStr, myGuCode: code, myGuResultCache: result }, { upsert: true });
            return;
        }
        catch (err) {
            console.error("[DB LỖI] saveMyGuData:", err);
        }
    }
    playerLastMyGuDateInMemory[userId] = todayStr;
    playerMyGuCodeInMemory[userId] = code;
    playerMyGuResultCacheInMemory[userId] = result;
}
/**
 * Lấy ngày đoán gu gần nhất
 */
async function getLastDoanGuDate(userId) {
    if (useMongoDB) {
        try {
            const user = await UserModel.findOne({ userId });
            return user?.lastDoanGuDate || "";
        }
        catch (err) {
            console.error("[DB LỖI] getLastDoanGuDate:", err);
        }
    }
    return playerLastDoanGuDateInMemory[userId] || "";
}
/**
 * Lưu ngày đoán gu gần nhất
 */
async function setLastDoanGuDate(userId, todayStr) {
    if (useMongoDB) {
        try {
            await UserModel.findOneAndUpdate({ userId }, { lastDoanGuDate: todayStr }, { upsert: true });
            return;
        }
        catch (err) {
            console.error("[DB LỖI] setLastDoanGuDate:", err);
        }
    }
    playerLastDoanGuDateInMemory[userId] = todayStr;
}
/**
 * Thêm trận đấu World Cup mới (chỉ Admin)
 */
async function addWCMatch(matchId, teamA, teamB, odds) {
    if (useMongoDB) {
        try {
            await WorldCupMatchModel.findOneAndUpdate({ matchId }, { teamA, teamB, odds, status: 'open', winner: "" }, { upsert: true, new: true });
            return true;
        }
        catch (err) {
            console.error("[DB LỖI] addWCMatch:", err);
            return false;
        }
    }
    // RAM DB
    const idx = inMemoryWCMatches.findIndex(m => m.matchId === matchId);
    const newMatch = { matchId, teamA, teamB, odds, status: 'open', winner: "" };
    if (idx !== -1) {
        inMemoryWCMatches[idx] = newMatch;
    }
    else {
        inMemoryWCMatches.push(newMatch);
    }
    return true;
}
/**
 * Khóa đặt cược trận đấu World Cup (chỉ Admin)
 */
async function lockWCMatch(matchId) {
    if (useMongoDB) {
        try {
            const match = await WorldCupMatchModel.findOne({ matchId });
            if (!match)
                return false;
            match.status = 'locked';
            await match.save();
            return true;
        }
        catch (err) {
            console.error("[DB LỖI] lockWCMatch:", err);
            return false;
        }
    }
    // RAM DB
    const match = inMemoryWCMatches.find(m => m.matchId === matchId);
    if (!match)
        return false;
    match.status = 'locked';
    return true;
}
/**
 * Lấy danh sách trận đấu World Cup đang mở hoặc khóa cược
 */
async function getActiveWCMatches() {
    if (useMongoDB) {
        try {
            return await WorldCupMatchModel.find({ status: { $in: ['open', 'locked'] } });
        }
        catch (err) {
            console.error("[DB LỖI] getActiveWCMatches:", err);
            return [];
        }
    }
    return inMemoryWCMatches.filter(m => m.status === 'open' || m.status === 'locked');
}
/**
 * Lấy thông tin chi tiết của 1 trận đấu
 */
async function getWCMatch(matchId) {
    if (useMongoDB) {
        try {
            return await WorldCupMatchModel.findOne({ matchId });
        }
        catch (err) {
            console.error("[DB LỖI] getWCMatch:", err);
            return null;
        }
    }
    return inMemoryWCMatches.find(m => m.matchId === matchId) || null;
}
/**
 * Đặt cược trận đấu World Cup
 */
async function placeWCBet(userId, matchId, team, amount) {
    // 1. Kiểm tra trận đấu có tồn tại và đang mở cửa cược không
    const match = await getWCMatch(matchId);
    if (!match) {
        return { success: false, message: "❌ Trận đấu này không tồn tại!" };
    }
    if (match.status !== 'open') {
        return { success: false, message: `❌ Trận đấu này đã ${match.status === 'locked' ? 'khóa cửa đặt cược' : 'kết thúc'} rồi, cược bằng niềm tin à!` };
    }
    // 2. Kiểm tra số dư tài khoản
    const balance = await getBalance(userId);
    if (balance < amount) {
        return { success: false, message: `❌ Số dư không đủ! Ví của mày chỉ còn **${(0, utils_1.formatMoney)(balance)}**, không đủ để cược **${(0, utils_1.formatMoney)(amount)}**.` };
    }
    // 3. Kiểm tra xem user đã cược trận này chưa
    let existingBet = null;
    if (useMongoDB) {
        try {
            existingBet = await WorldCupBetModel.findOne({ userId, matchId });
        }
        catch (err) {
            console.error("[DB LỖI] Lỗi check existing bet:", err);
        }
    }
    else {
        existingBet = inMemoryWCBets.find(b => b.userId === userId && b.matchId === matchId) || null;
    }
    if (existingBet) {
        // Kiểm tra xem có đổi cửa không (bắt hai hàng)
        if (existingBet.team !== team) {
            return { success: false, message: `❌ Bạn đã đặt cược cửa **${existingBet.team === 'A' ? 'Đội A' : 'Đội B'}** rồi, không được bắt hai hàng ăn gian đâu cưng! 🙄` };
        }
        const totalAmount = existingBet.amount + amount;
        if (totalAmount > 500) {
            return { success: false, message: `❌ Tối đa cược **500.000đ** cho mỗi trận đấu thôi ông tham lam ạ! Bạn đã cược **${(0, utils_1.formatMoney)(existingBet.amount)}** trước đó rồi.` };
        }
        // Trừ tiền ví và cộng dồn
        await updateBalance(userId, balance - amount);
        if (useMongoDB) {
            try {
                await WorldCupBetModel.updateOne({ userId, matchId }, { amount: totalAmount });
            }
            catch (err) { }
        }
        else {
            existingBet.amount = totalAmount;
        }
        return { success: true, message: `✅ Đã cộng dồn thêm **${(0, utils_1.formatMoney)(amount)}** vào cửa **${team === 'A' ? match.teamA : match.teamB}**. Tổng cược hiện tại của bạn: **${(0, utils_1.formatMoney)(totalAmount)}**.` };
    }
    else {
        // Cược tối đa 500k cho lần đầu
        if (amount > 500) {
            return { success: false, message: "❌ Tối đa cược **500.000đ** cho mỗi trận đấu thôi ông tham lam ạ!" };
        }
        // Trừ tiền ví và tạo mới
        await updateBalance(userId, balance - amount);
        if (useMongoDB) {
            try {
                await WorldCupBetModel.create({ userId, matchId, team, amount, settled: false });
            }
            catch (err) { }
        }
        else {
            inMemoryWCBets.push({ userId, matchId, team, amount, settled: false });
        }
        return { success: true, message: `✅ Đã đặt cược thành công **${(0, utils_1.formatMoney)(amount)}** vào cửa **${team === 'A' ? match.teamA : match.teamB}** cho trận đấu \`${matchId}\`.` };
    }
}
/**
 * Chung tiền cược World Cup (chỉ Admin)
 */
async function settleWCMatch(matchId, winner) {
    const match = await getWCMatch(matchId);
    if (!match) {
        return { success: false, message: "❌ Trận đấu này không tồn tại!", payoutsCount: 0 };
    }
    if (match.status === 'ended') {
        return { success: false, message: "❌ Trận đấu này đã được chung tiền từ trước rồi!", payoutsCount: 0 };
    }
    // 1. Cập nhật trạng thái trận đấu
    if (useMongoDB) {
        try {
            await WorldCupMatchModel.updateOne({ matchId }, { status: 'ended', winner });
        }
        catch (err) { }
    }
    else {
        match.status = 'ended';
        match.winner = winner;
    }
    // 2. Tìm tất cả các cược cho trận này
    let bets = [];
    if (useMongoDB) {
        try {
            bets = await WorldCupBetModel.find({ matchId, settled: false });
        }
        catch (err) { }
    }
    else {
        bets = inMemoryWCBets.filter(b => b.matchId === matchId && !b.settled);
    }
    let payoutsCount = 0;
    for (const bet of bets) {
        // Đánh dấu đã thanh toán
        if (useMongoDB) {
            try {
                await WorldCupBetModel.updateOne({ _id: bet._id }, { settled: true });
            }
            catch (err) { }
        }
        else {
            bet.settled = true;
        }
        const userBal = await getBalance(bet.userId);
        if (winner === 'HoaKeo') {
            // Hoàn trả 100% tiền cược
            await updateBalance(bet.userId, userBal + bet.amount);
            payoutsCount++;
        }
        else if (bet.team === winner) {
            // Trả thưởng gấp đôi
            await updateBalance(bet.userId, userBal + (bet.amount * 2));
            payoutsCount++;
        }
        // Thua: Không hoàn trả (vì đã trừ tiền lúc đặt cược)
    }
    const winnerName = winner === 'HoaKeo' ? 'Hòa Kèo' : (winner === 'A' ? match.teamA : match.teamB);
    return {
        success: true,
        message: `✅ Settle thành công trận đấu **${match.teamA} vs ${match.teamB}**! Kết quả thắng kèo: **${winnerName}**.\nĐã thanh toán trả thưởng/hoàn tiền thành công cho **${payoutsCount}** lượt cược.`,
        payoutsCount
    };
}
/**
 * Lấy danh sách tất cả các trận đấu World Cup (bao gồm cả trận đã kết thúc)
 */
async function getAllWCMatches() {
    if (useMongoDB) {
        try {
            return await WorldCupMatchModel.find({});
        }
        catch (err) {
            console.error("[DB LỖI] getAllWCMatches:", err);
            return [];
        }
    }
    return inMemoryWCMatches;
}
/**
 * Cập nhật thông tin trận đấu World Cup (chỉ được phép khi trận đấu chưa khóa/chưa kết thúc - status === 'open')
 */
async function updateWCMatch(matchId, teamA, teamB, odds) {
    if (useMongoDB) {
        try {
            const match = await WorldCupMatchModel.findOne({ matchId });
            if (!match)
                return false;
            if (match.status !== 'open')
                return false; // Chỉ cho phép sửa khi đang ở trạng thái 'open'
            match.teamA = teamA;
            match.teamB = teamB;
            match.odds = odds;
            await match.save();
            return true;
        }
        catch (err) {
            console.error("[DB LỖI] updateWCMatch:", err);
            return false;
        }
    }
    // RAM DB
    const match = inMemoryWCMatches.find(m => m.matchId === matchId);
    if (!match)
        return false;
    if (match.status !== 'open')
        return false; // Chỉ cho phép sửa khi đang ở trạng thái 'open'
    match.teamA = teamA;
    match.teamB = teamB;
    match.odds = odds;
    return true;
}
/**
 * Xóa trận đấu World Cup và hoàn trả tiền cho những lượt cược chưa được chung (settled: false)
 * Sử dụng Session/Transaction khi sử dụng MongoDB và fallback an toàn nếu DB standalone.
 */
async function deleteWCMatch(matchId) {
    // 1. Kiểm tra trận đấu có tồn tại và trạng thái thế nào
    const match = await getWCMatch(matchId);
    if (!match) {
        return { success: false, refundedBetsCount: 0, message: "❌ Trận đấu này không tồn tại!" };
    }
    if (match.status === 'ended') {
        return { success: false, refundedBetsCount: 0, message: "❌ Trận đấu này đã kết thúc và chia tiền xong, không thể xóa để hoàn tiền được nữa!" };
    }
    let refundedBetsCount = 0;
    if (useMongoDB) {
        const session = await mongoose_1.default.startSession();
        try {
            let success = false;
            await session.withTransaction(async () => {
                // Lấy các cược chưa thanh toán
                const bets = await WorldCupBetModel.find({ matchId, settled: false }).session(session);
                for (const bet of bets) {
                    const user = await UserModel.findOne({ userId: bet.userId }).session(session);
                    if (user) {
                        user.balance = (user.balance || 0) + bet.amount;
                        await user.save({ session });
                    }
                    refundedBetsCount++;
                }
                // Xóa tất cả các cược
                await WorldCupBetModel.deleteMany({ matchId }).session(session);
                // Xóa trận đấu
                const res = await WorldCupMatchModel.deleteOne({ matchId }).session(session);
                success = res.deletedCount > 0;
            });
            return { success, refundedBetsCount };
        }
        catch (err) {
            console.error("[DB LỖI] deleteWCMatch (Transaction Error, rolling back and falling back to sequential):", err);
            // Fallback sang chế độ chạy tuần tự thông thường nếu session transaction không khả dụng (ví dụ MongoDB standalone)
            refundedBetsCount = 0;
        }
        finally {
            session.endSession();
        }
    }
    // Fallback không dùng transaction (hoặc RAM DB)
    let bets = [];
    if (useMongoDB) {
        try {
            bets = await WorldCupBetModel.find({ matchId, settled: false });
            for (const bet of bets) {
                const userBal = await getBalance(bet.userId);
                await updateBalance(bet.userId, userBal + bet.amount);
                refundedBetsCount++;
            }
            await WorldCupBetModel.deleteMany({ matchId });
            const res = await WorldCupMatchModel.deleteOne({ matchId });
            return { success: res.deletedCount > 0, refundedBetsCount };
        }
        catch (err) {
            console.error("[DB LỖI] deleteWCMatch (Fallback):", err);
            return { success: false, refundedBetsCount };
        }
    }
    else {
        // RAM DB
        bets = inMemoryWCBets.filter(b => b.matchId === matchId && !b.settled);
        for (const bet of bets) {
            const userBal = await getBalance(bet.userId);
            await updateBalance(bet.userId, userBal + bet.amount);
            refundedBetsCount++;
        }
        // Xóa các cược khỏi RAM DB
        for (let i = inMemoryWCBets.length - 1; i >= 0; i--) {
            if (inMemoryWCBets[i].matchId === matchId) {
                inMemoryWCBets.splice(i, 1);
            }
        }
        // Xóa trận đấu khỏi RAM DB
        const idx = inMemoryWCMatches.findIndex(m => m.matchId === matchId);
        if (idx !== -1) {
            inMemoryWCMatches.splice(idx, 1);
            return { success: true, refundedBetsCount };
        }
        return { success: false, refundedBetsCount };
    }
}
/**
 * Lấy lịch sử tất cả các cược World Cup của một người dùng
 */
async function getUserWCBets(userId) {
    if (useMongoDB) {
        try {
            const bets = await WorldCupBetModel.find({ userId }).sort({ _id: -1 });
            const result = [];
            for (const bet of bets) {
                const match = await WorldCupMatchModel.findOne({ matchId: bet.matchId });
                result.push({ bet, match });
            }
            return result;
        }
        catch (err) {
            console.error("[DB LỖI] getUserWCBets:", err);
            return [];
        }
    }
    // RAM DB
    const result = [];
    const bets = inMemoryWCBets.filter(b => b.userId === userId).reverse();
    for (const bet of bets) {
        const match = inMemoryWCMatches.find(m => m.matchId === bet.matchId) || null;
        result.push({ bet, match });
    }
    return result;
}
/**
 * Lấy tất cả các cược World Cup chưa được thanh toán (đang mở)
 */
async function getActiveWCBets() {
    if (useMongoDB) {
        try {
            const bets = await WorldCupBetModel.find({ settled: false }).sort({ _id: -1 });
            const result = [];
            for (const bet of bets) {
                const match = await WorldCupMatchModel.findOne({ matchId: bet.matchId });
                result.push({ bet, match });
            }
            return result;
        }
        catch (err) {
            console.error("[DB LỖI] getActiveWCBets:", err);
            return [];
        }
    }
    const result = [];
    const bets = inMemoryWCBets.filter(b => !b.settled).reverse();
    for (const bet of bets) {
        const match = inMemoryWCMatches.find(m => m.matchId === bet.matchId) || null;
        result.push({ bet, match });
    }
    return result;
}
/**
 * Lấy danh sách mã gu của các thành viên trong server (guild)


 * Được tối ưu hóa bằng cách truyền danh sách ID thành viên để lọc ngay tại DB
 */
async function getServerGuData(memberIds) {
    if (useMongoDB) {
        try {
            const users = await UserModel.find({
                userId: { $in: memberIds },
                myGuCode: { $ne: "", $exists: true }
            });
            return users.map(u => ({
                userId: u.userId,
                myGuCode: u.myGuCode || ""
            }));
        }
        catch (err) {
            console.error("[DB LỖI] getServerGuData:", err);
            return [];
        }
    }
    // Fallback RAM
    const res = [];
    for (const uid of memberIds) {
        if (playerMyGuCodeInMemory[uid]) {
            res.push({
                userId: uid,
                myGuCode: playerMyGuCodeInMemory[uid]
            });
        }
    }
    return res;
}
/**
 * Nhận tiền lì xì tân thủ (100k)
 */
async function claimWelcomeGift(userId) {
    const giftAmount = userId === '1525389831113539586' ? 1000000 : 100; // 1 tỷ vs 100k
    if (useMongoDB) {
        try {
            let user = await UserModel.findOne({ userId });
            if (!user) {
                user = await UserModel.create({ userId, balance: 100, lastDaily: 0, streak: 0, hasClaimedWelcome: false });
            }
            const claimed = user.hasClaimedWelcome || false;
            if (claimed) {
                return {
                    success: false,
                    amount: 0,
                    balance: user.balance,
                    message: "Mày nhận tiền rồi con ạ! Tham lam vừa thôi, nút bấm này chỉ dùng được một lần duy nhất thôi nhé! 🙄"
                };
            }
            user.balance += giftAmount;
            user.hasClaimedWelcome = true;
            await user.save();
            return {
                success: true,
                amount: giftAmount,
                balance: user.balance,
                message: `🎉 **NHẬN QUÀ TÂN THỦ THÀNH CÔNG!**\n👉 Bạn nhận được **${(0, utils_1.formatMoney)(giftAmount)}** vào tài khoản. Số dư hiện tại: **${(0, utils_1.formatMoney)(user.balance)}**.`
            };
        }
        catch (err) {
            console.error("Lỗi nhận quà tân thủ MongoDB:", err);
            return { success: false, amount: 0, balance: 0, message: "Lỗi kết nối cơ sở dữ liệu." };
        }
    }
    else {
        if (playerClaimedWelcomeInMemory[userId]) {
            const currentBal = playerBalancesInMemory[userId] !== undefined ? playerBalancesInMemory[userId] : 100;
            return {
                success: false,
                amount: 0,
                balance: currentBal,
                message: "Mày nhận tiền rồi con ạ! Tham lam vừa thôi, nút bấm này chỉ dùng được một lần duy nhất thôi nhé! 🙄"
            };
        }
        const oldBal = playerBalancesInMemory[userId] !== undefined ? playerBalancesInMemory[userId] : 100;
        const newBal = oldBal + giftAmount;
        playerBalancesInMemory[userId] = newBal;
        playerClaimedWelcomeInMemory[userId] = true;
        return {
            success: true,
            amount: giftAmount,
            balance: newBal,
            message: `🎉 **NHẬN QUÀ TÂN THỦ THÀNH CÔNG!**\n👉 Bạn nhận được **${(0, utils_1.formatMoney)(giftAmount)}** vào tài khoản. Số dư hiện tại: **${(0, utils_1.formatMoney)(newBal)}**.`
        };
    }
}
const warmupVideoSchema = new mongoose_1.Schema({
    title: { type: String, required: true },
    description: { type: String, default: "" },
    category: { type: String, default: 'General' },
    messageId: { type: String, default: "" }, // Khong bat buoc neu dung videoUrl
    videoUrl: { type: String, default: "" }, // Luu truc tiep URL YouTube/external
    videoType: { type: String, default: 'discord' }, // 'discord' | 'youtube' | 'external'
    fileName: { type: String, default: "" },
    fileSize: { type: Number, default: 0 },
    addedBy: { type: String, default: "" },
    addedAt: { type: Date, default: Date.now }
});
const WarmupVideoModel = (0, mongoose_1.model)('WarmupVideo', warmupVideoSchema);
const inMemoryWarmupVideos = [];
let localWarmupIdCounter = 1;
async function addWarmupVideo(data) {
    const payload = {
        ...data,
        messageId: data.messageId || "",
        videoUrl: data.videoUrl || "",
        videoType: data.videoType || 'discord'
    };
    if (useMongoDB) {
        try {
            const doc = await WarmupVideoModel.create(payload);
            return {
                id: doc._id.toString(),
                title: doc.title,
                description: doc.description,
                category: doc.category,
                messageId: doc.messageId,
                videoUrl: doc.videoUrl,
                videoType: doc.videoType,
                fileName: doc.fileName,
                fileSize: doc.fileSize,
                addedBy: doc.addedBy,
                addedAt: doc.addedAt
            };
        }
        catch (error) {
            console.error("[DB LỖI] Lỗi thêm video warmup vào MongoDB:", error);
        }
    }
    // In-memory fallback
    const newVideo = {
        id: `local_${localWarmupIdCounter++}`,
        ...payload,
        addedAt: new Date()
    };
    inMemoryWarmupVideos.push(newVideo);
    return newVideo;
}
async function getWarmupVideos() {
    if (useMongoDB) {
        try {
            const docs = await WarmupVideoModel.find().sort({ addedAt: -1 });
            return docs.map(doc => ({
                id: doc._id.toString(),
                title: doc.title,
                description: doc.description,
                category: doc.category,
                messageId: doc.messageId,
                videoUrl: doc.videoUrl,
                videoType: doc.videoType,
                fileName: doc.fileName,
                fileSize: doc.fileSize,
                addedBy: doc.addedBy,
                addedAt: doc.addedAt
            }));
        }
        catch (error) {
            console.error("[DB LỖI] Lỗi lấy danh sách video warmup từ MongoDB:", error);
        }
    }
    return [...inMemoryWarmupVideos];
}
async function deleteWarmupVideo(id) {
    if (useMongoDB) {
        try {
            const res = await WarmupVideoModel.findByIdAndDelete(id);
            return !!res;
        }
        catch (error) {
            console.error("[DB LỖI] Lỗi xóa video warmup khỏi MongoDB:", error);
        }
    }
    const idx = inMemoryWarmupVideos.findIndex(v => v.id === id);
    if (idx !== -1) {
        inMemoryWarmupVideos.splice(idx, 1);
        return true;
    }
    return false;
}
async function updateWarmupVideo(id, data) {
    if (useMongoDB) {
        try {
            const updated = await WarmupVideoModel.findByIdAndUpdate(id, { $set: data }, { new: true });
            if (updated) {
                return {
                    id: updated._id.toString(),
                    title: updated.title,
                    description: updated.description,
                    category: updated.category,
                    messageId: updated.messageId,
                    videoUrl: updated.videoUrl,
                    videoType: updated.videoType,
                    fileName: updated.fileName,
                    fileSize: updated.fileSize,
                    addedBy: updated.addedBy,
                    addedAt: updated.addedAt
                };
            }
        }
        catch (error) {
            console.error("[DB LỖI] Lỗi cập nhật video warmup trong MongoDB:", error);
        }
    }
    const idx = inMemoryWarmupVideos.findIndex(v => v.id === id);
    if (idx !== -1) {
        inMemoryWarmupVideos[idx] = {
            ...inMemoryWarmupVideos[idx],
            ...data
        };
        return inMemoryWarmupVideos[idx];
    }
    return null;
}
