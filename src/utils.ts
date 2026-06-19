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
