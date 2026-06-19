/**
 * Chờ một khoảng thời gian được chỉ định (milliseconds)
 */
export const sleep = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Loại bỏ dấu tiếng Việt khỏi chuỗi văn bản
 */
export const removeAccents = (str: string): string => {
    return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D");
};

/**
 * Sinh số nguyên ngẫu nhiên trong khoảng [min, max]
 */
export const trueRandom = (min: number, max: number): number => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * Định dạng số tiền sang dạng dễ đọc tiếng Việt (k -> triệu -> tỷ)
 * 1 đơn vị balance = 1k
 */
export const formatMoney = (amount: number): string => {
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
    if (ty > 0) result.push(`${ty} tỷ`);
    if (trieu > 0) result.push(`${trieu} triệu`);
    if (k > 0) result.push(`${k}k`);

    const formatted = result.join(' ');
    return isNegative ? `-${formatted}` : formatted;
};

/**
 * Phân tích cú pháp số tiền nhập từ chat (hỗ trợ các hậu tố k, tr, trieu, ty, tỷ)
 */
export const parseMoneyInput = (input: string): number | null => {
    // Chuẩn hóa xóa khoảng trắng
    const normalized = removeAccents(input).toLowerCase().replace(/\s+/g, '');
    const match = normalized.match(/(\d+(?:\.\d+)?)(k|tr|trieu|ty|b)?/);
    if (!match) return null;

    const value = parseFloat(match[1]);
    const unit = match[2];

    if (!unit || unit === 'k') {
        return Math.floor(value);
    }
    if (unit === 'tr' || unit === 'trieu') {
        return Math.floor(value * 1000);
    }
    if (unit === 'ty' || unit === 'b') {
        return Math.floor(value * 1000000);
    }
    return Math.floor(value);
};
