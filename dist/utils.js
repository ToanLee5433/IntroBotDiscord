"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activeGamePlayers = exports.parseMoneyInput = exports.formatMoney = exports.trueRandom = exports.removeAccents = exports.sleep = void 0;
exports.sendToJail = sendToJail;
/**
 * Chờ một khoảng thời gian được chỉ định (milliseconds)
 */
const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};
exports.sleep = sleep;
/**
 * Loại bỏ dấu tiếng Việt khỏi chuỗi văn bản
 */
const removeAccents = (str) => {
    return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D");
};
exports.removeAccents = removeAccents;
/**
 * Sinh số nguyên ngẫu nhiên trong khoảng [min, max]
 */
const trueRandom = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};
exports.trueRandom = trueRandom;
/**
 * Định dạng số tiền sang dạng dễ đọc tiếng Việt (k -> triệu -> tỷ)
 * 1 đơn vị balance = 1k
 */
const formatMoney = (amount) => {
    const isNegative = amount < 0;
    const absAmount = Math.abs(amount);
    if (absAmount < 1000) {
        const result = `${absAmount}k`;
        return isNegative ? `-${result}` : result;
    }
    const ty = Math.floor(absAmount / 1000000);
    const trieu = Math.floor((absAmount % 1000000) / 1000);
    const k = absAmount % 1000;
    let result = [];
    if (ty > 0)
        result.push(`${ty} tỷ`);
    if (trieu > 0)
        result.push(`${trieu} triệu`);
    if (k > 0)
        result.push(`${k}k`);
    const formatted = result.join(' ');
    return isNegative ? `-${formatted}` : formatted;
};
exports.formatMoney = formatMoney;
/**
 * Phân tích cú pháp số tiền nhập từ chat (hỗ trợ các hậu tố k, tr, trieu, ty, tỷ)
 */
const parseMoneyInput = (input) => {
    // Chuẩn hóa xóa khoảng trắng
    let normalized = (0, exports.removeAccents)(input).toLowerCase().replace(/\s+/g, '');
    // Tìm đơn vị ở cuối (hỗ trợ thêm m cho triệu)
    const unitMatch = normalized.match(/(k|tr|trieu|ty|b|m)$/);
    const unit = unitMatch ? unitMatch[1] : undefined;
    // Lấy phần số trước đơn vị
    let numberPart = unit ? normalized.slice(0, -unit.length) : normalized;
    // Đếm số lượng dấu chấm và phẩy
    const dotCount = (numberPart.match(/\./g) || []).length;
    const commaCount = (numberPart.match(/,/g) || []).length;
    let isAbsoluteVND = false;
    if (dotCount > 1 || commaCount > 1) {
        // Có nhiều dấu ngăn cách (ví dụ: 3.000.000 hoặc 3,000,000) -> xóa hết để lấy số nguyên
        numberPart = numberPart.replace(/[\.,]/g, '');
        isAbsoluteVND = true;
    }
    else if (dotCount === 1 || commaCount === 1) {
        // Chỉ có 1 dấu ngăn cách
        const separator = dotCount === 1 ? '.' : ',';
        const parts = numberPart.split(separator);
        const decimalLength = parts[1]?.length || 0;
        if (decimalLength === 3) {
            // Nếu có đúng 3 chữ số sau dấu ngăn cách (ví dụ: 3.000 hoặc 50.000) -> treat là dấu phân cách hàng nghìn
            numberPart = numberPart.replace(/[\.,]/g, '');
            isAbsoluteVND = true;
        }
        else {
            // Ngược lại (ví dụ: 3.5 hoặc 10.5) -> là dấu phân cách thập phân
            numberPart = numberPart.replace(',', '.'); // Chuẩn hóa sang dấu chấm cho parseFloat
        }
    }
    const value = parseFloat(numberPart);
    if (isNaN(value))
        return null;
    // Nếu có đơn vị cụ thể
    if (unit === 'k') {
        return Math.floor(value);
    }
    if (unit === 'tr' || unit === 'trieu' || unit === 'm') {
        return Math.floor(value * 1000);
    }
    if (unit === 'ty' || unit === 'b') {
        return Math.floor(value * 1000000);
    }
    // Nếu không có đơn vị, tự động đoán:
    // Nếu đã xác định dùng phân cách hàng nghìn (isAbsoluteVND) hoặc số gốc nhập vào >= 10000 (ví dụ 50000, 3000000)
    // thì đó là số tiền VND tuyệt đối, quy về đơn vị k (chia 1000)
    if (isAbsoluteVND || value >= 10000) {
        return Math.floor(value / 1000);
    }
    return Math.floor(value);
};
exports.parseMoneyInput = parseMoneyInput;
/**
 * Danh sách ID người dùng đang tham gia các trò chơi hoạt động
 */
exports.activeGamePlayers = new Set();
/**
 * Di chuyển một người dùng vào kênh voice Nhà Tù một cách an toàn và tin cậy nhất
 */
async function sendToJail(guild, userId, reason) {
    try {
        let member = guild.members.cache.get(userId);
        if (!member) {
            member = await guild.members.fetch(userId).catch(() => undefined) || undefined;
        }
        if (member && member.voice.channelId) {
            const prisonChannelId = "1517590846927667230";
            await member.voice.setChannel(prisonChannelId, reason);
            return true;
        }
    }
    catch (err) {
        console.error(`[JAIL ERROR] Lỗi khi đưa người chơi ${userId} vào tù:`, err);
    }
    return false;
}
