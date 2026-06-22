import mongoose, { Schema, model } from 'mongoose';
import { MONGO_URI } from './config';
import { formatMoney, parseMoneyInput } from './utils';

// Fallback in-memory store in case MONGO_URI is missing or connection fails
const playerBalancesInMemory: { [userId: string]: number } = {};
const playerLastDailyInMemory: { [userId: string]: number } = {};
const playerDebtsInMemory: { [userId: string]: number } = {};
const playerStreaksInMemory: { [userId: string]: number } = {};
const playerValorantIdsInMemory: { [userId: string]: string } = {};
const playerChatBansInMemory: { [userId: string]: number } = {};
const playerLastDodgeDebtInMemory: { [userId: string]: number } = {};
const playerLastSnitchDatesInMemory: { [userId: string]: string } = {};
const playerProfilesInMemory: { [userId: string]: { name: string; gender: string; birthday: string } } = {};
const playerCrushesInMemory: { [userId: string]: string } = {};
const playerCrushChangesTodayInMemory: { [userId: string]: number } = {};
const playerLastCrushChangeDateInMemory: { [userId: string]: string } = {};
const playerFailedMatchesTodayInMemory: { [userId: string]: number } = {};
const playerLastFailedMatchDateInMemory: { [userId: string]: string } = {};
const playerSimpLoUntilInMemory: { [userId: string]: number } = {};
const playerLastQueDateInMemory: { [userId: string]: string } = {};
const playerLastTarotDateInMemory: { [userId: string]: string } = {};
const playerLastTarotTimestampInMemory: { [userId: string]: number } = {};
const playerTarotStreakInMemory: { [userId: string]: number } = {};
let useMongoDB = false;

interface IUser {
    userId: string;
    balance: number;
    lastDaily: number;
    debt: number;
    streak: number;
    valorantId: string;
    chatBanUntil: number;
    lastDodgeDebt: number;
    lastSnitchDate: string;
    name?: string;
    gender?: string;
    birthday?: string;
    crushUserId?: string;
    crushChangesToday?: number;
    lastCrushChangeDate?: string;
    failedMatchesToday?: number;
    lastFailedMatchDate?: string;
    simpLoUntil?: number;
    lastQueDate?: string;
    lastTarotDate?: string;
    lastTarotTimestamp?: number;
    tarotStreak?: number;
}

const userSchema = new Schema<IUser>({
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
    tarotStreak: { type: Number, default: 0 }
});

const UserModel = model<IUser>('User', userSchema);

interface ILotteryTicket {
    userId: string;
    number: string;
    date: string;
}

const lotteryTicketSchema = new Schema<ILotteryTicket>({
    userId: { type: String, required: true },
    number: { type: String, required: true },
    date: { type: String, required: true }
});

const LotteryTicketModel = model<ILotteryTicket>('LotteryTicket', lotteryTicketSchema);

interface ILotteryState {
    date: string;
    jackpotPool: number;
    winningNumbers: string[];
    drawn: boolean;
}

const lotteryStateSchema = new Schema<ILotteryState>({
    date: { type: String, required: true, unique: true },
    jackpotPool: { type: Number, default: 200 },
    winningNumbers: { type: [String], default: [] },
    drawn: { type: Boolean, default: false }
});

const LotteryStateModel = model<ILotteryState>('LotteryState', lotteryStateSchema);

// Fallback RAM DB
let inMemoryJackpotPool = 200; // 200k base
const inMemoryTickets: ILotteryTicket[] = [];
const inMemoryLotteryStates: { [date: string]: { winningNumbers: string[]; drawn: boolean } } = {};

/**
 * Cấm chat người dùng bằng cách lưu thời hạn cấm ở cấp độ Bot (RAM / MongoDB)
 */
export async function banChat(userId: string, durationMs: number): Promise<void> {
    const expires = Date.now() + durationMs;
    if (useMongoDB) {
        try {
            await UserModel.findOneAndUpdate(
                { userId },
                { chatBanUntil: expires },
                { upsert: true, new: true }
            );
            return;
        } catch (error) {
            console.error("[DB LỖI] Lỗi cấm chat trên MongoDB:", error);
        }
    }
    playerChatBansInMemory[userId] = expires;
}

/**
 * Lấy thời gian hết hạn cấm chat của người dùng (0 nếu không bị cấm)
 */
export async function getChatBanExpires(userId: string): Promise<number> {
    if (useMongoDB) {
        try {
            const user = await UserModel.findOne({ userId });
            return user && user.chatBanUntil ? user.chatBanUntil : 0;
        } catch (error) {
            console.error("[DB LỖI] Lỗi lấy thời gian cấm chat từ MongoDB:", error);
        }
    }
    return playerChatBansInMemory[userId] || 0;
}

/**
 * Thực hiện kết nối tới MongoDB
 */
