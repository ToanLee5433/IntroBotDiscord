import mongoose, { Schema, model } from 'mongoose';
import { MONGO_URI } from './config';
import { formatMoney, parseMoneyInput } from './utils';

// Fallback in-memory store in case MONGO_URI is missing or connection fails
const playerBalancesInMemory: { [userId: string]: number } = {};
const playerLastDailyInMemory: { [userId: string]: number } = {};
const playerDebtsInMemory: { [userId: string]: number } = {};
const playerStreaksInMemory: { [userId: string]: number } = {};
let useMongoDB = false;

interface IUser {
    userId: string;
    balance: number;
    lastDaily: number;
    debt: number;
    streak: number;
}

const userSchema = new Schema<IUser>({
    userId: { type: String, required: true, unique: true },
    balance: { type: Number, default: 100 },
    lastDaily: { type: Number, default: 0 },
    debt: { type: Number, default: 0 },
    streak: { type: Number, default: 0 }
});

const UserModel = model<IUser>('User', userSchema);

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
        await mongoose.connect(MONGO_URI);
        console.log("[DB] Kết nối MongoDB thành công!");
        useMongoDB = true;
    } catch (error) {
        console.error("[DB LỖI] Lỗi kết nối MongoDB:", error);
        console.warn("[DB CẢNH BÁO] Chuyển hướng sử dụng bộ nhớ tạm (RAM) vì không thể kết nối MongoDB!");
        useMongoDB = false;
    }
}

/**
 * Lấy số dư ví tiền của người dùng. Tự động cấp vốn 100k nếu chưa chơi hoặc đã cháy túi.
 */
export async function getBalance(userId: string): Promise<number> {
    if (useMongoDB) {
        try {
            let user = await UserModel.findOne({ userId });
            if (!user || user.balance <= 0) {
                user = await UserModel.findOneAndUpdate(
                    { userId },
                    { balance: 100 },
                    { new: true, upsert: true }
                );
            }
            return user ? user.balance : 100;
        } catch (error) {
            console.error("[DB LỖI] Lỗi lấy ví tiền từ MongoDB:", error);
        }
    }

    // Fallback to In-Memory
    if (playerBalancesInMemory[userId] === undefined || playerBalancesInMemory[userId] <= 0) {
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
export async function claimDaily(userId: string): Promise<{ success: boolean; amount: number; balance: number; message: string }> {
    const now = Date.now();
    const cooldown = 24 * 60 * 60 * 1000; // 24 giờ
    const consecutiveLimit = 48 * 60 * 60 * 1000; // 48 giờ để giữ chuỗi

    const baseReward = Math.floor(Math.random() * (50 - 10 + 1)) + 10; // Ngẫu nhiên 10k - 50k

    if (useMongoDB) {
        try {
            let user = await UserModel.findOne({ userId });
            if (!user) {
                user = await UserModel.create({ userId, balance: 100, lastDaily: 0, streak: 0 });
            }

            if (now - user.lastDaily < cooldown) {
                const timeLeft = cooldown - (now - user.lastDaily);
                const hoursLeft = Math.floor(timeLeft / (60 * 60 * 1000));
                const minsLeft = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
                const progress = getStreakProgressBar(user.streak || 0);
                return {
                    success: false,
                    amount: 0,
                    balance: user.balance,
                    message: `Mày tham lam quá! Chờ thêm **${hoursLeft} giờ ${minsLeft} phút** nữa mới được điểm danh tiếp nhé!\n\n${progress}`
                };
            }

            // Tính chuỗi liên tiếp (streak)
            let currentStreak = user.streak || 0;
            if (now - user.lastDaily < consecutiveLimit) {
                currentStreak += 1;
            } else {
                currentStreak = 1; // Quá 48h, reset chuỗi về 1
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
            
            if (garnishment > 0) {
                return {
                    success: true,
                    amount: rewardLeft,
                    balance: user.balance,
                    message: `🎉 **Điểm danh thành công!** Mày nhận được **${formatMoney(baseReward)}** điểm danh, tao cầm trước **${formatMoney(garnishment)}** nợ nhé, còn lại **${formatMoney(rewardLeft)}** cầm mà đi chơi tiếp đi.\n\n${progress}\n\n💰 **Ví hiện tại:** **${formatMoney(user.balance)}** | 🏦 **Nợ còn lại:** **${formatMoney(user.debt)}**`
                };
            } else {
                return {
                    success: true,
                    amount: totalReward,
                    balance: user.balance,
                    message: `🎉 **Điểm danh thành công!** Mày nhận **${formatMoney(baseReward)}** + bonus chuỗi **+${formatMoney(streakBonus)}**.\n\n${progress}\n\n🎁 **Tổng nhận:** **${formatMoney(totalReward)}**\n💰 **Số dư hiện tại:** **${formatMoney(user.balance)}**`
                };
            }
        } catch (error) {
            console.error("[DB LỖI] Lỗi điểm danh trên MongoDB:", error);
        }
    }

    // Fallback to In-Memory
    const lastDaily = playerLastDailyInMemory[userId] || 0;
    if (now - lastDaily < cooldown) {
        const timeLeft = cooldown - (now - lastDaily);
        const hoursLeft = Math.floor(timeLeft / (60 * 60 * 1000));
        const minsLeft = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
        const currentBalance = await getBalance(userId);
        const progress = getStreakProgressBar(playerStreaksInMemory[userId] || 0);
        return {
            success: false,
            amount: 0,
            balance: currentBalance,
            message: `Mày tham lam quá! Chờ thêm **${hoursLeft} giờ ${minsLeft} phút** nữa mới được điểm danh tiếp nhé!\n\n${progress}`
        };
    }

    let currentStreak = playerStreaksInMemory[userId] || 0;
    if (now - lastDaily < consecutiveLimit) {
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
    
    if (garnishment > 0) {
        return {
            success: true,
            amount: rewardLeft,
            balance,
            message: `🎉 **Điểm danh thành công (RAM DB)!** Mày nhận được **${formatMoney(baseReward)}** điểm danh, tao cầm trước **${formatMoney(garnishment)}** nợ nhé, còn lại **${formatMoney(rewardLeft)}** cầm mà đi chơi tiếp đi.\n\n${progress}\n\n💰 **Ví hiện tại:** **${formatMoney(balance)}** | 🏦 **Nợ còn lại:** **${formatMoney(debt)}**`
        };
    } else {
        return {
            success: true,
            amount: totalReward,
            balance,
            message: `🎉 **Điểm danh thành công (RAM DB)!** Mày nhận **${formatMoney(baseReward)}** + bonus chuỗi **+${formatMoney(streakBonus)}**.\n\n${progress}\n\n🎁 **Tổng nhận:** **${formatMoney(totalReward)}**\n💰 **Số dư hiện tại:** **${formatMoney(balance)}**`
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
        if (playerBalancesInMemory[id] === undefined) {
            playerBalancesInMemory[id] = 100;
        }
        return {
            userId: id,
            balance: playerBalancesInMemory[id],
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