export async function connectDB(): Promise<void> {
    if (!MONGO_URI) {
        console.warn("[DB CẢNH BÁO] Thiếu MONGO_URI trong biến môi trường. Bot sẽ sử dụng bộ nhớ tạm (RAM) làm database!");
        useMongoDB = false;
        return;
    }

    try {
        await mongoose.connect(MONGO_URI, {
            serverSelectionTimeoutMS: 5000 // Thử kết nối tối đa 5 giây, tránh treo bot
        });
        console.log("[DB] Kết nối MongoDB thành công!");
        useMongoDB = true;
    } catch (error) {
        console.error("[DB LỖI] Lỗi kết nối MongoDB:", error);
        console.warn("[DB CẢNH BÁO] Chuyển hướng sử dụng bộ nhớ tạm (RAM) vì không thể kết nối MongoDB!");
        useMongoDB = false;
    }
}

/**
 * Lấy số dư ví tiền của người dùng. Tự động cấp vốn 100k nếu là người chơi mới (chưa có bản ghi).
 * LƯU Ý: KHÔNG tự động reset ví về 100k nếu balance = 0 — người chơi cháy túi phải tự vay tiền.
 */
export async function getBalance(userId: string): Promise<number> {
    if (useMongoDB) {
        try {
            let user = await UserModel.findOne({ userId });
            if (!user) {
                // Người chơi mới lần đầu → cấp vốn ban đầu 100k
                user = await UserModel.findOneAndUpdate(
                    { userId },
                    { $setOnInsert: { balance: 100 } },
                    { new: true, upsert: true }
                );
            }
            return user ? user.balance : 100;
        } catch (error) {
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
export async function updateBalance(userId: string, amount: number): Promise<number> {
    if (useMongoDB) {
        try {
            const user = await UserModel.findOneAndUpdate(
                { userId },
                { balance: amount },
                { new: true, upsert: true }
            );
            return user ? user.balance : amount;
        } catch (error) {
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
function getStreakProgressBar(streak: number): string {
    const maxTrack = 5;
    let track = "";
    for (let i = 1; i <= maxTrack; i++) {
        if (i < streak) {
            track += "🔥 ";
        } else if (i === streak) {
            track += streak >= 5 ? "👑 " : "🟠 ";
        } else {
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
function getVNDate(timestamp: number): Date {
    return new Date(timestamp + 7 * 60 * 60 * 1000);
}

export function getVNDateString(timestamp: number): string {
    const d = getVNDate(timestamp);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function getCalendarDayDifference(t1: number, t2: number): number {
    if (t1 === 0 || t2 === 0) return 999;
    const d1 = getVNDate(t1);
    const d2 = getVNDate(t2);
    
    const date1 = Date.UTC(d1.getUTCFullYear(), d1.getUTCMonth(), d1.getUTCDate());
    const date2 = Date.UTC(d2.getUTCFullYear(), d2.getUTCMonth(), d2.getUTCDate());
    
    return Math.round((date2 - date1) / (24 * 60 * 60 * 1000));
}

function getTimeLeftUntilVNNextDay(now: number): { hours: number, minutes: number } {
    const vnNow = getVNDate(now);
    const vnTomorrow = Date.UTC(vnNow.getUTCFullYear(), vnNow.getUTCMonth(), vnNow.getUTCDate() + 1);
    const timeLeftMs = (vnTomorrow - 7 * 60 * 60 * 1000) - now;
    const hours = Math.floor(timeLeftMs / (60 * 60 * 1000));
    const minutes = Math.floor((timeLeftMs % (60 * 60 * 1000)) / (60 * 1000));
    return { hours, minutes };
}

function getFunnyDailyMessage(streak: number, reward: number, progress: string, isDebtPaid: boolean, garnishment = 0, newBalance = 0, newDebt = 0): string {
    const formatReward = formatMoney(reward);
    const formatGarnishment = formatMoney(garnishment);
    const formatBalance = formatMoney(newBalance);
    const formatDebt = formatMoney(newDebt);

    const checkInTrolls = [
        `Mày đã liên tục báo danh được **${streak} ngày** rồi đó, chăm chỉ cày thuê cuốc mướn thế này tao rất ưng! Nhận ngay cọc tiền cờ bạc nào!`,
        `Báo danh thành công ngày thứ **${streak}**! Tao thí cho mày ít tiền cơm cháo lẻ này con ạ.`,
        `Chuỗi điểm danh **${streak} ngày**! Kỷ lục gia cờ bạc nghèo đói đây rồi, cầm lấy tiền trợ cấp đi!`,
        `Vỗ tay tuyên dương con nghiện chăm chỉ điểm danh **${streak} ngày** liên tiếp! Cầm tiền lẹ đi!`,
        `Báo danh ngày thứ **${streak}** thành công! Mày nhận được tiền trợ cấp xã hội để đi nướng sòng bài.`
    ];
    const baseTroll = checkInTrolls[Math.floor(Math.random() * checkInTrolls.length)];

    if (isDebtPaid) {
        return `🎉 **ĐIỂM DANH THÀNH CÔNG!**\n\n${baseTroll}\n👉 Mày nhận được **${formatReward}**, nhưng vì đang nợ ngân hàng đầm đìa nên tao tự động cấn trừ **${formatGarnishment}** nợ nhé, còn lại **${formatMoney(reward - garnishment)}** bỏ túi cờ bạc tiếp đi con trai!\n\n${progress}\n\n💰 **Ví hiện tại:** **${formatBalance}** | 🏦 **Nợ còn lại:** **${formatDebt}**`;
    } else {
        return `🎉 **ĐIỂM DANH THÀNH CÔNG!**\n\n${baseTroll}\n👉 Cầm lấy **${formatReward}** này đi cúng sòng bạc tiếp đi.\n\n${progress}\n\n💰 **Số dư hiện tại:** **${formatBalance}**`;
    }
}

/**
 * Điểm danh nhận tiền hàng ngày (theo ngày Việt Nam UTC+7, reset lúc 00:00). Có chuỗi đăng nhập liên tiếp nhận thêm bonus.
 */
export async function claimDaily(userId: string): Promise<{ success: boolean; amount: number; balance: number; message: string }> {
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
            } else {
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
        } catch (error) {
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
    } else {
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
export async function dodgeDebt(userId: string): Promise<{ success: boolean; message: string; doubleDebt?: boolean; newDebt: number }> {
    const now = Date.now();
    const todayStr = getVNDateString(now);
    
    let balance = await getBalance(userId);
    let debt = await getDebt(userId);

    // 1. Kiểm tra xem có nợ không
    if (debt <= 0) {
        return {
            success: false,
            message: `❌ **ẢO ĐÁ À CON?** Mày có nợ nần đéo gì tao đâu mà đòi bùng? Ví còn sạch sẽ **${formatMoney(balance)}**, đi cờ bạc nợ nần đi rồi quay lại đây nói chuyện!`,
            newDebt: 0
        };
    }

    // 2. Kiểm tra nếu nợ kịch trần (>= 500k)
    if (debt >= 500) {
        return {
            success: false,
            message: `❌ **CHỦ NỢ CANH GÁC 24/7!** Số nợ của mày đã kịch khung **${formatMoney(debt)}**. Bọn giang hồ và đòi nợ thuê đang túc trực quanh nhà mày gắt gao từng giây, đéo thể trốn bùng nợ nổi lúc này đâu con ạ! Bắt buộc phải tự cày tiền trả tay đi!`,
            newDebt: debt
        };
    }

    // 3. Kiểm tra xem hôm nay đã bùng nợ chưa
    let lastDodge = 0;
    if (useMongoDB) {
        try {
            const user = await UserModel.findOne({ userId });
            lastDodge = user && user.lastDodgeDebt ? user.lastDodgeDebt : 0;
        } catch (err) {}
    } else {
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
        } catch (err) {}
    } else {
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
        } else {
            const percent = 30 + Math.floor(Math.random() * 21); // 30% - 50%
            wipeAmount = Math.floor(debt * (percent / 100));
            debt -= wipeAmount;
        }

        if (useMongoDB) {
            try {
                await UserModel.findOneAndUpdate({ userId }, { debt });
            } catch (err) {}
        } else {
            playerDebtsInMemory[userId] = debt;
        }

        return {
            success: true,
            message: `😱 **ÔI TRỜI ĐẤT ƠI! TRỐN NỢ THÀNH CÔNG!** Mày lủi nhanh như chạch làm tay chân của tao mất dấu, tao đành ngậm ngùi xóa bớt **${formatMoney(wipeAmount)}** nợ cho mày.\n🏦 **Nợ còn lại:** **${formatMoney(debt)}**. Khôn hồn thì nằm im góc tối, đừng để tao bắt được!`,
            newDebt: debt
        };
    } else {
        // Bùng thất bại! Phạt nhân 1.5 lần số nợ
        const penalty = Math.floor(debt * 0.5);
        debt += penalty;

        if (useMongoDB) {
            try {
                await UserModel.findOneAndUpdate({ userId }, { debt });
            } catch (err) {}
        } else {
            playerDebtsInMemory[userId] = debt;
        }

        return {
            success: false,
            message: `🚔 **BẮT ĐƯỢC CON NỢ GIẬT NỢ!** Mày định bùng **${formatMoney(debt - penalty)}** nợ của ngân hàng BotToan à? Con giời quá non! Đàn em giang hồ của tao đã tóm cổ mày lôi cổ về đồn, **phạt x1.5 số nợ** (Nợ mới: **${formatMoney(debt)}**), đồng thời áp giải vào **Nhà Tù** khóa mõm 3 phút cho chừa thói khôn lỏi!`,
            doubleDebt: true,
            newDebt: debt
        };
    }
}

/**
 * Lấy danh sách Top 5 Đại gia và Top 5 Cái bang
 */
export async function getLeaderboard(): Promise<{ rich: { userId: string; balance: number }[]; poor: { userId: string; balance: number }[] }> {
    if (useMongoDB) {
        try {
            const rich = await UserModel.find({}).sort({ balance: -1 }).limit(5);
            const poor = await UserModel.find({}).sort({ balance: 1 }).limit(5);
            return {
                rich: rich.map(u => ({ userId: u.userId, balance: u.balance })),
                poor: poor.map(u => ({ userId: u.userId, balance: u.balance }))
            };
        } catch (error) {
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
export async function transferMoney(
    senderId: string, 
    receiverId: string, 
    amount: number
): Promise<{ success: boolean; message: string; senderBalance: number }> {
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
            if (!sender) sender = await UserModel.create({ userId: senderId, balance: 100 });

            if (sender.balance < amount) {
                return { 
                    success: false, 
                    message: `Số dư không đủ! Mày chỉ còn **${formatMoney(sender.balance)}**, đéo đủ để chuyển **${formatMoney(amount)}**.`, 
                    senderBalance: sender.balance 
                };
            }

            let receiver = await UserModel.findOne({ userId: receiverId });
            if (!receiver) receiver = await UserModel.create({ userId: receiverId, balance: 100 });

            sender.balance -= amount;
            receiver.balance += amount;

            await sender.save();
            await receiver.save();

            return {
                success: true,
                message: `💸 Chuyển tiền thành công! Mày đã gửi **${formatMoney(amount)}** cho <@${receiverId}>.`,
                senderBalance: sender.balance
            };
        } catch (error) {
            console.error("[DB LỖI] Lỗi giao dịch chuyển khoản trên MongoDB:", error);
        }
    }

    // Fallback to In-Memory
    let senderBal = await getBalance(senderId);
    if (senderBal < amount) {
        return { 
            success: false, 
            message: `Số dư không đủ! Mày chỉ còn **${formatMoney(senderBal)}**, đéo đủ để chuyển **${formatMoney(amount)}**.`, 
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
        message: `💸 Chuyển tiền thành công (RAM DB)! Mày đã gửi **${formatMoney(amount)}** cho <@${receiverId}>.`,
        senderBalance: senderBal
    };
}

/**
 * Lấy khoản nợ hiện tại của người chơi
 */
export async function getDebt(userId: string): Promise<number> {
    if (useMongoDB) {
        try {
            const user = await UserModel.findOne({ userId });
            return user && user.debt !== undefined ? user.debt : 0;
        } catch (error) {
            console.error("[DB LỖI] Lỗi lấy tiền nợ từ MongoDB:", error);
        }
    }
    return playerDebtsInMemory[userId] || 0;
}

/**
 * Thực hiện vay tiền ngân hàng (100k)
 */
export async function borrowMoney(userId: string): Promise<{ success: boolean; balance: number; debt: number; message: string }> {
    const currentBalance = await getBalance(userId);
    const debt = await getDebt(userId);

    if (debt >= 500) {
        return {
            success: false,
            balance: currentBalance,
            debt: debt,
            message: `❌ **HẠN MỨC NỢ KỊCH TRẦN!** Mày đang nợ tao kịch khung **${formatMoney(debt)}** rồi con ạ! Trả bớt nợ đi rồi tao mới cho vay tiếp, đéo cho vay khôn thế đâu!`
        };
    }
    
    if (currentBalance >= 10) {
        return {
            success: false,
            balance: currentBalance,
            debt: debt,
            message: `Đĩ thõa, ví mày còn **${formatMoney(currentBalance)}** mà đòi vay? Bao giờ nhẵn túi tao mới cho vay!`
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
                message: `🏦 **NGÂN HÀNG BOTTOAN GIẢI NGÂN:**\nBơm thêm **${formatMoney(borrowAmount)}** vào ví chung. Mày đang nợ tao tổng **${formatMoney(user.debt)}**. Gỡ lẹ đi!`
            };
        } catch (error) {
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
        message: `🏦 **NGÂN HÀNG BOTTOAN GIẢI NGÂN (RAM DB):**\nBơm thêm **${formatMoney(borrowAmount)}** vào ví chung. Mày đang nợ tao tổng **${formatMoney(newDebt)}**. Gỡ lẹ đi!`
    };
}

/**
 * Thực hiện trả nợ ngân hàng tự nguyện
 */
export async function payDebt(userId: string, target?: string): Promise<{ success: boolean; message: string }> {
    let balance = await getBalance(userId);
    let debt = await getDebt(userId);

    if (debt <= 0) {
        return {
            success: false,
            message: `Mày có nợ nần gì tao đâu mà đòi trả? Lo đi cờ bạc tiếp đi con ạ! Ví còn **${formatMoney(balance)}**.`
        };
    }

    let payAmount = 0;
    if (!target || target === 'het' || target === 'all') {
        payAmount = Math.min(balance, debt);
    } else {
        const parsed = parseMoneyInput(target);
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
        } catch (err) {
            console.error("Lỗi cập nhật nợ trên MongoDB:", err);
        }
    } else {
        playerDebtsInMemory[userId] = debt;
    }

    if (debt === 0) {
        return {
            success: true,
            message: `🎉 **TUNG HÔ QUÝ NHÂN UY TÍN!** 🎉\n<@${userId}> đã hoàn thành nghĩa vụ quốc gia, trả sạch toàn bộ nợ nần! Anh em trong server vỗ tay tuyên dương người chơi hệ uy tín này nào! 👏👏👏\n\n💰 **Ví hiện tại:** **${formatMoney(balance)}**`
        };
    } else {
        return {
            success: true,
            message: `🏦 **Trả nợ thành công!** Mày đã trả **${formatMoney(payAmount)}**.\n💰 **Số dư còn lại:** **${formatMoney(balance)}**\n🏦 **Nợ còn lại:** **${formatMoney(debt)}**`
        };
    }
}

/**
 * Lấy số dư và nợ của danh sách người dùng
 */
export async function getBalancesAndDebts(userIds: string[]): Promise<{ userId: string; balance: number; debt: number }[]> {
    if (useMongoDB) {
        try {
            const users = await UserModel.find({ userId: { $in: userIds } });
            const userMap = new Map(users.map(u => [u.userId, u]));
            
            const results = [];
            for (const id of userIds) {
                const u = userMap.get(id);
                if (u) {
                    results.push({ userId: id, balance: u.balance, debt: u.debt || 0 });
                } else {
                    results.push({ userId: id, balance: 100, debt: 0 });
                }
            }
            return results;
        } catch (error) {
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
export async function getAllBalancesAndDebts(): Promise<{ userId: string; balance: number; debt: number }[]> {
    if (useMongoDB) {
        try {
            const users = await UserModel.find({});
            return users.map(u => ({ userId: u.userId, balance: u.balance, debt: u.debt || 0 }));
        } catch (error) {
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
export async function registerValorantId(userId: string, valorantId: string): Promise<void> {
    if (useMongoDB) {
        try {
            await UserModel.findOneAndUpdate(
                { userId },
                { valorantId },
                { upsert: true, new: true }
            );
            return;
        } catch (error) {
            console.error("[DB LỖI] Lỗi đăng ký Riot ID trên MongoDB:", error);
        }
    }
    playerValorantIdsInMemory[userId] = valorantId;
}

/**
 * Lấy Riot ID (Valorant) đã đăng ký của người dùng
 */
export async function getValorantId(userId: string): Promise<string> {
    if (useMongoDB) {
        try {
            const user = await UserModel.findOne({ userId });
            return user && user.valorantId ? user.valorantId : "";
        } catch (error) {
            console.error("[DB LỖI] Lỗi lấy Riot ID từ MongoDB:", error);
        }
    }
    return playerValorantIdsInMemory[userId] || "";
}

/**
 * Mua vé số kiến thiết BotToan (10k/vé, tối đa 5 vé/người/ngày)
 */
export async function buyLotteryTicket(userId: string, num: string): Promise<{ success: boolean; message: string; jackpotPool: number }> {
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
        } catch (err) {}
    } else {
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
            message: `❌ **ĐÉO ĐỦ TIỀN MUA VÉ!** Ví mày còn đúng **${formatMoney(balance)}**, đéo đủ 10k để mua 1 tờ vé số kiến thiết!`,
            jackpotPool: await getCurrentJackpotPool(todayStr)
        };
    }

    // 2. Kiểm tra xem người dùng đã mua bao nhiêu vé hôm nay
    let todayTicketsCount = 0;
    if (useMongoDB) {
        try {
            todayTicketsCount = await LotteryTicketModel.countDocuments({ userId, date: todayStr });
        } catch (err) {}
    } else {
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
        } catch (err) {
            console.error("Lỗi mua vé trên MongoDB:", err);
        }
    } else {
        inMemoryTickets.push({ userId, number: num, date: todayStr });
        inMemoryJackpotPool += ticketCost;
        newJackpot = inMemoryJackpotPool;
    }

    return {
        success: true,
        message: `🎟️ **MUA VÉ SỐ THÀNH CÔNG!** Mày đã mua vé số số **${num}** với giá **10k**. 10k này đã được cúng trực tiếp vào hũ Jackpot!\n💰 **Số dư còn lại:** **${formatMoney(balance)}**`,
        jackpotPool: newJackpot
    };
}

export async function getLotteryInfo(userId: string): Promise<{ jackpotPool: number; myTickets: string[]; lastWinningNum: string; lastDrawDate: string }> {
    const now = Date.now();
    const todayStr = getVNDateString(now);
    const yesterdayStr = getVNDateString(now - 24 * 60 * 60 * 1000);

    let pool = 200;
    let myTickets: string[] = [];
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
        } catch (err) {}
    } else {
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

async function getCurrentJackpotPool(dateStr: string): Promise<number> {
    if (useMongoDB) {
        try {
            const state = await LotteryStateModel.findOne({ date: dateStr });
            return state ? state.jackpotPool : 200;
        } catch (err) {}
    }
    return inMemoryJackpotPool;
}

/**
 * Thực hiện quay thưởng xổ số kiến thiết ngày hôm nay
 */
export async function drawLottery(dateStr: string): Promise<{ success: boolean; winningNumbers?: string[]; winners?: { userId: string; ticketsCount: number }[]; payoutPerTicket?: number; jackpotPool?: number }> {
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
            const winningNumbers: string[] = [];
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
            let winnersList: { userId: string; ticketsCount: number }[] = [];
            let payoutPerTicket = 0;
            let nextJackpotPool = pool;

            if (totalWinningTickets > 0) {
                payoutPerTicket = Math.floor(pool / totalWinningTickets);
                
                const userTicketCounts: { [userId: string]: number } = {};
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
            await LotteryStateModel.findOneAndUpdate(
                { date: tomorrowStr },
                { jackpotPool: nextJackpotPool },
                { upsert: true, new: true }
            );

            return {
                success: true,
                winningNumbers,
                winners: winnersList,
                payoutPerTicket,
                jackpotPool: pool
            };
        } catch (err) {
            console.error("Lỗi quay thưởng xổ số trên MongoDB:", err);
            return { success: false };
        }
    }

    // Fallback to In-Memory
    if (inMemoryLotteryStates[dateStr] && inMemoryLotteryStates[dateStr].drawn) {
        return { success: false };
    }

    const winningNumbers: string[] = [];
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
    let winnersList: { userId: string; ticketsCount: number }[] = [];
    let payoutPerTicket = 0;

    if (totalWinningTickets > 0) {
        payoutPerTicket = Math.floor(pool / totalWinningTickets);

        const userTicketCounts: { [userId: string]: number } = {};
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

export async function getLastLotteryDraw(): Promise<{
    success: boolean;
    date: string;
    winningNumbers: string[];
    jackpotPool: number;
    winners: { userId: string; ticketsCount: number; payout: number }[];
} | null> {
    if (useMongoDB) {
        try {
            const lastState = await LotteryStateModel.findOne({ drawn: true }).sort({ date: -1 });
            if (!lastState) return null;

            // Tìm các vé trúng thưởng vào ngày này
            const matchingTickets = await LotteryTicketModel.find({ date: lastState.date, number: { $in: lastState.winningNumbers } });
            const totalWinningTickets = matchingTickets.length;
            const payoutPerTicket = totalWinningTickets > 0 ? Math.floor(lastState.jackpotPool / totalWinningTickets) : 0;

            const userTicketCounts: { [userId: string]: number } = {};
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
        } catch (err) {
            console.error("Lỗi lấy thông tin kqxs từ MongoDB:", err);
            return null;
        }
    }

    // Fallback to In-Memory
    const drawnDates = Object.keys(inMemoryLotteryStates).filter(d => inMemoryLotteryStates[d].drawn).sort();
    if (drawnDates.length === 0) return null;

    const lastDate = drawnDates[drawnDates.length - 1];
    const winNums = inMemoryLotteryStates[lastDate].winningNumbers;

    const matchingTickets = inMemoryTickets.filter(t => t.date === lastDate && winNums.includes(t.number));
    const totalWinningTickets = matchingTickets.length;
    const payoutPerTicket = totalWinningTickets > 0 ? Math.floor(inMemoryJackpotPool / totalWinningTickets) : 0;

    const userTicketCounts: { [userId: string]: number } = {};
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
export async function getSnitchCooldown(userId: string): Promise<{ canSnitch: boolean; todayStr: string }> {
    const now = Date.now();
    const todayStr = getVNDateString(now);
    
    let lastSnitchDate = "";
    if (useMongoDB) {
        try {
            const user = await UserModel.findOne({ userId });
            lastSnitchDate = user && user.lastSnitchDate ? user.lastSnitchDate : "";
        } catch (err) {
            console.error("[DB LỖI] Lỗi lấy ngày báo án từ MongoDB:", err);
        }
    } else {
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
export async function updateSnitchDate(userId: string, todayStr: string): Promise<void> {
    if (useMongoDB) {
        try {
            await UserModel.findOneAndUpdate(
                { userId },
                { lastSnitchDate: todayStr },
                { upsert: true }
            );
        } catch (err) {
            console.error("[DB LỖI] Lỗi cập nhật ngày báo án trên MongoDB:", err);
        }
    } else {
        playerLastSnitchDatesInMemory[userId] = todayStr;
    }
}

/**
 * Lưu hồ sơ thông tin cá nhân của người dùng
 */
export async function saveProfile(userId: string, name: string, gender: string, birthday: string): Promise<void> {
    if (useMongoDB) {
        try {
            await UserModel.findOneAndUpdate(
                { userId },
                { name, gender, birthday },
                { upsert: true, new: true }
            );
            return;
        } catch (error) {
            console.error("[DB LỖI] Lỗi lưu hồ sơ trên MongoDB:", error);
        }
    }
    playerProfilesInMemory[userId] = { name, gender, birthday };
}

/**
 * Lấy hồ sơ thông tin cá nhân của người dùng
 */
export async function getProfile(userId: string): Promise<{ name: string; gender: string; birthday: string } | null> {
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
        } catch (error) {
            console.error("[DB LỖI] Lỗi lấy hồ sơ từ MongoDB:", error);
        }
    }
    const local = playerProfilesInMemory[userId];
    return local || null;
}

/**
 * Cập nhật thông tin crush của người dùng
 */
export async function updateCrush(userId: string, crushId: string): Promise<string> {
    let oldCrush = "";
    if (useMongoDB) {
        try {
            const user = await UserModel.findOne({ userId });
            oldCrush = user && user.crushUserId ? user.crushUserId : "";
            await UserModel.findOneAndUpdate(
                { userId },
                { crushUserId: crushId },
                { upsert: true, new: true }
            );
        } catch (error) {
            console.error("[DB LỖI] Lỗi cập nhật crush trên MongoDB:", error);
        }
    } else {
        oldCrush = playerCrushesInMemory[userId] || "";
        playerCrushesInMemory[userId] = crushId;
    }
    return oldCrush;
}

/**
 * Lấy thông tin crush hiện tại của người dùng
 */
export async function getCrush(userId: string): Promise<string> {
    if (useMongoDB) {
        try {
            const user = await UserModel.findOne({ userId });
            return user && user.crushUserId ? user.crushUserId : "";
        } catch (error) {
            console.error("[DB LỖI] Lỗi lấy thông tin crush từ MongoDB:", error);
        }
    }
    return playerCrushesInMemory[userId] || "";
}

/**
 * Lấy danh sách ID những người đang thích userId này (Thám tử / Bán đứng)
 */
export async function getWhoCrushedMe(userId: string): Promise<string[]> {
    if (useMongoDB) {
        try {
            const users = await UserModel.find({ crushUserId: userId });
            return users.map(u => u.userId);
        } catch (error) {
            console.error("[DB LỖI] Lỗi lấy danh sách crush từ MongoDB:", error);
        }
    }
    // Fallback to RAM
    return Object.keys(playerCrushesInMemory).filter(k => playerCrushesInMemory[k] === userId);
}

/**
 * Tăng số lần thay đổi crush của người dùng trong ngày và trả về số lần hiện tại
 */
export async function incrementCrushChange(userId: string, todayStr: string): Promise<number> {
    if (useMongoDB) {
        try {
            let user = await UserModel.findOne({ userId });
            if (!user) {
                user = await UserModel.create({ userId });
            }
            if (user.lastCrushChangeDate !== todayStr) {
                user.crushChangesToday = 1;
                user.lastCrushChangeDate = todayStr;
            } else {
                user.crushChangesToday = (user.crushChangesToday || 0) + 1;
            }
            await user.save();
            return user.crushChangesToday || 1;
        } catch (error) {
            console.error("[DB LỖI] Lỗi cập nhật số lần đổi crush trên MongoDB:", error);
        }
    }
    // Fallback to RAM
    if (playerLastCrushChangeDateInMemory[userId] !== todayStr) {
        playerCrushChangesTodayInMemory[userId] = 1;
        playerLastCrushChangeDateInMemory[userId] = todayStr;
    } else {
        playerCrushChangesTodayInMemory[userId] = (playerCrushChangesTodayInMemory[userId] || 0) + 1;
    }
    return playerCrushChangesTodayInMemory[userId];
}

/**
 * Tăng số lần ghép đôi thất bại (< 20%) trong ngày và trả về số lần hiện tại
 */
export async function incrementFailedMatch(userId: string, todayStr: string): Promise<number> {
    if (useMongoDB) {
        try {
            let user = await UserModel.findOne({ userId });
            if (!user) {
                user = await UserModel.create({ userId });
            }
            if (user.lastFailedMatchDate !== todayStr) {
                user.failedMatchesToday = 1;
                user.lastFailedMatchDate = todayStr;
            } else {
                user.failedMatchesToday = (user.failedMatchesToday || 0) + 1;
            }
            await user.save();
            return user.failedMatchesToday || 1;
        } catch (error) {
            console.error("[DB LỖI] Lỗi cập nhật ghép đôi thất bại trên MongoDB:", error);
        }
    }
    // Fallback to RAM
    if (playerLastFailedMatchDateInMemory[userId] !== todayStr) {
        playerFailedMatchesTodayInMemory[userId] = 1;
        playerLastFailedMatchDateInMemory[userId] = todayStr;
    } else {
        playerFailedMatchesTodayInMemory[userId] = (playerFailedMatchesTodayInMemory[userId] || 0) + 1;
    }
    return playerFailedMatchesTodayInMemory[userId];
}

/**
 * Set thời gian chịu phạt Simp Lỏ của người dùng
 */
export async function setSimpLo(userId: string, expires: number): Promise<void> {
    if (useMongoDB) {
        try {
            await UserModel.findOneAndUpdate(
                { userId },
                { simpLoUntil: expires },
                { upsert: true }
            );
            return;
        } catch (error) {
            console.error("[DB LỖI] Lỗi cập nhật trạng thái Simp Lỏ trên MongoDB:", error);
        }
    }
    playerSimpLoUntilInMemory[userId] = expires;
}

/**
 * Lấy thời gian hết hạn chịu phạt Simp Lỏ của người dùng
 */
export async function getSimpLoExpires(userId: string): Promise<number> {
    if (useMongoDB) {
        try {
            const user = await UserModel.findOne({ userId });
            return user && user.simpLoUntil ? user.simpLoUntil : 0;
        } catch (error) {
            console.error("[DB LỖI] Lỗi lấy thời gian hết hạn Simp Lỏ từ MongoDB:", error);
        }
    }
    return playerSimpLoUntilInMemory[userId] || 0;
}

/**
 * Kiểm tra xem người dùng đã gieo quẻ hôm nay chưa
 */
export async function hasGieoQueToday(userId: string, todayStr: string): Promise<boolean> {
    if (useMongoDB) {
        try {
            const user = await UserModel.findOne({ userId });
            return user && user.lastQueDate === todayStr ? true : false;
        } catch (error) {
            console.error("[DB LỖI] Lỗi kiểm tra ngày gieo quẻ từ MongoDB:", error);
        }
    }
    return playerLastQueDateInMemory[userId] === todayStr;
}

/**
 * Đánh dấu người dùng đã gieo quẻ hôm nay (lưu ngày gieo quẻ lập tức)
 */
export async function markGieoQueToday(userId: string, todayStr: string): Promise<void> {
    if (useMongoDB) {
        try {
            await UserModel.findOneAndUpdate(
                { userId },
                { lastQueDate: todayStr },
                { upsert: true, new: true }
            );
            return;
        } catch (error) {
            console.error("[DB LỖI] Lỗi lưu ngày gieo quẻ lên MongoDB:", error);
        }
    }
    playerLastQueDateInMemory[userId] = todayStr;
}

/**
 * Kiểm tra xem người dùng đã bói Tarot hôm nay chưa
 */
export async function hasTarotToday(userId: string, todayStr: string): Promise<boolean> {
    if (useMongoDB) {
        try {
            const user = await UserModel.findOne({ userId });
            return user && user.lastTarotDate === todayStr ? true : false;
        } catch (error) {
            console.error("[DB LỖI] Lỗi kiểm tra ngày Tarot từ MongoDB:", error);
        }
    }
    return playerLastTarotDateInMemory[userId] === todayStr;
}

/**
 * Ghi nhận lượt chơi Tarot hôm nay và cập nhật streak, trả về streak mới
 */
export async function recordTarotPlay(userId: string, todayStr: string, now: number): Promise<number> {
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
                } else if (diffDays === 0) {
                    newStreak = user.tarotStreak || 1;
                } else {
                    newStreak = 1;
                }
            } else {
                newStreak = 1;
            }

            user.lastTarotDate = todayStr;
            user.lastTarotTimestamp = now;
            user.tarotStreak = newStreak;
            await user.save();
            return newStreak;
        } catch (error) {
            console.error("[DB LỖI] Lỗi recordTarotPlay trên MongoDB:", error);
        }
    }

    // Fallback to RAM
    const lastTimestamp = playerLastTarotTimestampInMemory[userId] || 0;
    if (lastTimestamp > 0) {
        const diffDays = getCalendarDayDifference(lastTimestamp, now);
        if (diffDays === 1) {
            newStreak = (playerTarotStreakInMemory[userId] || 0) + 1;
        } else if (diffDays === 0) {
            newStreak = playerTarotStreakInMemory[userId] || 1;
        } else {
            newStreak = 1;
        }
    } else {
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
export async function cancelTarotPlay(userId: string): Promise<void> {
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
        } catch (error) {
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
export async function getLotteryTicketsForDate(dateStr: string): Promise<{ userId: string; number: string }[]> {
    if (useMongoDB) {
        try {
            const tickets = await LotteryTicketModel.find({ date: dateStr });
            return tickets.map(t => ({ userId: t.userId, number: t.number }));
        } catch (err) {
            console.error("Lỗi lấy vé số theo ngày trên MongoDB:", err);
            return [];
        }
    }
    return inMemoryTickets.filter(t => t.date === dateStr).map(t => ({ userId: t.userId, number: t.number }));
}

/**
 * Lấy trạng thái xổ số theo ngày
 */
export async function getLotteryState(dateStr: string): Promise<{ jackpotPool: number; winningNumbers: string[]; drawn: boolean } | null> {
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
        } catch (err) {
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






