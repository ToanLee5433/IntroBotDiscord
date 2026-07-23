"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.translateShengXiao = translateShengXiao;
exports.translateGanChi = translateGanChi;
exports.translateNaYin = translateNaYin;
exports.isValidDate = isValidDate;
exports.getWesternZodiacInfo = getWesternZodiacInfo;
exports.getLunarCompatibility = getLunarCompatibility;
exports.getGangTitle = getGangTitle;
exports.generateProfileCardCanvas = generateProfileCardCanvas;
exports.setupProfileInteractions = setupProfileInteractions;
exports.getCungPhi = getCungPhi;
exports.getBatTrachRelation = getBatTrachRelation;
exports.getFengShuiScore = getFengShuiScore;
exports.handleProfileRegistration = handleProfileRegistration;
exports.handleCrushCommand = handleCrushCommand;
exports.playMatchmaking = playMatchmaking;
exports.handleDetectiveServices = handleDetectiveServices;
exports.handleBuaYeu = handleBuaYeu;
exports.handleGieoQue = handleGieoQue;
const discord_js_1 = require("discord.js");
const canvas_1 = require("@napi-rs/canvas");
const lunar_javascript_1 = require("lunar-javascript");
const database_1 = require("../database");
const utils_1 = require("../utils");
const gemini_1 = require("../services/gemini");
// ================= DỊCH NGHĨA PHONG THỦY =================
function translateShengXiao(shengXiao) {
    const map = {
        '鼠': 'Tý (Chuột)', '牛': 'Sửu (Trâu)', '虎': 'Dần (Hổ)', '兔': 'Mão (Mèo)',
        '龙': 'Thìn (Rồng)', '蛇': 'Tỵ (Rắn)', '马': 'Ngọ (Ngựa)', '羊': 'Mùi (Dê)',
        '猴': 'Thân (Khỉ)', '鸡': 'Dậu (Gà)', '狗': 'Tuất (Chó)', '猪': 'Hợi (Heo)'
    };
    return map[shengXiao] || shengXiao;
}
function translateGanChi(ganChi) {
    const stems = {
        '甲': 'Giáp', '乙': 'Ất', '丙': 'Bính', '丁': 'Đinh', '戊': 'Mậu',
        '己': 'Kỷ', '庚': 'Canh', '辛': 'Tân', '壬': 'Nhâm', '癸': 'Quý'
    };
    const branches = {
        '子': 'Tý', '丑': 'Sửu', '寅': 'Dần', '卯': 'Mão', '辰': 'Thìn',
        '巳': 'Tỵ', '午': 'Ngọ', '未': 'Mùi', '申': 'Thân', '酉': 'Dậu',
        '戌': 'Tuất', '亥': 'Hợi'
    };
    const stemChar = ganChi.charAt(0);
    const branchChar = ganChi.charAt(1);
    return (stems[stemChar] || stemChar) + " " + (branches[branchChar] || branchChar);
}
function translateNaYin(naYin) {
    const map = {
        '海中金': 'Hải Trung Kim (Vàng dưới biển)',
        '炉中火': 'Lư Trung Hỏa (Lửa trong lò)',
        '大林木': 'Đại Lâm Mộc (Gỗ rừng già)',
        '路旁土': 'Lộ Bàng Thổ (Đất ven đường)',
        '剑锋金': 'Kiếm Phong Kim (Vàng mũi kiếm)',
        '山头火': 'Sơn Đầu Hỏa (Lửa đỉnh núi)',
        '涧下水': 'Giản Hạ Thủy (Nước suối nhỏ)',
        '城头土': 'Thành Đầu Thổ (Đất trên thành)',
        '白蜡金': 'Bạch Lạp Kim (Vàng trong sáp)',
        '杨柳木': 'Dương Liễu Mộc (Gỗ cây liễu)',
        '泉中水': 'Tuyền Trung Thủy (Nước trong suối)',
        '屋上土': 'Ốc Thượng Thổ (Đất trên mái ngói)',
        '霹雳火': 'Tích Lịch Hỏa (Lửa sấm sét)',
        '松柏木': 'Tùng Bách Mộc (Gỗ cây tùng bách)',
        '长流水': 'Trường Lưu Thủy (Nước chảy dài)',
        '沙中金': 'Sa Trung Kim (Vàng trong cát)',
        '山下火': 'Sơn Hạ Hỏa (Lửa dưới chân núi)',
        '平地木': 'Bình Địa Mộc (Cây đồng bằng)',
        '壁上土': 'Bích Thượng Thổ (Đất trên tường)',
        '金箔金': 'Kim Bạc Kim (Vàng lá)',
        '覆灯火': 'Phúc Đăng Hỏa (Lửa đèn dầu)',
        '天河水': 'Thiên Hà Thủy (Nước sông trời)',
        '大驿土': 'Đại Trạch Thổ (Đất đầm lầy)',
        '钗钏金': 'Thoa Xuyến Kim (Vàng trang sức)',
        '桑柘木': 'Tang Đố Mộc (Gỗ cây dâu tằm)',
        '大溪水': 'Đại Khê Thủy (Nước khe lớn)',
        '沙中土': 'Sa Trung Thổ (Đất cát)',
        '天上火': 'Thiên Thượng Hỏa (Lửa trên trời)',
        '石榴木': 'Thạch Lựu Mộc (Gỗ cây thạch lựu)',
        '大海水': 'Đại Hải Thủy (Nước biển lớn)'
    };
    for (const [zh, vi] of Object.entries(map)) {
        if (naYin.includes(zh))
            return vi;
    }
    return naYin;
}
// ================= DATE VALIDATION =================
function isValidDate(day, month, year) {
    const currentYear = new Date().getFullYear();
    if (year < 1920 || year > currentYear)
        return false;
    if (month < 1 || month > 12)
        return false;
    const daysInMonth = new Date(year, month, 0).getDate();
    if (day < 1 || day > daysInMonth)
        return false;
    // Không cho phép ngày sinh trong tương lai
    const birthDate = new Date(year, month - 1, day);
    if (birthDate.getTime() > Date.now())
        return false;
    return true;
}
// ================= CUNG HOÀNG ĐẠO & PHONG THỦY NÂNG CẤP =================
function getWesternZodiacInfo(day, month) {
    if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) {
        return { name: "Bạch Dương", nameEn: "Aries", symbol: "♈", compatible: "Sư Tử ♌, Nhân Mã ♐" };
    }
    if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) {
        return { name: "Kim Ngưu", nameEn: "Taurus", symbol: "♉", compatible: "Xử Nữ ♍, Ma Kết ♑" };
    }
    if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) {
        return { name: "Song Tử", nameEn: "Gemini", symbol: "♊", compatible: "Thiên Bình ♎, Bảo Bình ♒" };
    }
    if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) {
        return { name: "Cự Giải", nameEn: "Cancer", symbol: "♋", compatible: "Bọ Cạp ♏, Song Ngư ♓" };
    }
    if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) {
        return { name: "Sư Tử", nameEn: "Leo", symbol: "♌", compatible: "Bạch Dương ♈, Nhân Mã ♐" };
    }
    if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) {
        return { name: "Xử Nữ", nameEn: "Virgo", symbol: "♍", compatible: "Kim Ngưu ♉, Ma Kết ♑" };
    }
    if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) {
        return { name: "Thiên Bình", nameEn: "Libra", symbol: "♎", compatible: "Song Tử ♊, Bảo Bình ♒" };
    }
    if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) {
        return { name: "Bọ Cạp", nameEn: "Scorpio", symbol: "♏", compatible: "Cự Giải ♋, Song Ngư ♓" };
    }
    if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) {
        return { name: "Nhân Mã", nameEn: "Sagittarius", symbol: "♐", compatible: "Bạch Dương ♈, Sư Tử ♌" };
    }
    if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) {
        return { name: "Ma Kết", nameEn: "Capricorn", symbol: "♑", compatible: "Kim Ngưu ♉, Xử Nữ ♍" };
    }
    if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) {
        return { name: "Bảo Bình", nameEn: "Aquarius", symbol: "♒", compatible: "Song Tử ♊, Thiên Bình ♎" };
    }
    return { name: "Song Ngư", nameEn: "Pisces", symbol: "♓", compatible: "Cự Giải ♋, Bọ Cạp ♏" };
}
function getLunarCompatibility(shengXiao) {
    const map = {
        '鼠': { animal: 'Tý', emoji: '🐭', tamHop: 'Thân 🐒, Thìn 🐲', lucHop: 'Sửu 🐮', xungChinhDien: 'Ngọ 🐴 (Xung chính diện - Né gấp!)', xungNhom: 'Mão 🐱, Dậu 🐓 (Xung nhóm)' },
        'Tý': { animal: 'Tý', emoji: '🐭', tamHop: 'Thân 🐒, Thìn 🐲', lucHop: 'Sửu 🐮', xungChinhDien: 'Ngọ 🐴 (Xung chính diện - Né gấp!)', xungNhom: 'Mão 🐱, Dậu 🐓 (Xung nhóm)' },
        '牛': { animal: 'Sửu', emoji: '🐮', tamHop: 'Tỵ 🐍, Dậu 🐓', lucHop: 'Tý 🐭', xungChinhDien: 'Mùi 🐐 (Xung chính diện - Né gấp!)', xungNhom: 'Thìn 🐲, Tuất 🐶 (Xung nhóm)' },
        'Sửu': { animal: 'Sửu', emoji: '🐮', tamHop: 'Tỵ 🐍, Dậu 🐓', lucHop: 'Tý 🐭', xungChinhDien: 'Mùi 🐐 (Xung chính diện - Né gấp!)', xungNhom: 'Thìn 🐲, Tuất 🐶 (Xung nhóm)' },
        '虎': { animal: 'Dần', emoji: '🐯', tamHop: 'Ngọ 🐴, Tuất 🐶', lucHop: 'Hợi 🐷', xungChinhDien: 'Thân 🐒 (Xung chính diện - Né gấp!)', xungNhom: 'Tỵ 🐍, Hợi 🐷 (Xung nhóm)' },
        'Dần': { animal: 'Dần', emoji: '🐯', tamHop: 'Ngọ 🐴, Tuất 🐶', lucHop: 'Hợi 🐷', xungChinhDien: 'Thân 🐒 (Xung chính diện - Né gấp!)', xungNhom: 'Tỵ 🐍, Hợi 🐷 (Xung nhóm)' },
        '兔': { animal: 'Mão', emoji: '🐱', tamHop: 'Hợi 🐷, Mùi 🐐', lucHop: 'Tuất 🐶', xungChinhDien: 'Dậu 🐓 (Xung chính diện - Né gấp!)', xungNhom: 'Tý 🐭, Ngọ 🐴 (Xung nhóm)' },
        'Mão': { animal: 'Mão', emoji: '🐱', tamHop: 'Hợi 🐷, Mùi 🐐', lucHop: 'Tuất 🐶', xungChinhDien: 'Dậu 🐓 (Xung chính diện - Né gấp!)', xungNhom: 'Tý 🐭, Ngọ 🐴 (Xung nhóm)' },
        '龙': { animal: 'Thìn', emoji: '🐲', tamHop: 'Thân 🐒, Tý 🐭', lucHop: 'Dậu 🐓', xungChinhDien: 'Tuất 🐶 (Xung chính diện - Né gấp!)', xungNhom: 'Sửu 🐮, Mùi 🐐 (Xung nhóm)' },
        'Thìn': { animal: 'Thìn', emoji: '🐲', tamHop: 'Thân 🐒, Tý 🐭', lucHop: 'Dậu 🐓', xungChinhDien: 'Tuất 🐶 (Xung chính diện - Né gấp!)', xungNhom: 'Sửu 🐮, Mùi 🐐 (Xung nhóm)' },
        '蛇': { animal: 'Tỵ', emoji: '🐍', tamHop: 'Dậu 🐓, Sửu 🐮', lucHop: 'Thân 🐒', xungChinhDien: 'Hợi 🐷 (Xung chính diện - Né gấp!)', xungNhom: 'Dần 🐯, Thân 🐒 (Xung nhóm)' },
        'Tỵ': { animal: 'Tỵ', emoji: '🐍', tamHop: 'Dậu 🐓, Sửu 🐮', lucHop: 'Thân 🐒', xungChinhDien: 'Hợi 🐷 (Xung chính diện - Né gấp!)', xungNhom: 'Dần 🐯, Thân 🐒 (Xung nhóm)' },
        '午': { animal: 'Ngọ', emoji: '🐴', tamHop: 'Dần 🐯, Tuất 🐶', lucHop: 'Mùi 🐐', xungChinhDien: 'Tý 🐭 (Xung chính diện - Né gấp!)', xungNhom: 'Mão 🐱, Dậu 🐓 (Xung nhóm)' },
        'Ngọ': { animal: 'Ngọ', emoji: '🐴', tamHop: 'Dần 🐯, Tuất 🐶', lucHop: 'Mùi 🐐', xungChinhDien: 'Tý 🐭 (Xung chính diện - Né gấp!)', xungNhom: 'Mão 🐱, Dậu 🐓 (Xung nhóm)' },
        '羊': { animal: 'Mùi', emoji: '🐐', tamHop: 'Mão 🐱, Hợi 🐷', lucHop: 'Ngọ 🐴', xungChinhDien: 'Sửu 🐮 (Xung chính diện - Né gấp!)', xungNhom: 'Thìn 🐲, Tuất 🐶 (Xung nhóm)' },
        'Mùi': { animal: 'Mùi', emoji: '🐐', tamHop: 'Mão 🐱, Hợi 🐷', lucHop: 'Ngọ 🐴', xungChinhDien: 'Sửu 🐮 (Xung chính diện - Né gấp!)', xungNhom: 'Thìn 🐲, Tuất 🐶 (Xung nhóm)' },
        '申': { animal: 'Thân', emoji: '🐒', tamHop: 'Tý 🐭, Thìn 🐲', lucHop: 'Tỵ 🐍', xungChinhDien: 'Dần 🐯 (Xung chính diện - Né gấp!)', xungNhom: 'Tỵ 🐍, Hợi 🐷 (Xung nhóm)' },
        'Thân': { animal: 'Thân', emoji: '🐒', tamHop: 'Tý 🐭, Thìn 🐲', lucHop: 'Tỵ 🐍', xungChinhDien: 'Dần 🐯 (Xung chính diện - Né gấp!)', xungNhom: 'Tỵ 🐍, Hợi 🐷 (Xung nhóm)' },
        '酉': { animal: 'Dậu', emoji: '🐓', tamHop: 'Tỵ 🐍, Sửu 🐮', lucHop: 'Thìn 🐲', xungChinhDien: 'Mão 🐱 (Xung chính diện - Né gấp!)', xungNhom: 'Tý 🐭, Ngọ 🐴 (Xung nhóm)' },
        'Dậu': { animal: 'Dậu', emoji: '🐓', tamHop: 'Tỵ 🐍, Sửu 🐮', lucHop: 'Thìn 🐲', xungChinhDien: 'Mão 🐱 (Xung chính diện - Né gấp!)', xungNhom: 'Tý 🐭, Ngọ 🐴 (Xung nhóm)' },
        '戌': { animal: 'Tuất', emoji: '🐶', tamHop: 'Dần 🐯, Ngọ 🐴', lucHop: 'Mão 🐱', xungChinhDien: 'Thìn 🐲 (Xung chính diện - Né gấp!)', xungNhom: 'Sửu 🐮, Mùi 🐐 (Xung nhóm)' },
        'Tuất': { animal: 'Tuất', emoji: '🐶', tamHop: 'Dần 🐯, Ngọ 🐴', lucHop: 'Mão 🐱', xungChinhDien: 'Thìn 🐲 (Xung chính diện - Né gấp!)', xungNhom: 'Sửu 🐮, Mùi 🐐 (Xung nhóm)' },
        '猪': { animal: 'Hợi', emoji: '🐷', tamHop: 'Mão 🐱, Mùi 🐐', lucHop: 'Dần 🐯', xungChinhDien: 'Tỵ 🐍 (Xung chính diện - Né gấp!)', xungNhom: 'Dần 🐯, Thân 🐒 (Xung nhóm)' },
        'Hợi': { animal: 'Hợi', emoji: '🐷', tamHop: 'Mão 🐱, Mùi 🐐', lucHop: 'Dần 🐯', xungChinhDien: 'Tỵ 🐍 (Xung chính diện - Né gấp!)', xungNhom: 'Dần 🐯, Thân 🐒 (Xung nhóm)' }
    };
    return map[shengXiao] || { animal: shengXiao, emoji: '✨', tamHop: 'N/A', lucHop: 'N/A', xungChinhDien: 'N/A', xungNhom: 'N/A' };
}
function getGangTitle(balance, debt, isPrincess = false) {
    if (isPrincess)
        return '👑 CÔNG CHÚA GIANG HỒ';
    if (debt >= 100000)
        return '💸 CON NỢ QUỐC DÂN';
    if (balance >= 500000)
        return '🏦 ĐẠI GIA SERVER';
    if (balance >= 200000)
        return '💎 TRÙM SÒNG BÀI';
    if (balance < 10000)
        return '🍚 CÁI BANG TỰ NỢ';
    return '⚔️ DÂN CHƠI GIANG HỒ';
}
// ================= CANVAS PROFILE CARD GENERATOR =================
async function generateProfileCardCanvas(targetUser, profile, balance, debt, targetMember, isPrincess = false) {
    const width = 850;
    const height = 480;
    const canvas = (0, canvas_1.createCanvas)(width, height);
    const ctx = canvas.getContext('2d');
    // 1. Background Gradient (Dark Mode Hologram Card)
    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    bgGradient.addColorStop(0, '#0F172A');
    bgGradient.addColorStop(0.5, '#1E293B');
    bgGradient.addColorStop(1, '#0F172A');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);
    // Accent Grid Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }
    for (let y = 0; y < height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }
    // Outer Gold & Inner Neon Borders
    ctx.strokeStyle = '#D4AF37'; // Gold
    ctx.lineWidth = 4;
    ctx.strokeRect(15, 15, width - 30, height - 30);
    ctx.strokeStyle = '#00A8FF'; // Inner Neon Cyan
    ctx.lineWidth = 1.5;
    ctx.strokeRect(20, 20, width - 40, height - 40);
    // Header Title
    ctx.fillStyle = '#D4AF37';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('📋 CỘNG HÒA XÃ HỘI GIANG HỒ BOTTOAN 📋', width / 2, 52);
    ctx.fillStyle = '#00A8FF';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('THẺ CĂN CƯỚC GIANG HỒ / GIẤY TẠM TRÚ TẠM VẮNG', width / 2, 80);
    // Separator line
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, 95);
    ctx.lineTo(width - 40, 95);
    ctx.stroke();
    // Avatar Drawing
    const avatarUrl = targetMember
        ? targetMember.displayAvatarURL({ extension: 'png', size: 256 })
        : targetUser.displayAvatarURL({ extension: 'png', size: 256 });
    const avatarX = 50;
    const avatarY = 125;
    const avatarSize = 160;
    try {
        const avatarImage = await (0, canvas_1.loadImage)(avatarUrl);
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatarImage, avatarX, avatarY, avatarSize, avatarSize);
        ctx.restore();
        // Glowing Avatar Ring
        ctx.strokeStyle = '#00A8FF';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 2, 0, Math.PI * 2);
        ctx.stroke();
    }
    catch (e) {
        console.error("Lỗi vẽ avatar canvas:", e);
    }
    // Gangster Title Badge under avatar
    const gangTitle = getGangTitle(balance, debt, isPrincess);
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(gangTitle, avatarX + avatarSize / 2, avatarY + avatarSize + 30);
    // Parse Birthday & Astrology
    const parts = profile.birthday.replace(/\-/g, '/').split('/');
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    let zodiacText = "";
    let lunarText = "";
    let menhText = "";
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        const wZodiac = getWesternZodiacInfo(day, month);
        zodiacText = `${wZodiac.name} (${wZodiac.nameEn} ${wZodiac.symbol})`;
        try {
            const solar = lunar_javascript_1.Solar.fromYmd(year, month, day);
            const lunar = solar.getLunar();
            const ganChi = translateGanChi(lunar.getYearInGanZhi());
            const shengXiao = lunar.getYearShengXiao();
            const lComp = getLunarCompatibility(shengXiao);
            lunarText = `${ganChi} (${lComp.animal} ${lComp.emoji})`;
            const naYinRaw = lunar.getYearNaYin ? lunar.getYearNaYin() : "";
            if (naYinRaw)
                menhText = translateNaYin(naYinRaw);
        }
        catch (e) { }
    }
    const age = new Date().getFullYear() - year;
    // Profile Details Grid
    const textX = 240;
    let startY = 135;
    const lineSpacing = 28;
    ctx.textAlign = 'left';
    const fields = [
        { label: "👤 Họ và tên:", val: profile.name },
        { label: "🆔 ID Giang hồ:", val: targetUser.id },
        { label: "🚻 Giới tính:", val: profile.gender },
        { label: "🎂 Ngày sinh:", val: `${profile.birthday} (${age} tuổi)` },
        { label: "♍ Cung Hoàng Đạo:", val: zodiacText },
        { label: "🌙 Tuổi Âm Lịch:", val: lunarText },
        { label: "☯️ Mệnh Ngũ Hành:", val: menhText || "N/A" },
        { label: "💰 Tài chính:", val: `Ví: ${(0, utils_1.formatMoney)(balance)}đ | Nợ: ${(0, utils_1.formatMoney)(debt)}đ` }
    ];
    fields.forEach(f => {
        ctx.fillStyle = '#94A3B8';
        ctx.font = 'bold 15px sans-serif';
        ctx.fillText(f.label, textX, startY);
        ctx.fillStyle = '#F8FAFC';
        ctx.font = 'bold 15px sans-serif';
        ctx.fillText(f.val, textX + 150, startY);
        startY += lineSpacing;
    });
    // 4. Red Verification Stamp
    ctx.save();
    ctx.translate(width - 120, height - 85);
    ctx.rotate(-15 * Math.PI / 180);
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 45, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#EF4444';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BOTTOAN VERIFIED', 0, -10);
    ctx.fillText('★ ĐÃ KHAI BÁO ★', 0, 5);
    ctx.fillText('THẦY TOÀN KÝ', 0, 20);
    ctx.restore();
    return canvas.toBuffer('image/png');
}
// ================= COOLDOWN & INTERACTION LISTENER CHO BUTTONS =================
const profileCooldowns = new Map();
function setupProfileInteractions(client) {
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton())
            return;
        const customId = interaction.customId;
        if (!customId.startsWith('profile_'))
            return;
        const userId = interaction.user.id;
        const now = Date.now();
        const lastUsed = profileCooldowns.get(userId) || 0;
        if (now - lastUsed < 10000) {
            const secondsLeft = Math.ceil((10000 - (now - lastUsed)) / 1000);
            await interaction.reply({
                content: `⏱️ **Chờ chút ba!** Đừng spam nút bấm, thử lại sau **${secondsLeft}s** nhé!`,
                flags: discord_js_1.MessageFlags.Ephemeral
            }).catch(() => { });
            return;
        }
        profileCooldowns.set(userId, now);
        const parts = customId.split('_');
        const action = parts[1];
        const targetUserId = parts[2] || userId;
        const targetUser = await interaction.client.users.fetch(targetUserId).catch(() => interaction.user);
        const profile = await (0, database_1.getProfile)(targetUserId);
        if (!profile || !profile.name || !profile.gender || !profile.birthday) {
            await interaction.reply({
                content: `❌ **<@${targetUserId}> chưa khai báo lý lịch với BotToan!**`,
                flags: discord_js_1.MessageFlags.Ephemeral
            }).catch(() => { });
            return;
        }
        const balance = await (0, database_1.getBalance)(targetUserId);
        const debt = await (0, database_1.getDebt)(targetUserId);
        const targetMember = interaction.guild ? await interaction.guild.members.fetch(targetUserId).catch(() => null) : null;
        const isPrincess = targetMember ? targetMember.roles.cache.has("1528640097325547580") : false;
        if (action === 'card') {
            await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
            try {
                const cardBuffer = await generateProfileCardCanvas(targetUser, profile, balance, debt, targetMember, isPrincess);
                const attachment = new discord_js_1.AttachmentBuilder(cardBuffer, { name: `TheGiangHo_${targetUserId}.png` });
                await interaction.editReply({
                    content: `🖼️ **Thẻ Căn Cước Giang Hồ của <@${targetUserId}> đây!** *(Nhấp vào ảnh để xem full & tải về)*`,
                    files: [attachment]
                });
            }
            catch (err) {
                console.error("Lỗi tạo thẻ canvas profile:", err);
                await interaction.editReply({ content: "❌ **Gặp lỗi khi tạo ảnh Thẻ Căn Cước Giang Hồ!**" });
            }
        }
        else if (action === 'tarot') {
            const dateStr = (0, database_1.getVNDateString)(now);
            const hasQue = await (0, database_1.hasGieoQueToday)(userId, dateStr);
            if (hasQue) {
                await interaction.reply({
                    content: `🔮 **Hôm nay bạn đã gieo quẻ rồi!** Hãy quay lại vào ngày mai để nhận quẻ mới nhé.`,
                    flags: discord_js_1.MessageFlags.Ephemeral
                }).catch(() => { });
            }
            else {
                await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
                await handleGieoQue(interaction);
            }
        }
        else if (action === 'match') {
            await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
            try {
                let matchedMember = null;
                if (interaction.guild) {
                    const members = await interaction.guild.members.fetch().catch(() => interaction.guild.members.cache);
                    const candidates = members.filter((m) => !m.user.bot && m.id !== userId);
                    // Ưu tiên chọn người khác giới tính nếu có profile
                    const myGender = profile?.gender;
                    if (myGender) {
                        const oppositeGenderCandidates = [];
                        for (const [, member] of candidates) {
                            const p = await (0, database_1.getProfile)(member.id);
                            if (p && p.gender && p.gender !== myGender) {
                                oppositeGenderCandidates.push(member);
                            }
                        }
                        if (oppositeGenderCandidates.length > 0) {
                            matchedMember = oppositeGenderCandidates[Math.floor(Math.random() * oppositeGenderCandidates.length)];
                        }
                    }
                    if (!matchedMember && candidates.size > 0) {
                        matchedMember = candidates.random();
                    }
                }
                if (matchedMember) {
                    const targetProfile = await (0, database_1.getProfile)(matchedMember.id);
                    let compatibilityScore = Math.floor(Math.random() * 30) + 70; // 70% - 99%
                    let targetInfo = `<@${matchedMember.id}> (${matchedMember.displayName})`;
                    let extraText = "";
                    if (targetProfile && targetProfile.birthday) {
                        const parts = targetProfile.birthday.replace(/\-/g, '/').split('/');
                        const day = parseInt(parts[0], 10);
                        const month = parseInt(parts[1], 10);
                        if (!isNaN(day) && !isNaN(month)) {
                            const zInfo = getWesternZodiacInfo(day, month);
                            extraText = `\n- ♍ **Cung:** \`${zInfo.name} (${zInfo.symbol})\``;
                        }
                    }
                    await interaction.editReply({
                        content: `💖 **KẾT QUẢ GHÉP ĐÔI NHANH TRONG SERVER** 💖\n\n` +
                            `👩‍❤️‍👨 **Đối tượng ghép cặp:** ${targetInfo}\n` +
                            `📊 **Tỉ lệ hợp cạ:** \`${compatibilityScore}%\` ${extraText}\n\n` +
                            `🔮 *Lời khuyên phong thủy:* Hãy chủ động gõ \`@BotToan ghep doi <@${matchedMember.id}>\` để xem luận giải tử vi chi tiết của hai đứa nhé!`
                    });
                }
                else {
                    const fortune = await (0, gemini_1.getMatchmakingFortune)(interaction.user.username);
                    await interaction.editReply({
                        content: `💖 **Dự đoán Tình Duyên Nhanh cho ${interaction.user.username}:**\n${fortune}`
                    });
                }
            }
            catch (err) {
                console.error("Lỗi ghép đôi nhanh button:", err);
                await interaction.editReply({ content: "❌ **Gặp lỗi khi quét ghép đôi trong server!**" });
            }
        }
        else if (action === 'wallet') {
            await interaction.reply({
                content: `🏦 **Tài chính Ngân hàng của <@${targetUserId}>:**\n- 💵 **Ví tiền:** \`${(0, utils_1.formatMoney)(balance)}\`đ\n- 💸 **Nợ ngân hàng:** \`${(0, utils_1.formatMoney)(debt)}\`đ`,
                flags: discord_js_1.MessageFlags.Ephemeral
            }).catch(() => { });
        }
    });
}
function getCungPhi(birthdayStr, gender) {
    const parts = birthdayStr.replace(/\-/g, '/').split('/');
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    const solar = lunar_javascript_1.Solar.fromYmd(year, month, day);
    const lunar = solar.getLunar();
    const lunarYear = lunar.getYear();
    let sum = 0;
    let temp = lunarYear;
    while (temp > 0) {
        sum += temp % 10;
        temp = Math.floor(temp / 10);
    }
    let remainder = sum % 9;
    if (remainder === 0)
        remainder = 9;
    let quaiNum = 0;
    if (gender === 'Nam') {
        quaiNum = 11 - remainder;
        if (quaiNum === 10)
            quaiNum = 1;
        if (quaiNum === 5)
            quaiNum = 2; // Nam 5 quy về Khôn (2)
    }
    else {
        quaiNum = 4 + remainder;
        while (quaiNum > 9) {
            quaiNum = Math.floor(quaiNum / 10) + (quaiNum % 10);
        }
        if (quaiNum === 5)
            quaiNum = 8; // Nữ 5 quy về Cấn (8)
    }
    const cungNames = {
        1: 'Khảm',
        2: 'Khôn',
        3: 'Chấn',
        4: 'Tốn',
        6: 'Càn',
        7: 'Đoài',
        8: 'Cấn',
        9: 'Ly'
    };
    const eastGroup = [1, 3, 4, 9];
    const group = eastGroup.includes(quaiNum) ? 'Đông Tứ Mệnh' : 'Tây Tứ Mệnh';
    return {
        name: cungNames[quaiNum] || 'Khuyết',
        number: quaiNum,
        group
    };
}
function getBatTrachRelation(cungA, cungB) {
    const matrix = {
        'Càn': {
            'Càn': { relation: 'Phục Vị', isGood: true, scoreDelta: 10, desc: 'Bình yên, hòa thuận, ít sóng gió, được trời phù hộ' },
            'Khảm': { relation: 'Lục Sát', isGood: false, scoreDelta: -15, desc: 'Gia đạo bất hòa, thị phi đeo bám, dễ thất thoát tiền bạc' },
            'Cấn': { relation: 'Thiên Y', isGood: true, scoreDelta: 15, desc: 'Sức khỏe dồi dào, bệnh tật tiêu tan, có quý nhân phò trợ' },
            'Chấn': { relation: 'Ngũ Quỷ', isGood: false, scoreDelta: -20, desc: 'Dễ gặp hỏa hoạn, mất trộm, tai tiếng, tiểu nhân quấy phá' },
            'Tốn': { relation: 'Họa Hại', isGood: false, scoreDelta: -10, desc: 'Khó khăn chồng chất, làm ăn lận đận, mệt mỏi tinh thần' },
            'Ly': { relation: 'Tuyệt Mệnh', isGood: false, scoreDelta: -25, desc: 'Tuyệt tự tuyệt tôn, tai ương ập xuống, sức khỏe nguy kịch' },
            'Khôn': { relation: 'Diên Niên', isGood: true, scoreDelta: 20, desc: 'Gia đình hạnh phúc, con cái hiếu thảo, tình duyên bền chặt' },
            'Đoài': { relation: 'Sinh Khí', isGood: true, scoreDelta: 25, desc: 'Tài lộc dồi dào, thăng tiến nhanh chóng, đại cát đại lợi' }
        },
        'Khảm': {
            'Càn': { relation: 'Lục Sát', isGood: false, scoreDelta: -15, desc: 'Gia đạo bất hòa, thị phi đeo bám, dễ thất thoát tiền bạc' },
            'Khảm': { relation: 'Phục Vị', isGood: true, scoreDelta: 10, desc: 'Bình yên, hòa thuận, ít sóng gió, được trời phù hộ' },
            'Cấn': { relation: 'Ngũ Quỷ', isGood: false, scoreDelta: -20, desc: 'Dễ gặp hỏa hoạn, mất trộm, tai tiếng, tiểu nhân quấy phá' },
            'Chấn': { relation: 'Thiên Y', isGood: true, scoreDelta: 15, desc: 'Sức khỏe dồi dào, bệnh tật tiêu tan, có quý nhân phò trợ' },
            'Tốn': { relation: 'Sinh Khí', isGood: true, scoreDelta: 25, desc: 'Tài lộc dồi dào, thăng tiến nhanh chóng, đại cát đại lợi' },
            'Ly': { relation: 'Diên Niên', isGood: true, scoreDelta: 20, desc: 'Gia đình hạnh phúc, con cái hiếu thảo, tình duyên bền chặt' },
            'Khôn': { relation: 'Tuyệt Mệnh', isGood: false, scoreDelta: -25, desc: 'Tuyệt tự tuyệt tôn, tai ương ập xuống, sức khỏe nguy kịch' },
            'Đoài': { relation: 'Họa Hại', isGood: false, scoreDelta: -10, desc: 'Khó khăn chồng chất, làm ăn lận đận, mệt mỏi tinh thần' }
        },
        'Cấn': {
            'Càn': { relation: 'Thiên Y', isGood: true, scoreDelta: 15, desc: 'Sức khỏe dồi dào, bệnh tật tiêu tan, có quý nhân phò trợ' },
            'Khảm': { relation: 'Ngũ Quỷ', isGood: false, scoreDelta: -20, desc: 'Dễ gặp hỏa hoạn, mất trộm, tai tiếng, tiểu nhân quấy phá' },
            'Cấn': { relation: 'Phục Vị', isGood: true, scoreDelta: 10, desc: 'Bình yên, hòa thuận, ít sóng gió, được trời phù hộ' },
            'Chấn': { relation: 'Lục Sát', isGood: false, scoreDelta: -15, desc: 'Gia đạo bất hòa, thị phi đeo bám, dễ thất thoát tiền bạc' },
            'Tốn': { relation: 'Tuyệt Mệnh', isGood: false, scoreDelta: -25, desc: 'Tuyệt tự tuyệt tôn, tai ương ập xuống, sức khỏe nguy kịch' },
            'Ly': { relation: 'Họa Hại', isGood: false, scoreDelta: -10, desc: 'Khó khăn chồng chất, làm ăn lận đận, mệt mỏi tinh thần' },
            'Khôn': { relation: 'Sinh Khí', isGood: true, scoreDelta: 25, desc: 'Tài lộc dồi dào, thăng tiến nhanh chóng, đại cát đại lợi' },
            'Đoài': { relation: 'Diên Niên', isGood: true, scoreDelta: 20, desc: 'Gia đình hạnh phúc, con cái hiếu thảo, tình duyên bền chặt' }
        },
        'Chấn': {
            'Càn': { relation: 'Ngũ Quỷ', isGood: false, scoreDelta: -20, desc: 'Dễ gặp hỏa hoạn, mất trộm, tai tiếng, tiểu nhân quấy phá' },
            'Khảm': { relation: 'Thiên Y', isGood: true, scoreDelta: 15, desc: 'Sức khỏe dồi dào, bệnh tật tiêu tan, có quý nhân phò trợ' },
            'Cấn': { relation: 'Lục Sát', isGood: false, scoreDelta: -15, desc: 'Gia đạo bất hòa, thị phi đeo bám, dễ thất thoát tiền bạc' },
            'Chấn': { relation: 'Phục Vị', isGood: true, scoreDelta: 10, desc: 'Bình yên, hòa thuận, ít sóng gió, được trời phù hộ' },
            'Tốn': { relation: 'Diên Niên', isGood: true, scoreDelta: 20, desc: 'Gia đình hạnh phúc, con cái hiếu thảo, tình duyên bền chặt' },
            'Ly': { relation: 'Sinh Khí', isGood: true, scoreDelta: 25, desc: 'Tài lộc dồi dào, thăng tiến nhanh chóng, đại cát đại lợi' },
            'Khôn': { relation: 'Họa Hại', isGood: false, scoreDelta: -10, desc: 'Khó khăn chồng chất, làm ăn lận đận, mệt mỏi tinh thần' },
            'Đoài': { relation: 'Tuyệt Mệnh', isGood: false, scoreDelta: -25, desc: 'Tuyệt tự tuyệt tôn, tai ương ập xuống, sức khỏe nguy kịch' }
        },
        'Tốn': {
            'Càn': { relation: 'Họa Hại', isGood: false, scoreDelta: -10, desc: 'Khó khăn chồng chất, làm ăn lận đận, mệt mỏi tinh thần' },
            'Khảm': { relation: 'Sinh Khí', isGood: true, scoreDelta: 25, desc: 'Tài lộc dồi dào, thăng tiến nhanh chóng, đại cát đại lợi' },
            'Cấn': { relation: 'Tuyệt Mệnh', isGood: false, scoreDelta: -25, desc: 'Tuyệt tự tuyệt tôn, tai ương ập xuống, sức khỏe nguy kịch' },
            'Chấn': { relation: 'Diên Niên', isGood: true, scoreDelta: 20, desc: 'Gia đình hạnh phúc, con cái hiếu thảo, tình duyên bền chặt' },
            'Tốn': { relation: 'Phục Vị', isGood: true, scoreDelta: 10, desc: 'Bình yên, hòa thuận, ít sóng gió, được trời phù hộ' },
            'Ly': { relation: 'Thiên Y', isGood: true, scoreDelta: 15, desc: 'Sức khỏe dồi dào, bệnh tật tiêu tan, có quý nhân phò trợ' },
            'Khôn': { relation: 'Ngũ Quỷ', isGood: false, scoreDelta: -20, desc: 'Dễ gặp hỏa hoạn, mất trộm, tai tiếng, tiểu nhân quấy phá' },
            'Đoài': { relation: 'Lục Sát', isGood: false, scoreDelta: -15, desc: 'Gia đạo bất hòa, thị phi đeo bám, dễ thất thoát tiền bạc' }
        },
        'Ly': {
            'Càn': { relation: 'Tuyệt Mệnh', isGood: false, scoreDelta: -25, desc: 'Tuyệt tự tuyệt tôn, tai ương ập xuống, sức khỏe nguy kịch' },
            'Khảm': { relation: 'Diên Niên', isGood: true, scoreDelta: 20, desc: 'Gia đình hạnh phúc, con cái hiếu thảo, tình duyên bền chặt' },
            'Cấn': { relation: 'Họa Hại', isGood: false, scoreDelta: -10, desc: 'Khó khăn chồng chất, làm ăn lận đận, mệt mỏi tinh thần' },
            'Chấn': { relation: 'Sinh Khí', isGood: true, scoreDelta: 25, desc: 'Tài lộc dồi dào, thăng tiến nhanh chóng, đại cát đại lợi' },
            'Tốn': { relation: 'Thiên Y', isGood: true, scoreDelta: 15, desc: 'Sức khỏe dồi dào, bệnh tật tiêu tan, có quý nhân phò trợ' },
            'Ly': { relation: 'Phục Vị', isGood: true, scoreDelta: 10, desc: 'Bình yên, hòa thuận, ít sóng gió, được trời phù hộ' },
            'Khôn': { relation: 'Lục Sát', isGood: false, scoreDelta: -15, desc: 'Gia đạo bất hòa, thị phi đeo bám, dễ thất thoát tiền bạc' },
            'Đoài': { relation: 'Ngũ Quỷ', isGood: false, scoreDelta: -20, desc: 'Dễ gặp hỏa hoạn, mất trộm, tai tiếng, tiểu nhân quấy phá' }
        },
        'Khôn': {
            'Càn': { relation: 'Diên Niên', isGood: true, scoreDelta: 20, desc: 'Gia đình hạnh phúc, con cái hiếu thảo, tình duyên bền chặt' },
            'Khảm': { relation: 'Tuyệt Mệnh', isGood: false, scoreDelta: -25, desc: 'Tuyệt tự tuyệt tôn, tai ương ập xuống, sức khỏe nguy kịch' },
            'Cấn': { relation: 'Sinh Khí', isGood: true, scoreDelta: 25, desc: 'Tài lộc dồi dào, thăng tiến nhanh chóng, đại cát đại lợi' },
            'Chấn': { relation: 'Họa Hại', isGood: false, scoreDelta: -10, desc: 'Khó khăn chồng chất, làm ăn lận đận, mệt mỏi tinh thần' },
            'Tốn': { relation: 'Ngũ Quỷ', isGood: false, scoreDelta: -20, desc: 'Dễ gặp hỏa hoạn, mất trộm, tai tiếng, tiểu nhân quấy phá' },
            'Ly': { relation: 'Lục Sát', isGood: false, scoreDelta: -15, desc: 'Gia đạo bất hòa, thị phi đeo bám, dễ thất thoát tiền bạc' },
            'Khôn': { relation: 'Phục Vị', isGood: true, scoreDelta: 10, desc: 'Bình yên, hòa thuận, ít sóng gió, được trời phù hộ' },
            'Đoài': { relation: 'Thiên Y', isGood: true, scoreDelta: 15, desc: 'Sức khỏe dồi dào, bệnh tật tiêu tan, có quý nhân phò trợ' }
        },
        'Đoài': {
            'Càn': { relation: 'Sinh Khí', isGood: true, scoreDelta: 25, desc: 'Tài lộc dồi dào, thăng tiến nhanh chóng, đại cát đại lợi' },
            'Khảm': { relation: 'Họa Hại', isGood: false, scoreDelta: -10, desc: 'Khó khăn chồng chất, làm ăn lận đận, mệt mỏi tinh thần' },
            'Cấn': { relation: 'Diên Niên', isGood: true, scoreDelta: 20, desc: 'Gia đình hạnh phúc, con cái hiếu thảo, tình duyên bền chặt' },
            'Chấn': { relation: 'Tuyệt Mệnh', isGood: false, scoreDelta: -25, desc: 'Tuyệt tự tuyệt tôn, tai ương ập xuống, sức khỏe nguy kịch' },
            'Tốn': { relation: 'Lục Sát', isGood: false, scoreDelta: -15, desc: 'Gia đạo bất hòa, thị phi đeo bám, dễ thất thoát tiền bạc' },
            'Ly': { relation: 'Ngũ Quỷ', isGood: false, scoreDelta: -20, desc: 'Dễ gặp hỏa hoạn, mất trộm, tai tiếng, tiểu nhân quấy phá' },
            'Khôn': { relation: 'Thiên Y', isGood: true, scoreDelta: 15, desc: 'Sức khỏe dồi dào, bệnh tật tiêu tan, có quý nhân phò trợ' },
            'Đoài': { relation: 'Phục Vị', isGood: true, scoreDelta: 10, desc: 'Bình yên, hòa thuận, ít sóng gió, được trời phù hộ' }
        }
    };
    return matrix[cungA]?.[cungB] || { relation: 'Không rõ', isGood: false, scoreDelta: 0, desc: 'Chưa có thông tin phối ngẫu.' };
}
// ================= THUẬT TOÁN TÍNH ĐIỂM PHONG THỦY =================
function getFengShuiScore(zodiacA, zodiacB, menhA, menhB, cungA, cungB) {
    let score = 50;
    // 1. Tam Hợp (+25)
    const tamHop = [
        ['Tý', 'Thìn', 'Thân'],
        ['Sửu', 'Tỵ', 'Dậu'],
        ['Dần', 'Ngọ', 'Tuất'],
        ['Mão', 'Mùi', 'Hợi']
    ];
    for (const group of tamHop) {
        if (group.includes(zodiacA) && group.includes(zodiacB)) {
            score += 25;
            break;
        }
    }
    // 2. Lục Hợp (+15)
    const lucHop = [
        ['Tý', 'Sửu'], ['Dần', 'Hợi'], ['Mão', 'Tuất'],
        ['Thìn', 'Dậu'], ['Tỵ', 'Thân'], ['Ngọ', 'Mùi']
    ];
    for (const pair of lucHop) {
        if ((pair[0] === zodiacA && pair[1] === zodiacB) || (pair[0] === zodiacB && pair[1] === zodiacA)) {
            score += 15;
            break;
        }
    }
    // 3. Tứ Hành Xung (-25)
    const tuHanhXung = [
        ['Tý', 'Ngọ'], ['Mão', 'Dậu'], ['Dần', 'Thân'],
        ['Tỵ', 'Hợi'], ['Thìn', 'Tuất'], ['Sửu', 'Mùi']
    ];
    for (const pair of tuHanhXung) {
        if ((pair[0] === zodiacA && pair[1] === zodiacB) || (pair[0] === zodiacB && pair[1] === zodiacA)) {
            score -= 25;
            break;
        }
    }
    // 4. Ngũ Hành Tương Sinh/Tương Khắc
    const getElement = (menh) => {
        if (menh.includes('Kim'))
            return 'Kim';
        if (menh.includes('Mộc'))
            return 'Mộc';
        if (menh.includes('Thủy'))
            return 'Thủy';
        if (menh.includes('Hỏa'))
            return 'Hỏa';
        if (menh.includes('Thổ'))
            return 'Thổ';
        return '';
    };
    const elA = getElement(menhA);
    const elB = getElement(menhB);
    if (elA && elB) {
        if (elA === elB) {
            score += 5; // Cùng mệnh
        }
        else {
            const sinh = [
                ['Kim', 'Thủy'], ['Thủy', 'Mộc'], ['Mộc', 'Hỏa'],
                ['Hỏa', 'Thổ'], ['Thổ', 'Kim']
            ];
            let isSinh = false;
            for (const pair of sinh) {
                if ((pair[0] === elA && pair[1] === elB) || (pair[0] === elB && pair[1] === elA)) {
                    score += 20;
                    isSinh = true;
                    break;
                }
            }
            if (!isSinh) {
                const khac = [
                    ['Kim', 'Mộc'], ['Mộc', 'Thổ'], ['Thổ', 'Thủy'],
                    ['Thủy', 'Hỏa'], ['Hỏa', 'Kim']
                ];
                for (const pair of khac) {
                    if ((pair[0] === elA && pair[1] === elB) || (pair[0] === elB && pair[1] === elA)) {
                        score -= 20;
                        break;
                    }
                }
            }
        }
    }
    // 5. Cung Phi Bát Trạch
    const bt = getBatTrachRelation(cungA, cungB);
    score += bt.scoreDelta;
    // Biến số ngẫu nhiên [-10%, 10%]
    score += (0, utils_1.trueRandom)(-10, 10);
    return Math.max(0, Math.min(100, score));
}
// Giao diện thanh tiến trình emoji tình yêu
function getLoveBar(percent) {
    const totalSlots = 10;
    // Xử lý điểm âm (kịch bản đặc biệt giang hồ)
    if (percent < 0) {
        return { bar: "☠️".repeat(totalSlots), status: "Khắc nhau cực độ, tương phùng là thảm họa 💀" };
    }
    if (percent < 20) {
        const heartCount = Math.max(1, Math.round(percent / 10));
        const poopCount = totalSlots - heartCount;
        const bar = "💔".repeat(heartCount) + "💩".repeat(poopCount);
        return { bar, status: "Tình yêu thối như mắm tôm 🤮" };
    }
    else if (percent >= 20 && percent < 50) {
        const moneyCount = Math.round(percent / 10);
        const heartCount = totalSlots - moneyCount;
        const bar = "💸".repeat(moneyCount) + "💔".repeat(heartCount);
        return { bar, status: "Tình yêu xây trên sự thực dụng 💸" };
    }
    else if (percent >= 50 && percent < 80) {
        const beerCount = Math.round(percent / 10);
        const smokeCount = totalSlots - beerCount;
        const bar = "🍻".repeat(beerCount) + "🚬".repeat(smokeCount);
        return { bar, status: "Tình yêu kiểu bạn nhậu, hợp nhau lúc trên bàn cờ bạc 🍻🚬" };
    }
    else {
        const policeCount = Math.round(percent / 10);
        const heartCount = totalSlots - policeCount;
        const bar = "🚔".repeat(policeCount) + "❤️".repeat(heartCount);
        return { bar, status: "Xe công an đang đến đón 2 đứa đi tuần trăng mật trong tù 🚔" };
    }
}
// ================= XỬ LÝ LỆNH ĐĂNG KÝ HỒ SƠ =================
async function handleProfileRegistration(message, rawInput) {
    // 1. Loại bỏ tag bot và các dấu câu dư thừa ở đầu
    const botId = message.client.user?.id;
    let input = rawInput;
    if (botId) {
        input = input.replace(new RegExp(`<@!?${botId}>`, 'g'), '');
    }
    input = input.replace(/^[:,\-\/!\?\s]+/, '').trim();
    // Loại bỏ tiền tố từ khóa profile/hồ sơ/thông tin ở đầu chuỗi
    const prefixRegex = /^\s*(?:profile|thong\s*tin\s*ca\s*nhan|thong\s*tin|ttcn|ho\s*so|ly\s*lich|dang\s*ky\s*ho\s*so|dang\s*ky\s*profile|dang\s*ky|cap\s*nhat\s*ho\s*so|cap\s*nhat\s*thong\s*tin|cap\s*nhat|khai\s*bao\s*ho\s*so|khai\s*bao\s*profile|khai\s*bao|tao\s*ho\s*so|tao\s*profile|xem\s*profile|xem\s*ho\s*so|xem\s*ttcn|xem\s*thong\s*tin|my\s*profile|profile\s*me|thông\s*tin\s*cá\s*nhân|thông\s*tin|hồ\s*sơ|lý\s*lịch|đăng\s*ký\s*hồ\s*sơ|đăng\s*ký\s*profile|đăng\s*ký|cập\s*nhật\s*hồ\s*sơ|cập\s*nhật\s*thông\s*tin|cập\s*nhật|khai\s*báo\s*hồ\s*sơ|khai\s*báo\s*profile|khai\s*báo|tạo\s*hồ\s*sơ|tạo\s*profile|xem\s*hồ\s*sơ)\s*/i;
    const remainingText = input.replace(prefixRegex, '').trim();
    // 2. TÌM KIẾM NGÀY SINH (Định dạng DD/MM/YYYY hoặc DD-MM-YYYY)
    const dobRegex = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/;
    const dobMatch = remainingText.match(dobRegex);
    // TRƯỜNG HỢP A: Không có ngày sinh -> XEM PROFILE
    if (!dobMatch) {
        let targetUser = message.author;
        // Kiểm tra xem có đề cập người khác không
        const mentionedUser = message.mentions.users.filter(u => u.id !== message.client.user?.id).first();
        if (mentionedUser) {
            targetUser = mentionedUser;
        }
        else {
            const idMatch = remainingText.match(/\d{17,21}/);
            if (idMatch) {
                const fetched = await message.client.users.fetch(idMatch[0]).catch(() => null);
                if (fetched)
                    targetUser = fetched;
            }
        }
        const profile = await (0, database_1.getProfile)(targetUser.id);
        const isSelf = targetUser.id === message.author.id;
        const isWantImage = remainingText.includes('--image') || remainingText.toLowerCase().includes('card') || remainingText.toLowerCase().includes('the giang ho');
        if (profile && profile.name && profile.gender && profile.birthday) {
            const balance = await (0, database_1.getBalance)(targetUser.id);
            const debt = await (0, database_1.getDebt)(targetUser.id);
            let targetMember = message.guild ? message.guild.members.cache.get(targetUser.id) : null;
            if (!targetMember && message.guild) {
                targetMember = await message.guild.members.fetch(targetUser.id).catch(() => null);
            }
            const isPrincess = targetMember ? targetMember.roles.cache.has("1528640097325547580") : false;
            // Nếu người dùng yêu cầu dạng Ảnh (Visual Card)
            if (isWantImage) {
                const cardBuffer = await generateProfileCardCanvas(targetUser, profile, balance, debt, targetMember, isPrincess);
                const attachment = new discord_js_1.AttachmentBuilder(cardBuffer, { name: `TheGiangHo_${targetUser.id}.png` });
                await message.reply({
                    content: `🖼️ **Thẻ Căn Cước Giang Hồ / Giấy Tạm Trú của <@${targetUser.id}> đây!**`,
                    files: [attachment]
                }).catch(() => { });
                return;
            }
            const parts = profile.birthday.replace(/\-/g, '/').split('/');
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            const year = parseInt(parts[2], 10);
            let extraAstrologyInfo = "";
            if (!isNaN(day) && !isNaN(month) && !isNaN(year) && isValidDate(day, month, year)) {
                try {
                    const solar = lunar_javascript_1.Solar.fromYmd(year, month, day);
                    const lunar = solar.getLunar();
                    const age = new Date().getFullYear() - year;
                    const shengXiao = lunar.getYearShengXiao();
                    const ganChi = translateGanChi(lunar.getYearInGanZhi());
                    const naYinRaw = lunar.getYearNaYin ? lunar.getYearNaYin() : "";
                    const menh = naYinRaw ? translateNaYin(naYinRaw) : "";
                    const wZodiac = getWesternZodiacInfo(day, month);
                    const lComp = getLunarCompatibility(shengXiao);
                    extraAstrologyInfo =
                        `- 🎂 **Tuổi Dương:** \`${age}\` tuổi — **Cung:** \`${wZodiac.name} (${wZodiac.nameEn} ${wZodiac.symbol})\`\n` +
                            `- 🌙 **Tuổi Âm:** \`Năm ${ganChi} (${lComp.animal} ${lComp.emoji})\` — **Mệnh:** \`${menh || 'N/A'}\`\n` +
                            `- 💖 **Cung hợp:** \`${wZodiac.compatible}\`\n` +
                            `- 🤝 **Tuổi hợp cạ:** \`${lComp.tamHop} (Tam Hợp), ${lComp.lucHop} (Lục Hợp)\`\n` +
                            `- ⚡ **Tuổi khắc:** \`${lComp.xungChinhDien}\`, \`${lComp.xungNhom}\``;
                }
                catch (e) { }
            }
            // Lấy danh sách những người đang crush bí mật
            const whoCrushedMeList = await (0, database_1.getWhoCrushedMe)(targetUser.id);
            const crushCount = whoCrushedMeList ? whoCrushedMeList.length : 0;
            const gangTitle = getGangTitle(balance, debt, isPrincess);
            let rolesText = "Không có";
            let memberInfoText = "";
            if (targetMember) {
                const roles = targetMember.roles.cache
                    .filter(r => r.id !== message.guild?.id)
                    .sort((a, b) => b.position - a.position)
                    .map(r => `<@&${r.id}>`);
                if (roles.length > 0) {
                    rolesText = roles.length > 8 ? `${roles.slice(0, 8).join(', ')} *(+${roles.length - 8} vai trò nữa)*` : roles.join(', ');
                }
                const joinedDate = targetMember.joinedAt ? `${targetMember.joinedAt.getDate().toString().padStart(2, '0')}/${(targetMember.joinedAt.getMonth() + 1).toString().padStart(2, '0')}/${targetMember.joinedAt.getFullYear()}` : "N/A";
                const createdDate = `${targetUser.createdAt.getDate().toString().padStart(2, '0')}/${(targetUser.createdAt.getMonth() + 1).toString().padStart(2, '0')}/${targetUser.createdAt.getFullYear()}`;
                memberInfoText = `- 📥 **Tham gia Server:** \`${joinedDate}\`\n- 🐣 **Tạo Discord:** \`${createdDate}\``;
            }
            else {
                const createdDate = `${targetUser.createdAt.getDate().toString().padStart(2, '0')}/${(targetUser.createdAt.getMonth() + 1).toString().padStart(2, '0')}/${targetUser.createdAt.getFullYear()}`;
                memberInfoText = `- 🐣 **Tạo Discord:** \`${createdDate}\``;
            }
            const genderIcon = profile.gender === 'Nữ' ? '👩' : '👨';
            const avatarUrl = targetMember
                ? targetMember.displayAvatarURL({ forceStatic: false, size: 512 })
                : targetUser.displayAvatarURL({ forceStatic: false, size: 512 });
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(`📋 HỒ SƠ LÝ LỊCH GIANG HỒ • ${gangTitle}`)
                .setThumbnail(avatarUrl)
                .setDescription(`Thông tin hồ sơ tạm trú tạm vắng của <@${targetUser.id}>:`)
                .addFields({ name: "👤 Họ và tên thật", value: `\`${profile.name}\``, inline: true }, { name: "🚻 Giới tính", value: `${genderIcon} \`${profile.gender}\``, inline: true }, { name: "🎂 Ngày sinh", value: `\`${profile.birthday}\``, inline: true }, { name: "💰 Tài chính Ngân hàng", value: `- 💵 **Ví tiền:** \`${(0, utils_1.formatMoney)(balance)}\`đ\n- 💸 **Nợ ngân hàng:** \`${(0, utils_1.formatMoney)(debt)}\`đ`, inline: false })
                .setColor(0x00A8FF)
                .setFooter({ text: isSelf ? "Gõ @BotToan profile [Tên] [Nam/Nữ] [DD/MM/YYYY] để cập nhật hồ sơ!" : "BotToan - Hồ sơ lý lịch giang hồ" });
            if (extraAstrologyInfo) {
                embed.addFields({ name: "🔮 Tử vi, Cung Mạng & Phong Thủy", value: extraAstrologyInfo, inline: false });
            }
            embed.addFields({ name: "💘 Chỉ số Đào Hoa", value: `\`${crushCount}\` người đang âm thầm crush bí mật`, inline: true }, { name: "🎭 Vai trò (Roles)", value: rolesText, inline: false }, { name: "📅 Nhật ký tài khoản", value: memberInfoText, inline: false });
            // Action Row 4 nút bấm tương tác Quick Action
            const actionRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(`profile_card_${targetUser.id}`)
                .setLabel('🖼️ Xuất Thẻ Giang Hồ')
                .setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder()
                .setCustomId(`profile_tarot_${targetUser.id}`)
                .setLabel('🔮 Xem Bói Hôm Nay')
                .setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder()
                .setCustomId(`profile_match_${targetUser.id}`)
                .setLabel('💖 Ghép Đôi Nhanh')
                .setStyle(discord_js_1.ButtonStyle.Danger), new discord_js_1.ButtonBuilder()
                .setCustomId(`profile_wallet_${targetUser.id}`)
                .setLabel('🏦 Check Ví Tiền')
                .setStyle(discord_js_1.ButtonStyle.Secondary));
            await message.reply({ embeds: [embed], components: [actionRow] }).catch(() => { });
            return;
            return;
        }
        else {
            if (isSelf) {
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle("📄 BẠN CHƯA KHAI BÁO HỒ SƠ LÝ LỊCH")
                    .setDescription(`⚠️ **Mày chưa khai báo tạm trú tạm vắng với Thầy Toàn!**\n\nHãy gõ lệnh đăng ký hồ sơ theo cú pháp:\n\`@BotToan profile [Tên thật] [Nam/Nữ] [Ngày/Tháng/Năm sinh]\`\n\n*Ví dụ:* \`@BotToan profile Lê Toán Nam 03/03/2003\``)
                    .setColor(0xE67E22)
                    .setFooter({ text: "Khai báo lý lịch để tham gia ghép đôi, xem quẻ và bói duyên!" });
                await message.reply({ embeds: [embed] }).catch(() => { });
            }
            else {
                await message.reply(`❌ **<@${targetUser.id}> chưa khai báo lý lịch với BotToan!** Nhắc đối phương gõ \`@BotToan profile [Tên] [Nam/Nữ] [Ngày/Tháng/Năm]\` để đăng ký trước nhé!`).catch(() => { });
            }
            return;
        }
    }
    // TRƯỜNG HỢP B: Có ngày sinh -> ĐĂNG KÝ hoặc CẬP NHẬT Profile
    const day = parseInt(dobMatch[1], 10);
    const month = parseInt(dobMatch[2], 10);
    const year = parseInt(dobMatch[3], 10);
    if (isNaN(day) || isNaN(month) || isNaN(year) || !isValidDate(day, month, year)) {
        await message.reply("❌ **Ngày sinh đéo có thật!** Đừng lòe thiên hạ, nhập đúng ngày tháng năm sinh thực tế đi con giời (Ví dụ: 03/03/2003)!").catch(() => { });
        return;
    }
    const dobFormatted = `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
    // Loại bỏ chuỗi ngày sinh khỏi text
    const textWithoutDob = remainingText.replace(dobRegex, '').trim();
    // Tách các từ để tìm giới tính và tên
    const words = textWithoutDob.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) {
        await message.reply("❌ **Thiếu tên thật rồi con giời!** Hãy nhập theo mẫu: `@BotToan profile [Tên thật] [Nam/Nữ] [Ngày/Tháng/Năm sinh]`").catch(() => { });
        return;
    }
    let gender = "Nam";
    let nameWords = [];
    // Danh sách từ khóa giới tính
    const genderKeywords = ['nam', 'nữ', 'nu', 'nư'];
    const lastWordLower = words[words.length - 1].toLowerCase();
    if (genderKeywords.includes(lastWordLower)) {
        if (lastWordLower === 'nữ' || lastWordLower === 'nu' || lastWordLower === 'nư') {
            gender = "Nữ";
        }
        else {
            gender = "Nam";
        }
        nameWords = words.slice(0, words.length - 1);
    }
    else {
        // Tìm từ khóa giới tính từ phải qua trái
        let genderFoundIdx = -1;
        for (let i = words.length - 1; i >= 0; i--) {
            if (genderKeywords.includes(words[i].toLowerCase())) {
                genderFoundIdx = i;
                break;
            }
        }
        if (genderFoundIdx !== -1) {
            const gStr = words[genderFoundIdx].toLowerCase();
            gender = (gStr === 'nữ' || gStr === 'nu' || gStr === 'nư') ? "Nữ" : "Nam";
            nameWords = words.filter((_, idx) => idx !== genderFoundIdx);
        }
        else {
            nameWords = words;
        }
    }
    const name = nameWords.join(' ').trim();
    if (name.length < 2 || name.length > 50) {
        await message.reply("❌ **Tên thật phải từ 2 đến 50 ký tự!** Nhập lại tên đàng hoàng đi cưng (Ví dụ: `Lê Toán`).").catch(() => { });
        return;
    }
    // Lưu hồ sơ
    await (0, database_1.saveProfile)(message.author.id, name, gender, dobFormatted);
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle("✅ CẬP NHẬT HỒ SƠ THÀNH CÔNG")
        .setThumbnail(message.author.displayAvatarURL({ forceStatic: false }))
        .setDescription(`🎉 Chúc mừng con giời <@${message.author.id}> đã khai báo tạm trú tạm vắng thành công!\n\n📋 **Thông tin lý lịch:**\n- 👤 **Họ và tên:** \`${name}\`\n- 🚻 **Giới tính:** \`${gender}\`\n- 🎂 **Ngày sinh:** \`${dobFormatted}\` (Dương lịch)`)
        .setColor(0x2ECC71)
        .setFooter({ text: "Gõ @BotToan profile để xem lại hồ sơ | Gõ @BotToan ghep doi để bói duyên!" });
    await message.reply({ embeds: [embed] }).catch(() => { });
}
// ================= XỬ LÝ LỆNH CRUSH MẬT =================
const crushCooldowns = new Map();
async function handleCrushCommand(message) {
    const userIdA = message.author.id;
    const botMember = message.guild?.members.me;
    // 1. Kiểm tra quyền xóa tin nhắn (ManageMessages)
    const canManageMessages = botMember &&
        message.channel.isTextBased() &&
        message.channel.permissionsFor(botMember)?.has(discord_js_1.PermissionFlagsBits.ManageMessages);
    if (!canManageMessages) {
        await message.reply("❌ **Thầy Toàn không có quyền xóa tin nhắn ở đây (cần quyền Quản lý tin nhắn - Manage Messages) nên không thể thực hiện lệnh Crush Mật bảo mật được! Lộ hết cưng ơi!**").catch(() => { });
        return;
    }
    // 2. Kiểm tra xem người dùng có gõ nhầm (Accidental Ping) hay không
    // Mentions không tính bot
    const otherMentions = message.mentions.users.filter(u => u.id !== message.client.user?.id);
    if (otherMentions.size > 0) {
        await message.delete().catch(() => { });
        try {
            await message.author.send(`⚠️ **LỘ HẾT CẢ BÍ MẬT RỒI CON VỢ!** Thầy bảo gõ \`@BotToan crush\` thôi rồi chọn trong menu, sao lại đi tag thẳng tên người ta vào thế? Discord gửi thông báo rung máy người ta rồi kìa! Lần sau rút kinh nghiệm nhé! 🤫`);
        }
        catch (err) {
            await message.channel.send(`❌ <@${userIdA}> ơi, đã bảo là tuyệt mật mà sao lại đi tag thẳng tên người ta vào thế? Lộ hết rồi kìa! (Tin nhắn đã được xoá để giảm thiệt hại)`).catch(() => { });
        }
        return;
    }
    // 3. Xoá tin nhắn gốc lập tức để bảo mật
    await message.delete().catch(() => { });
    // 4. Kiểm tra Cooldown (5 phút)
    const cooldownTime = 5 * 60 * 1000;
    const lastUse = crushCooldowns.get(userIdA) || 0;
    if (Date.now() - lastUse < cooldownTime) {
        const timeLeft = Math.ceil((cooldownTime - (Date.now() - lastUse)) / 1000);
        try {
            await message.author.send(`❌ **Từ từ thôi con giời!** Lệnh Crush Mật chỉ được dùng tối đa 5 phút một lần. Thử lại sau **${timeLeft} giây** nhé!`);
        }
        catch (err) {
            await message.channel.send(`❌ <@${userIdA}> ơi, lệnh thích đang trong thời gian chờ (cooldown). Vui lòng thử lại sau vài phút! (Tin nhắn đã được xoá để bảo mật)`).catch(() => { });
        }
        return;
    }
    // 5. Kiểm tra Profile của người thích (A)
    const profileA = await (0, database_1.getProfile)(userIdA);
    if (!profileA) {
        try {
            await message.author.send(`❌ **Mày còn chưa khai báo lý lịch (profile) mà đòi đi thích người ta à?**\nHãy gõ lệnh sau để tạo hồ sơ trước:\n\`@BotToan profile [Tên] [Nam/Nu] [Ngày/Tháng/Năm Sinh]\``);
        }
        catch (err) {
            await message.channel.send(`❌ <@${userIdA}> ơi, mày chưa khai báo lý lịch (profile). Hãy gõ \`@BotToan profile ...\` để đăng ký trước nhé! (Tin nhắn gốc đã được xoá để bảo mật)`).catch(() => { });
        }
        return;
    }
    profileA.birthday = profileA.birthday.replace(/\-/g, '/');
    // 6. Kiểm tra xem người dùng có đang bận chơi game khác hay không
    if (utils_1.activeGamePlayers.has(userIdA)) {
        try {
            await message.author.send("❌ **Mày đang bận việc khác rồi con giời!** Đang chơi game bói toán khác thì xong đi đã chứ!");
        }
        catch (err) {
            await message.channel.send(`❌ <@${userIdA}> ơi, mày đang bận chơi game khác. Vui lòng kết thúc game trước khi dùng lệnh thích nhé!`).catch(() => { });
        }
        return;
    }
    utils_1.activeGamePlayers.add(userIdA);
    // 7. Tạo Embed và Dropdown
    const selectMenu = new discord_js_1.UserSelectMenuBuilder()
        .setCustomId('crush_select')
        .setPlaceholder('Chọn người thương trong bóng tối...');
    const row = new discord_js_1.ActionRowBuilder()
        .addComponents(selectMenu);
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle("🤫 SE DUYÊN MẬT — THẦY TOÀN GIANG HỒ")
        .setDescription(`Chào **${profileA.name}**, hãy chọn con giời mày thầm thương trộm nhớ ở menu bên dưới.\nThầy Toàn sẽ ghi sổ đen bảo mật cho mày!\n\n*(Lưu ý: Lựa chọn của mày chỉ có một mình mày nhìn thấy khi chọn, thời gian chọn: 30 giây)*`)
        .setColor(0xFF69B4)
        .setFooter({ text: "Thời gian chọn: 30 giây" });
    const promptMsg = await message.channel.send({
        content: `👋 <@${userIdA}> ơi, chọn người trong mộng đi cưng:`,
        embeds: [embed],
        components: [row]
    }).catch(() => null);
    if (!promptMsg) {
        utils_1.activeGamePlayers.delete(userIdA);
        return;
    }
    const collector = promptMsg.createMessageComponentCollector({
        componentType: discord_js_1.ComponentType.UserSelect,
        time: 30000
    });
    let isProcessed = false;
    collector.on('collect', async (i) => {
        if (i.user.id !== userIdA) {
            await i.reply({ content: "❌ Đéo phải lượt chọn của mày! Tự gõ \`@BotToan crush\` để tự tìm bồ đi cưng!", ephemeral: true }).catch(() => { });
            return;
        }
        if (isProcessed)
            return;
        isProcessed = true;
        collector.stop('selected');
        try {
            const userIdB = i.values[0];
            if (userIdB === userIdA) {
                await i.reply({ content: "❌ **Tự luyến vừa thôi con giời!** Thầm thương trộm nhớ mình để hóa điên à? 🤪", ephemeral: true }).catch(() => { });
                await promptMsg.edit({
                    content: `❌ <@${userIdA}> tự bóp dái tự yêu bản thân nên thầy hủy quẻ se duyên này!`,
                    embeds: [],
                    components: []
                }).catch(() => { });
                return;
            }
            if (userIdB === message.client.user?.id) {
                await i.reply({ content: "❌ **Bỏ ngay cái ý định gạ gẫm tao đi!** Tao chỉ yêu ví tiền của mày thôi, đừng có mà mơ mộng hão huyền! 💸🤖", ephemeral: true }).catch(() => { });
                await promptMsg.edit({
                    content: `❌ <@${userIdA}> định gạ gẫm BotToan nhưng bị thầy vả cho tỉnh ngộ!`,
                    embeds: [],
                    components: []
                }).catch(() => { });
                return;
            }
            const profileB = await (0, database_1.getProfile)(userIdB);
            if (!profileB) {
                await i.reply({ content: `❌ **Đối phương sống ngoài vòng pháp luật, trốn khai báo lý lịch!** Bảo họ gõ \`@BotToan profile ...\` đi rồi mới thích được!`, ephemeral: true }).catch(() => { });
                await promptMsg.edit({
                    content: `❌ <@${userIdA}> ơi, đối phương chưa khai báo lý lịch nên thầy chịu không se duyên được!`,
                    embeds: [],
                    components: []
                }).catch(() => { });
                return;
            }
            profileB.birthday = profileB.birthday.replace(/\-/g, '/');
            // --- CHECK PHỐT NGOẠI TÌNH (Betrayal detection) ---
            const oldCrushOfA = await (0, database_1.getCrush)(userIdA);
            if (oldCrushOfA && oldCrushOfA !== userIdB) {
                const crushOfOld = await (0, database_1.getCrush)(oldCrushOfA);
                if (crushOfOld === userIdA) {
                    // A và oldCrushOfA từng khớp lệnh yêu nhau ngọt ngào mà nay A thay lòng!
                    await message.channel.send(`🚨 **PHỐT NGOẠI TÌNH CỰC CĂNG!** 🚨\nCon chó <@${userIdA}> vừa thay lòng đổi dạ! Nó đã âm thầm hủy Crush để đi thả thính đối tượng khác rồi! <@${oldCrushOfA}> ơi vào gõ lệnh \`@BotToan bao cong an <@${userIdA}>\` tống cổ kẻ phản bội này vào tù ngay cho tao! 🚔🔒`).catch(() => { });
                }
            }
            // Lưu crush mới và cập nhật cooldown
            await (0, database_1.updateCrush)(userIdA, userIdB);
            crushCooldowns.set(userIdA, Date.now());
            // --- XỬ LÝ CHÚA TỂ SIMP LỎ (Đổi crush quá 3 lần/ngày) ---
            const now = Date.now();
            const todayStr = (0, database_1.getVNDateString)(now);
            const crushChanges = await (0, database_1.incrementCrushChange)(userIdA, todayStr);
            if (crushChanges > 3) {
                await (0, database_1.setSimpLo)(userIdA, now + 24 * 60 * 60 * 1000);
                const memberA = message.member;
                if (memberA) {
                    const currentNick = memberA.displayName;
                    if (!currentNick.includes("[🤡 Simp Lỏ]")) {
                        const newNick = `[🤡 Simp Lỏ] ${currentNick.substring(0, 18)}`;
                        let nickChanged = false;
                        try {
                            await memberA.setNickname(newNick);
                            nickChanged = true;
                        }
                        catch (err) {
                            await message.channel.send(`🤡 Định gắn mác Simp Lỏ cho sếp lớn <@${userIdA}> mà quyền tao bé quá đéo làm được! Nhưng cả server nhớ nhé, nó là Chúa Tể Simp Lỏ hôm nay!`).catch(() => { });
                        }
                        if (nickChanged) {
                            await message.channel.send(`🤡 **PHONG HIỆU CHÚA TỂ SIMP LỎ!** <@${userIdA}> đã thay đổi crush quá 3 lần hôm nay. Tao ban tặng phong hiệu **[🤡 Simp Lỏ]** khóa đầu 24 giờ cho chừa thói bắt cá nhiều tay! 🤡`).catch(() => { });
                        }
                    }
                }
            }
            // Kiểm tra tương hỗ
            const crushOfB = await (0, database_1.getCrush)(userIdB);
            if (crushOfB === userIdA) {
                // MATCH THÀNH CÔNG!
                const yearA = parseInt(profileA.birthday.split('/')[2], 10);
                const yearB = parseInt(profileB.birthday.split('/')[2], 10);
                let matchmakingComment = "";
                if (profileA.gender === 'Nam' && profileB.gender === 'Nam') {
                    const gayQuotes = [
                        "Ủa hai thằng đực rựa đều crush nhau à? Thông đít cúc hoa khai mở vận mệnh mới à? Chúc hai khứa dầu ăn trơn tru nhé! 👬🧴",
                        "Gay cấn chưa! Sòng bạc của tao tự nhiên lòi ra cặp đôi dầu ăn Neptun uy tín thế này. Hai thằng bê đê chúng mày dắt nhau đi mua dầu ăn rồi về thông cúc đi chứ crush cái gì nữa! 🌈🧴",
                        "Đoạt hồn đoạt cúc! Hai khứa đực rựa này lưỡng tình tương duyệt rồi nhé. Một thằng làm công, một thằng làm thụ, nồi nào úp vung nấy, cúc hoa tàn héo đêm nay rồi! 🍑👈"
                    ];
                    matchmakingComment = gayQuotes[Math.floor(Math.random() * gayQuotes.length)];
                }
                else if (profileA.gender === 'Nữ' && profileB.gender === 'Nữ') {
                    const lesQuotes = [
                        "Kéo kéo cắt cắt à hai cô nương? Thôi hai đứa tự cọ cọ chăm sóc nhau đi, sòng bài bớt đi hai con nợ nữ rồi! 👭✂️",
                        "Âm dương cách biệt? Không, đây là hai cực âm hút nhau! Hai cô nương định làm trò cọ cọ kéo cắt tỉa cành hoa hồng à? Mở sới đấu kiếm nữ đi tao làm trọng tài! ✂️🌺",
                        "Húp sò húp hến à hai cô bé? Hai đứa mày thầm thích nhau thì dắt nhau đi ăn lẩu cua đồng hay cọ kéo gì đi, cấm rủ rê tao tham gia nhé! 🦀👭"
                    ];
                    matchmakingComment = lesQuotes[Math.floor(Math.random() * lesQuotes.length)];
                }
                else {
                    const maleProfile = profileA.gender === 'Nam' ? profileA : profileB;
                    const femaleProfile = profileA.gender === 'Nữ' ? profileA : profileB;
                    const maleId = profileA.gender === 'Nam' ? userIdA : userIdB;
                    const femaleId = profileA.gender === 'Nữ' ? userIdA : userIdB;
                    const yearMale = parseInt(maleProfile.birthday.split('/')[2], 10);
                    const yearFemale = parseInt(femaleProfile.birthday.split('/')[2], 10);
                    if (yearMale > yearFemale) {
                        // Nam trẻ tuổi hơn Nữ -> Phi công
                        const pilotQuotes = [
                            `Ơ thế thằng <@${maleId}> thích làm phi công trẻ à? Con <@${femaleId}> hơn mày ${yearMale - yearFemale} tuổi đấy! Máy bay này động cơ phản lực hơi bị khỏe, khôn hồn thì thắt dây an toàn vào kẻo rớt phi đạo con ạ! ✈️👩‍👦`,
                            `Thằng cu <@${maleId}> non choẹt đòi cưỡi máy bay bà già <@${femaleId}> hơn ${yearMale - yearFemale} tuổi. Máy bay này bay lâu năm động cơ rệu rã hay là phản lực hạng nặng? Coi chừng gãy cánh giữa đường nhé em trai! 🛩️👵`,
                            `Khẩu vị mặn mà đấy khứa <@${maleId}>! Thích máy bay ném bom <@${femaleId}> hơn tận ${yearMale - yearFemale} tuổi. Lái máy bay này thì không lo thiếu sữa mẹ, nhưng coi chừng bị đè bẹp dí đéo ngóc đầu lên nổi! ✈️🍼`
                        ];
                        matchmakingComment = pilotQuotes[Math.floor(Math.random() * pilotQuotes.length)];
                    }
                    else if (yearMale < yearFemale - 4) {
                        // Nam lớn tuổi hơn Nữ >= 5 tuổi -> Trâu già
                        const oldCowQuotes = [
                            `Thằng già <@${maleId}> lại thích gặm cỏ non à? Con bé <@${femaleId}> kém mày tận ${yearFemale - yearMale} tuổi. Đúng là trâu già thích cỏ non, liệu hồn kẻo bố nó vác dao rượt nhé! 👴🌱`,
                            `Cảnh sát ơi có biến thái! Thằng <@${maleId}> tuổi cao sức yếu lại đòi gặm cỏ non xanh mướt <@${femaleId}> kém tận ${yearFemale - yearMale} tuổi. Liệu mà mua bảo hiểm thân thể đi, phụ huynh nó biết là thiến làm thái giám đấy! 🚔👴`,
                            `Mày định làm daddy nuôi sinh viên nghèo vượt khó à thằng <@${maleId}>? Bé <@${femaleId}> kém mày ${yearFemale - yearMale} tuổi đầu, yêu đương đéo gì tầm này, dắt nó đi mua bim bim rồi đưa về nhà trước 9h tối đi con giời! 🍭🌱`
                        ];
                        matchmakingComment = oldCowQuotes[Math.floor(Math.random() * oldCowQuotes.length)];
                    }
                    else {
                        // Cặp đôi nam nữ bình thường
                        const straightQuotes = [
                            `Tình trong như đã mặt ngoài còn e! Thằng <@${maleId}> thì thèm nhỏ dãi, con <@${femaleId}> thì cũng chết mê chết mệt. Crush làm cái mẹ gì nữa, dắt nhau ra sòng xóc đĩa làm lễ thành hôn, kiếm cọc tiền nợ rồi bỏ trốn chung đi các con giời! 💍🚔`,
                            `Ối giời đất ơi cẩu lương ngập sòng bạc rồi! Hai đứa mày thầm thương trộm nhớ nhau bấy lâu nay mà cứ làm màu. <@${maleId}> và <@${femaleId}> chính thức khớp lệnh! Cưới lẹ đi rồi đẻ con ra nuôi sới bạc cho tao! 👶🎲`,
                            `Hợp đồng tình ái đã được ký kết! <@${maleId}> chính thức cắm cọc vào tim <@${femaleId}> và ngược lại. Khỏi crush thầm lặng nữa, dắt nhau đi nhà nghỉ hay đi tù chung thì tùy hai đứa mày, tao không cản! 🏨🚔`,
                            `Kinh điển chưa, hai đứa câm nín crush nhau nay đã lộ tẩy! <@${maleId}> và ${femaleId} chính thức khớp lệnh! Cưới lẹ đi rồi đẻ con ra nuôi sới bạc cho tao!`,
                            `Hợp đồng tình ái đã được ký kết! <@${maleId}> và <@${femaleId}> chính thức kết duyên lành, tao không cản!`
                        ];
                        matchmakingComment = straightQuotes[Math.floor(Math.random() * straightQuotes.length)];
                    }
                }
                const messageA = `💕 **KHỚP LỆNH THÀNH CÔNG!** 💕\n\nCon giời <@${userIdB}> (\`${profileB.name}\`) cũng đang thầm thương trộm nhớ mày đấy!\n\n💬 **Lời phán từ thầy bói BotToan:**\n${matchmakingComment}`;
                const messageB = `💕 **KHỚP LỆNH THÀNH CÔNG!** 💕\n\nCon giời <@${userIdA}> (\`${profileA.name}\`) cũng đang thầm thương trộm nhớ mày đấy!\n\n💬 **Lời phán từ thầy bói BotToan:**\n${matchmakingComment}`;
                let sentA = false;
                let sentB = false;
                try {
                    await message.author.send(messageA);
                    sentA = true;
                }
                catch (err) {
                    console.error(`Không thể gửi DM cho User A (${userIdA}):`, err);
                }
                try {
                    const fetchedUserB = await message.client.users.fetch(userIdB);
                    await fetchedUserB.send(messageB);
                    sentB = true;
                }
                catch (err) {
                    console.error(`Không thể gửi DM cho User B (${userIdB}):`, err);
                }
                await i.reply({ content: "💕 **KHỚP LỆNH THÀNH CÔNG!** Thầy Toàn đã tác hợp cho hai đứa bay!", ephemeral: true }).catch(() => { });
                if (!sentA || !sentB) {
                    let responseText = `🚨 **LƯỠNG TÌNH TƯƠNG DUYỆT RỒI NHÉ!** \n`;
                    if (!sentA && !sentB) {
                        responseText += `Nhưng cả hai đứa <@${userIdA}> và <@${userIdB}> đều đang khóa DM nên tao đéo gửi tin nhắn mật được. Mở khóa nhận DM từ thành viên chung server ra đi rồi chơi tiếp!`;
                    }
                    else if (!sentA) {
                        responseText += `Nhưng <@${userIdA}> đang khóa DM nên tao đéo gửi tin nhắn mật được. Mở DM ra đi con giời!`;
                    }
                    else {
                        responseText += `Nhưng <@${userIdB}> đang khóa DM nên tao đéo gửi tin nhắn mật được. Mở DM ra đi con giời!`;
                    }
                    await promptMsg.edit({
                        content: responseText,
                        embeds: [],
                        components: []
                    }).catch(() => { });
                }
                else {
                    await promptMsg.edit({
                        content: `🎉 **KHỚP LỆNH THÀNH CÔNG!** Thầy Toàn đã se duyên thành công cho <@${userIdA}> và <@${userIdB}>! Mau vào check DM ngay kẻo nguội! 💕`,
                        embeds: [],
                        components: []
                    }).catch(() => { });
                }
            }
            else {
                // Chỉ thích một phía
                await i.reply({
                    content: `🤫 **Ghi sổ đen thành công!** Tao đã lưu trữ mối tình đầu của mày dành cho đối phương vào hệ thống. Chờ khi nào họ cũng thích mày thì sẽ khớp lệnh mật nhé! Nằm im góc tối tương tư tiếp đi con giời!`,
                    ephemeral: true
                }).catch(() => { });
                await promptMsg.edit({
                    content: `🤫 <@${userIdA}> vừa âm thầm gửi gắm một tâm tư tình cảm... Thầy Toàn đã ghi nhận và lưu vào sổ đen mật! 🔮`,
                    embeds: [],
                    components: []
                }).catch(() => { });
            }
        }
        finally {
            utils_1.activeGamePlayers.delete(userIdA);
        }
    });
    collector.on('end', async (collected, reason) => {
        if (reason !== 'selected') {
            utils_1.activeGamePlayers.delete(userIdA);
            await promptMsg.edit({
                content: `❌ **Hết thời gian chọn!** <@${userIdA}> lề mề quá cút đi cho thầy se duyên người khác! ⏳`,
                embeds: [],
                components: []
            }).catch(() => { });
        }
    });
}
// ================= XỬ LÝ LỆNH GHÉP ĐÔI PHONG THỦY =================
async function playMatchmaking(message) {
    const mentions = message.mentions.users.filter(u => u.id !== message.client.user?.id);
    let userA = message.author;
    let userB = mentions.first();
    if (mentions.size === 2) {
        userA = mentions.first();
        userB = mentions.at(1);
    }
    else if (mentions.size > 2) {
        await message.reply("❌ **Mày định chơi trò group sex hay gì mà tag lắm thế?** Chọn tối đa 2 đứa thôi con giời!").catch(() => { });
        return;
    }
    if (!userB) {
        await message.reply("❌ **Ủa rồi mày định ghép cặp với ai? Tự sướng à?** Tag đứa mày muốn ghép vào! Ví dụ: `@BotToan ghep doi @Ten_Doi_Phuong`.").catch(() => { });
        return;
    }
    const userIdA = userA.id;
    const userIdB = userB.id;
    if (userIdA === userIdB) {
        await message.reply("❌ **Trầm cảm hay gì mà tự ghép đôi với chính mình?** Rảnh quá thì ra sòng xóc đĩa cúng tiền cho tao đi! 🤪").catch(() => { });
        return;
    }
    if (userIdB === message.client.user?.id) {
        await message.reply("❌ **Bỏ ngay cái ý định gạ gẫm tao đi!** Tao chỉ yêu tiền chứ không yêu người! 💸🤖").catch(() => { });
        return;
    }
    // Đọc hồ sơ
    const profileA = await (0, database_1.getProfile)(userIdA);
    if (!profileA) {
        const who = userIdA === message.author.id ? "Mày" : `Con giời <@${userIdA}>`;
        await message.reply(`❌ **${who} chưa khai báo lý lịch (profile) bói toán!**\nHãy gõ lệnh sau để tạo hồ sơ trước:\n\`@BotToan profile [Tên] [Nam/Nu] [Ngày/Tháng/Năm Sinh]\``).catch(() => { });
        return;
    }
    profileA.birthday = profileA.birthday.replace(/\-/g, '/');
    const profileB = await (0, database_1.getProfile)(userIdB);
    if (!profileB) {
        const who = userIdB === message.author.id ? "Mày" : `Con giời <@${userIdB}>`;
        await message.reply(`❌ **${who} chưa khai báo lý lịch (profile) bói toán!**\nHãy gõ lệnh sau để tạo hồ sơ trước:\n\`@BotToan profile [Tên] [Nam/Nu] [Ngày/Tháng/Năm Sinh]\``).catch(() => { });
        return;
    }
    profileB.birthday = profileB.birthday.replace(/\-/g, '/');
    // Đọc thông tin tài chính
    const balanceA = await (0, database_1.getBalance)(userIdA);
    const debtA = await (0, database_1.getDebt)(userIdA);
    const balanceB = await (0, database_1.getBalance)(userIdB);
    const debtB = await (0, database_1.getDebt)(userIdB);
    // Tính toán phong thủy lunar-javascript
    let zodiacA = "", ganChiA = "", menhA = "";
    let zodiacB = "", ganChiB = "", menhB = "";
    try {
        const dobPartsA = profileA.birthday.split('/');
        const solarA = lunar_javascript_1.Solar.fromYmd(parseInt(dobPartsA[2]), parseInt(dobPartsA[1]), parseInt(dobPartsA[0]));
        const lunarA = solarA.getLunar();
        zodiacA = translateShengXiao(lunarA.getYearShengXiao());
        ganChiA = translateGanChi(lunarA.getYearInGanZhi());
        menhA = translateNaYin(lunarA.getYearNaYin());
        const dobPartsB = profileB.birthday.split('/');
        const solarB = lunar_javascript_1.Solar.fromYmd(parseInt(dobPartsB[2]), parseInt(dobPartsB[1]), parseInt(dobPartsB[0]));
        const lunarB = solarB.getLunar();
        zodiacB = translateShengXiao(lunarB.getYearShengXiao());
        ganChiB = translateGanChi(lunarB.getYearInGanZhi());
        menhB = translateNaYin(lunarB.getYearNaYin());
    }
    catch (err) {
        console.error("Lỗi phong thủy lunar-javascript:", err);
        await message.reply("❌ Lỗi tâm linh rồi! Không thể giải mã ngày sinh dương lịch của hai đứa mày sang phong thủy Á Đông!").catch(() => { });
        return;
    }
    const cungPhiA = getCungPhi(profileA.birthday, profileA.gender);
    const cungPhiB = getCungPhi(profileB.birthday, profileB.gender);
    const batTrach = getBatTrachRelation(cungPhiA.name, cungPhiB.name);
    // Tính toán điểm cơ bản
    let score = getFengShuiScore(zodiacA.split(' ')[0], zodiacB.split(' ')[0], menhA, menhB, cungPhiA.name, cungPhiB.name);
    let explanation = "";
    let isJailTriggered = false;
    // --- CÁC KỊCH BẢN ĐẶC BIỆT ---
    // 1. Trà xanh phá bĩnh (1% ngẫu nhiên)
    const teaGreenRoll = Math.random() < 0.01;
    // 2. Ép đi tù chung (1% ngẫu nhiên)
    const jailRoll = Math.random() < 0.01;
    if (teaGreenRoll) {
        score = 0;
        explanation = `Tính toán làm gì, xác suất hợp nhau là **0%** nhé!\n👉 Con <@${userIdB}> bỏ thằng nghèo đó đi, yêu tao đây này, tao vừa trúng lô 500k sáng nay! 💸💚`;
    }
    else if (jailRoll || score === 100) {
        score = 100;
        explanation = `💥 **HỢP NHAU QUÁ MỨC CHO PHÉP!** Đưa nhau vào tù hưởng tuần trăng mật đi!\n🚔 Cả hai đứa bay chuẩn bị được áp giải vào **Nhà Tù** và khóa mõm cấm chat 2 phút nghe chưa!`;
        isJailTriggered = true;
    }
    // 3. Hai đứa cùng nợ ngân hàng
    else if (debtA > 0 && debtB > 0) {
        score = 99;
        explanation = `💔 **Trời sinh một cặp (báo thủ)!**\nChồng nợ **${(0, utils_1.formatMoney)(debtA)}**, vợ nợ **${(0, utils_1.formatMoney)(debtB)}**.\nTướng phu thê gánh còng lưng khoản nợ này thì đúng là nồi nào úp vung nấy. Vote cưới xong bỏ trốn chung luôn đi chứ cày gì tầm này nữa! 🏃‍♂️🏃‍♀️🏦`;
    }
    // 4. Một đứa đại gia, một đứa cái bang
    else if ((balanceA >= 300 && balanceB < 20) || (balanceB >= 300 && balanceA < 20)) {
        score = 15;
        const richUser = balanceA >= 300 ? userA : userB;
        const poorUser = balanceA >= 300 ? userB : userA;
        explanation = `💸 Thằng/Con <@${poorUser.id}> thì nghèo rớt mồng tơi, <@${richUser.id}> thì tiền đầy ví.\nYêu đương mẹ gì tầm này, mày định đào mỏ đúng không con giời? Tao báo công an bắt bây giờ! 🚔👮‍♂️`;
    }
    // 5. Giang hồ nợ nần & Chỉ điểm báo án (5% ngẫu nhiên hoặc khi một bên nợ nặng)
    else if ((debtA >= 100 && debtB === 0 && Math.random() < 0.2) || (debtB >= 100 && debtA === 0 && Math.random() < 0.2)) {
        score = -50;
        const giangHo = debtA >= 100 ? userA : userB;
        const chiDiem = debtA >= 100 ? userB : userA;
        explanation = `☠️ **Tỉ lệ tương hợp: Âm 50%!**\nKhứa <@${giangHo.id}> thì ngập trong nợ nần bài bạc, đứa <@${chiDiem.id}> thì chuyên rình rình báo công an ăn tiền thưởng.\nCưới nhau về để cái đồn công an thành phòng tân hôn à? Bỏ đi mà làm người! 🚔🔒`;
    }
    // 6. Trường hợp bình thường -> Gọi Gemini
    else {
        if ('sendTyping' in message.channel)
            await message.channel.sendTyping();
        const geminiPrompt = `
            Hãy bói tình duyên phong cách giang hồ cho 2 người:
            Người A: tên "${profileA.name}", giới tính "${profileA.gender}", tuổi "${ganChiA} (${zodiacA})", mệnh "${menhA}", cung phi "${cungPhiA.name} (${cungPhiA.group})", ví có ${balanceA}k, nợ ${debtA}k.
            Người B: tên "${profileB.name}", giới tính "${profileB.gender}", tuổi "${ganChiB} (${zodiacB})", mệnh "${menhB}", cung phi "${cungPhiB.name} (${cungPhiB.group})", ví có ${balanceB}k, nợ ${debtB}k.
            Kết hợp Bát Trạch: "${batTrach.relation} (${batTrach.desc})"
            Độ tương hợp phong thủy thực tế tính được: ${score}%.
            
            Hãy phán xem 2 đứa này yêu nhau thì hợp nhau đi ăn cướp, đi ăn mày hay dắt tay nhau đi tù trốn nợ ngân hàng. Hãy dựa vào cả Cung Phi Bát Trạch (Ví dụ Tuyệt Mệnh thì chửi yêu nhau chỉ có cúng tiền hòm, Sinh Khí thì chửi hai đứa cùng nhau đi lừa đảo). Viết cực kỳ ngắn gọn, bộc lộ tính cà khịa bựa và hài hước của BotToan, khoảng 3 câu.
        `;
        try {
            explanation = await (0, gemini_1.getMatchmakingFortune)(geminiPrompt);
        }
        catch (err) {
            console.error("Lỗi khi gọi Gemini bói toán:", err);
            const fallbacks = [
                `Mệnh ${menhA} gặp ${menhB} thì đúng là trời đánh tránh bữa ăn. Điểm hợp nhau chỉ có ${score}%. Hai đứa dắt nhau ra sòng bầu cua cúng tiền là hợp nhất chứ yêu đương gì!`,
                `Nhìn cái tuổi ${zodiacA} với ${zodiacB} là thấy tương khắc rồi, thêm quả mệnh khắc nhau nữa. Độ hợp nhau là ${score}%, cưới nhau về chắc chắn đập nhau sứt đầu mẻ trán!`,
                `Độ hợp nhau đạt ${score}%. Tình cảm hai đứa cũng tạm được, hợp nhất là cùng nhau đi bùng nợ ngân hàng BotToan, tối về chia đôi cọc tiền rồi ngủ riêng giường cho lành.`
            ];
            explanation = fallbacks[Math.floor(Math.random() * fallbacks.length)];
        }
    }
    // --- HẬU QUẢ CỦA PHONG HIỆU SIMP LỎ (Ghép đôi nhọ 5 lần liên tiếp < 20%) ---
    const now = Date.now();
    const todayStr = (0, database_1.getVNDateString)(now);
    if (score < 20) {
        const failedMatches = await (0, database_1.incrementFailedMatch)(userIdA, todayStr);
        if (failedMatches >= 5) {
            await (0, database_1.setSimpLo)(userIdA, now + 24 * 60 * 60 * 1000);
            const memberA = message.member;
            if (memberA) {
                const currentNick = memberA.displayName;
                if (!currentNick.includes("[🤡 Simp Lỏ]")) {
                    const newNick = `[🤡 Simp Lỏ] ${currentNick.substring(0, 18)}`;
                    let nickChanged = false;
                    try {
                        await memberA.setNickname(newNick);
                        nickChanged = true;
                    }
                    catch (err) {
                        await message.channel.send(`🤡 Định gắn mác Simp Lỏ cho sếp lớn <@${userIdA}> mà quyền tao bé quá đéo làm được! Nhưng cả server nhớ nhé, nó là Chúa Tể Simp Lỏ hôm nay!`).catch(() => { });
                    }
                    if (nickChanged) {
                        await message.channel.send(`🤡 **PHONG HIỆU CHÚA TỂ SIMP LỎ!** <@${userIdA}> đã ghép đôi thất bại 5 lần liên tiếp trong ngày với điểm dưới 20%. Đúng là gương mặt vàng trong làng ế chỏng vó, nhận phong hiệu **[🤡 Simp Lỏ]** khóa đầu 24 giờ cho tỉnh ngộ! 🤡`).catch(() => { });
                    }
                }
            }
        }
    }
    const { bar, status } = getLoveBar(score);
    const scoreText = score < 0 ? `${score}% ☠️ (Tương Khắc Cực Độ)` : `${score}%`;
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle("💖 THẦN SỐ HỌC GIANG HỒ: GHÉP ĐÔI TÌNH DUYÊN 💖")
        .setDescription(`Bảng phong thần tình ái dành cho hai con giời:\n👉 <@${userIdA}> (\`${profileA.name}\`) & <@${userIdB}> (\`${profileB.name}\`)`)
        .setColor(score >= 80 ? 0xFF00FF : (score >= 50 ? 0x00FF00 : (score >= 20 ? 0xFFFF00 : 0xFF0000)))
        .addFields({
        name: `👤 Bên A: ${profileA.name} (${profileA.gender})`,
        value: `• Tuổi: \`${ganChiA} (${zodiacA})\`\n• Mệnh: \`${menhA}\`\n• Cung Phi: \`${cungPhiA.name} (${cungPhiA.group})\`\n• Ví: \`${(0, utils_1.formatMoney)(balanceA)}\` | Nợ: \`${(0, utils_1.formatMoney)(debtA)}\``,
        inline: true
    }, {
        name: `👤 Bên B: ${profileB.name} (${profileB.gender})`,
        value: `• Tuổi: \`${ganChiB} (${zodiacB})\`\n• Mệnh: \`${menhB}\`\n• Cung Phi: \`${cungPhiB.name} (${cungPhiB.group})\`\n• Ví: \`${(0, utils_1.formatMoney)(balanceB)}\` | Nợ: \`${(0, utils_1.formatMoney)(debtB)}\``,
        inline: true
    }, {
        name: "☯️ Bát Trạch Kết Hợp",
        value: `• Quan hệ: **${batTrach.relation}** (${batTrach.isGood ? 'Cát/Tốt' : 'Hung/Xấu'})\n• Chi tiết: *${batTrach.desc}* (${batTrach.scoreDelta >= 0 ? '+' : ''}${batTrach.scoreDelta} điểm phong thủy)`,
        inline: false
    }, {
        name: `📊 Chỉ số tương hợp: **${scoreText}**`,
        value: `\`${bar}\`\n👉 *${status}*`,
        inline: false
    }, {
        name: "🔮 Lời phán quyết từ thầy bói BotToan:",
        value: `*“ ${explanation.trim()} ”*`,
        inline: false
    })
        .setFooter({ text: "BotToan - Chuyên gia bói toán cờ bạc & tệ nạn xã hội", iconURL: message.client.user?.displayAvatarURL() })
        .setTimestamp();
    await message.reply({ embeds: [embed] }).catch(() => { });
    if (isJailTriggered && message.guild) {
        setTimeout(async () => {
            await (0, database_1.banChat)(userIdA, 120000);
            await (0, database_1.banChat)(userIdB, 120000);
            await (0, utils_1.sendToJail)(message.guild, userIdA, "Hợp nhau 100% - Đi tù chung hưởng tuần trăng mật");
            await (0, utils_1.sendToJail)(message.guild, userIdB, "Hợp nhau 100% - Đi tù chung hưởng tuần trăng mật");
        }, 3000);
    }
}
// ================= XỬ LÝ DỊCH VỤ THÁM TỬ TƯ & BÁN ĐỨNG =================
async function handleDetectiveServices(message, type) {
    const userId = message.author.id;
    let balance = await (0, database_1.getBalance)(userId);
    if (type === 'thamtu') {
        const cost = 50;
        if (balance < cost) {
            await message.reply(`❌ **Nghèo rớt mồng tơi mà đòi thuê thám tử tư?** Phí dịch vụ thám tử tìm kiếm người thầm thương trộm nhớ mày là **${(0, utils_1.formatMoney)(cost)}**! Lo cày cuốc hoặc vay ngân hàng đi cưng! 💸`).catch(() => { });
            return;
        }
        // Trừ phí thám tử
        balance -= cost;
        await (0, database_1.updateBalance)(userId, balance);
        const admirers = await (0, database_1.getWhoCrushedMe)(userId);
        const count = admirers.length;
        if (count === 0) {
            await message.reply(`🕵️‍♂️ **Thám tử tư BotToan báo cáo:**\nCầm **${(0, utils_1.formatMoney)(cost)}** của mày tao đi dò la khắp hang cùng ngõ hẻm rồi. Kết quả là **ĐÉO CÓ AI** thầm thích mày cả! Vừa ế chỏng chơ vừa mất tiền ngu, chừa thói tò mò nhé con giời! 🤡💸`).catch(() => { });
        }
        else {
            await message.reply(`🕵️‍♂️ **Thám tử tư BotToan báo cáo:**\nTao đi dò la thấy đang có **${count}** người thầm thương trộm nhớ mày đấy! Đỏ mặt chưa cưng? Nôn thêm **200k** gõ lệnh \`@BotToan ban dung\` tao chỉ mặt điểm tên từng đứa cho! 😈`).catch(() => { });
        }
    }
    else if (type === 'bandung') {
        const cost = 200;
        // Lấy danh sách trước để tránh scam
        const admirers = await (0, database_1.getWhoCrushedMe)(userId);
        if (admirers.length === 0) {
            await message.reply("❌ **Định cúng tiền ngu cho tao à?** Chưa có mống nào thích mày mà mày đòi bỏ 200k ra mua thông tin bán đứng? Cất tiền đi cờ bạc tiếp đi cưng! 🤡💸").catch(() => { });
            return;
        }
        if (balance < cost) {
            await message.reply(`❌ **Đéo đủ tiền mua tin mật!** Dịch vụ bán đứng đồng bọn có giá **${(0, utils_1.formatMoney)(cost)}**. Mày chỉ còn **${(0, utils_1.formatMoney)(balance)}**, kiếm thêm tiền cúng tao đi! 💸`).catch(() => { });
            return;
        }
        // Trừ tiền
        balance -= cost;
        await (0, database_1.updateBalance)(userId, balance);
        const mentions = admirers.map(id => `<@${id}>`).join(", ");
        await message.reply(`🕵️‍♂️ **Dịch vụ bán đứng đồng bọn BotToan:**\nĐồng tiền đi liền khúc ruột, 200k là dư sức mua đứt danh dự của tao rồi! Danh sách kẻ si tình thầm thích mày đây:\n👉 ${mentions}\n\nMau đi ép duyên hoặc lôi tụi nó ra sòng xóc đĩa củ hành đi con giời! 😈💞`).catch(() => { });
    }
}
// ================= XỬ LÝ LỆNH BÙA YÊU ÉP DUYÊN (500K) =================
async function handleBuaYeu(message) {
    const userA = message.author;
    const targetUser = message.mentions.users.filter(u => u.id !== message.client.user?.id).first();
    if (!targetUser) {
        await message.reply("❌ **Mày định dán bùa yêu lên đầu ai?** Tag nó vào! Ví dụ: `@BotToan mua bua @Ten_Doi_Phuong`.").catch(() => { });
        return;
    }
    const userIdA = userA.id;
    const userIdB = targetUser.id;
    if (userIdA === userIdB) {
        await message.reply("❌ **Tự dán bùa yêu lên trán mình à con?** Đồ tự luyến điên khùng này!").catch(() => { });
        return;
    }
    if (userIdB === message.client.user?.id) {
        await message.reply("❌ **Bỏ đi mày!** Bùa yêu giang hồ đéo có tác dụng với Cảnh sát trưởng BotToan đâu. Tiền của mày cũng đéo mua được trái tim tao! 💸🤖").catch(() => { });
        return;
    }
    const cost = 500;
    let balanceA = await (0, database_1.getBalance)(userIdA);
    if (balanceA < cost) {
        await message.reply(`❌ **Đéo đủ tiền mua bùa!** Bùa yêu ép duyên cưỡng chế có giá cực chát là **${(0, utils_1.formatMoney)(cost)}**. Ví mày chỉ có **${(0, utils_1.formatMoney)(balanceA)}**, nghèo thì chịu ế đi con! 💸`).catch(() => { });
        return;
    }
    const profileA = await (0, database_1.getProfile)(userIdA);
    if (!profileA) {
        await message.reply(`❌ **Mày chưa khai báo lý lịch (profile) bói toán!** Bùa yêu cần thông tin profile để niệm chú. Gõ lệnh này tạo hồ sơ trước:\n\`@BotToan profile [Tên] [Nam/Nu] [Ngày/Tháng/Năm Sinh]\``).catch(() => { });
        return;
    }
    profileA.birthday = profileA.birthday.replace(/\-/g, '/');
    const profileB = await (0, database_1.getProfile)(userIdB);
    if (!profileB) {
        await message.reply(`❌ **Con mồi <@${userIdB}> sống ngoài vòng pháp luật, trốn khai báo profile!** Tao đéo có thông tin của nó để yểm bùa. Bảo nó gõ \`@BotToan profile ...\` đi rồi quay lại đây!`).catch(() => { });
        return;
    }
    profileB.birthday = profileB.birthday.replace(/\-/g, '/');
    // Trừ tiền mua bùa
    balanceA -= cost;
    await (0, database_1.updateBalance)(userIdA, balanceA);
    // --- CHECK NTR DRAMA (Cướp Vợ/Chồng) ---
    const crushOfB = await (0, database_1.getCrush)(userIdB);
    if (crushOfB && crushOfB !== userIdA) {
        const crushOfC = await (0, database_1.getCrush)(crushOfB);
        if (crushOfC === userIdB) {
            // Đúng là đang khớp lệnh mặn nồng với C! Drama NTR nổ ra!
            await message.channel.send(`🚨 **TIN CHẤN ĐỘNG: PHÁT HIỆN GIẬT BỒ BẰNG TÀ PHÉP!** 🚨\n<@${crushOfB}> ơi vào mà xem này! Vợ/chồng mày là <@${userIdB}> vừa trúng Bùa Yêu 500k của phú hộ <@${userIdA}> rồi! Nó đã mất trí nhớ và bỏ mày để chạy theo thằng/con kia. Mau tích tiền mua bùa giật lại hoặc báo công an bắt thằng A cướp vợ/chồng lẹ đi! 💔🪄`).catch(() => { });
        }
    }
    // Ép duyên tương hỗ
    await (0, database_1.updateCrush)(userIdA, userIdB);
    await (0, database_1.updateCrush)(userIdB, userIdA);
    // Kích hoạt bói toán gửi DM cho cả hai
    const yearA = parseInt(profileA.birthday.split('/')[2], 10);
    const yearB = parseInt(profileB.birthday.split('/')[2], 10);
    let matchmakingComment = "";
    if (profileA.gender === 'Nam' && profileB.gender === 'Nam') {
        matchmakingComment = "Bùa yêu đã ghép hai thằng đực rựa với nhau! Chúc hai khứa cúc hoa nở rộ, dầu ăn trơn tru nhé! 👬🧴";
    }
    else if (profileA.gender === 'Nữ' && profileB.gender === 'Nữ') {
        matchmakingComment = "Bùa yêu cưỡng chế hai cô nương cọ cọ kéo cắt với nhau. Chúc hai cô bé hạnh phúc x2! 👭✂️";
    }
    else {
        const maleProfile = profileA.gender === 'Nam' ? profileA : profileB;
        const femaleProfile = profileA.gender === 'Nữ' ? profileA : profileB;
        const maleId = profileA.gender === 'Nam' ? userIdA : userIdB;
        const femaleId = profileA.gender === 'Nữ' ? userIdA : userIdB;
        const yearMale = parseInt(maleProfile.birthday.split('/')[2], 10);
        const yearFemale = parseInt(femaleProfile.birthday.split('/')[2], 10);
        if (yearMale > yearFemale) {
            matchmakingComment = `Bùa yêu ép buộc phi công trẻ <@${maleId}> lái máy bay bà già <@${femaleId}> hơn ${yearMale - yearFemale} tuổi. Thắt dây an toàn bay vào thiên đường cờ bạc đi! ✈️👩‍👦`;
        }
        else if (yearMale < yearFemale - 4) {
            matchmakingComment = `Bùa yêu dán lên đầu cỏ non <@${femaleId}> bắt dắt tay trâu già <@${maleId}> hơn ${yearFemale - yearMale} tuổi đi trăng mật. Hạnh phúc bạc đầu cúng sòng bạc nhé! 👴🌱`;
        }
        else {
            matchmakingComment = `Bùa yêu tác thành cho <@${maleId}> và <@${femaleId}> khớp lệnh lưỡng tình tương duyệt hoàn hảo. Mau cưới lẹ rồi đẻ con ra nuôi sới bạc cho tao! 👶🎲`;
        }
    }
    const messageA = `🔮 **BÙA YÊU ÉP DUYÊN ĐÃ LINH NGHIỆM!** 🔮\n\nMày đã dùng bùa yêu cưỡng chế khớp lệnh thành công với <@${userIdB}> (\`${profileB.name}\`)!\n\n💬 **Lời phán phong thủy bùa ngải:**\n${matchmakingComment}`;
    const messageB = `🔮 **BÙA YÊU ÉP DUYÊN ĐÃ LINH NGHIỆM!** 🔮\n\nCon giời <@${userIdA}> (\`${profileA.name}\`) đã dùng 500k mua bùa yêu từ BotToan để cưỡng chế khớp lệnh yêu đương với mày!\n\n💬 **Lời phán phong thủy bùa ngải:**\n${matchmakingComment}`;
    let sentA = false;
    let sentB = false;
    try {
        await userA.send(messageA);
        sentA = true;
    }
    catch (err) { }
    try {
        await targetUser.send(messageB);
        sentB = true;
    }
    catch (err) { }
    if (!sentA || !sentB) {
        let responseText = `🔮 **BÙA YÊU ĐÃ LINH NGHIỆM!** Nhưng có đứa khóa DM nên tao đéo gửi tin mật được.\n`;
        if (!sentA && !sentB) {
            responseText += `Cả hai đứa <@${userIdA}> và <@${userIdB}> mở DM ra rồi tao báo cáo chi tiết cho!`;
        }
        else if (!sentA) {
            responseText += `<@${userIdA}> mở khóa DM ra đi cưng!`;
        }
        else {
            responseText += `<@${userIdB}> mở khóa DM ra đi cưng!`;
        }
        await message.reply(responseText).catch(() => { });
    }
    else {
        await message.reply(`🔮 **BÙA YÊU ÉP DUYÊN CỰC MẠNH!**\n<@${userIdA}> đã cúng **500k** dán bùa yêu lên đầu <@${userIdB}> thành công! Hai đứa đã bị cưỡng chế khớp lệnh crush nhau, tao đã gửi tin nhắn riêng báo cáo rồi nhé! 🪄💞`).catch(() => { });
    }
}
// ================= XỬ LÝ LỆNH GIEO QUẺ HÀNG NGÀY =================
async function handleGieoQue(message) {
    const userId = message.author.id;
    if (utils_1.activeGamePlayers.has(userId)) {
        await message.reply("❌ **Mày đang bận việc khác rồi con giời!** Đang chơi game bói toán khác thì xong đi đã chứ!").catch(() => { });
        return;
    }
    utils_1.activeGamePlayers.add(userId);
    try {
        const profile = await (0, database_1.getProfile)(userId);
        if (!profile) {
            await message.reply(`❌ **Mày chưa khai báo lý lịch (profile) bói toán!**\nHãy gõ lệnh sau để tạo hồ sơ trước:\n\`@BotToan profile [Tên] [Nam/Nu] [Ngày/Tháng/Năm Sinh]\``).catch(() => { });
            return;
        }
        profile.birthday = profile.birthday.replace(/\-/g, '/');
        const now = Date.now();
        const todayStr = (0, database_1.getVNDateString)(now);
        // 1. Kiểm tra xem hôm nay gieo quẻ chưa
        const hasGieo = await (0, database_1.hasGieoQueToday)(userId, todayStr);
        if (hasGieo) {
            const d = new Date(now + 7 * 60 * 60 * 1000);
            const vnTomorrow = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
            const timeLeftMs = (vnTomorrow - 7 * 60 * 60 * 1000) - now;
            const hours = Math.floor(timeLeftMs / (60 * 60 * 1000));
            const minutes = Math.floor((timeLeftMs % (60 * 60 * 1000)) / (60 * 1000));
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle("🚫 XIN QUẺ THẤT BẠI - HÔM NAY XEM THẾ ĐỦ RỒI!")
                .setDescription(`⚠️ **Mày đã xin quẻ vận mệnh hôm nay rồi con giời!**\n\nQuy tắc giang hồ mỗi ngày chỉ được xin **1 lượt duy nhất** thôi. Xem lắm quẻ hóa quẻ hung đấy!\nHãy quay lại sau **${hours} giờ ${minutes} phút** nữa nhé!`)
                .setColor(0xFF0000)
                .setFooter({ text: "BotToan - Thầy bói giang hồ", iconURL: message.client.user?.displayAvatarURL() });
            await message.reply({ embeds: [embed] }).catch(() => { });
            return;
        }
        let balance = await (0, database_1.getBalance)(userId);
        const debt = await (0, database_1.getDebt)(userId);
        // Roll quẻ (1 - 100)
        const roll = (0, utils_1.trueRandom)(1, 100);
        let queName = "";
        let queDesc = "";
        let queAction = "";
        let color = 0x00FF00;
        let balanceChange = 0;
        let rewardOrPenaltyText = "";
        let jailNote = "";
        let isJailTriggered = false;
        if (roll <= 10) {
            queName = "🧧 ĐẠI CÁT";
            queDesc = "Cực kỳ cát tường, vận khí ngập trời, thần tài gõ cửa!";
            balanceChange = (0, utils_1.trueRandom)(15, 30);
            queAction = `Nhặt được ví tiền đánh rơi ở sòng blackjack (+${balanceChange}k)`;
            color = 0xFF00FF;
        }
        else if (roll <= 30) {
            queName = "🍊 TRUNG CÁT";
            queDesc = "Khá cát lành, làm việc hanh thông, cờ bạc dễ trúng.";
            balanceChange = (0, utils_1.trueRandom)(5, 15);
            queAction = `Được chiến hữu cùng sòng bài chia lộc (+${balanceChange}k)`;
            color = 0x2ECC71;
        }
        else if (roll <= 50) {
            queName = "🌾 TIỂU CÁT";
            queDesc = "Hơi cát lành, có chút lộc nhỏ ăn sáng.";
            balanceChange = (0, utils_1.trueRandom)(1, 5);
            queAction = `Nhặt được tiền lẻ rơi ven đường đê (+${balanceChange}k)`;
            color = 0x3498DB;
        }
        else if (roll <= 75) {
            queName = "⚖️ BÌNH HÒA";
            queDesc = "Mọi việc bình bình, sóng yên biển lặng, bảo toàn lực lượng.";
            balanceChange = 0;
            queAction = "Vẫn là con nợ nhưng hôm nay không thấy chủ nợ đòi tiền (0k)";
            color = 0x95A5A6;
        }
        else if (roll <= 90) {
            queName = "🍂 TIỂU HUNG";
            queDesc = "Hơi xui xẻo, hao tài tốn của nhẹ, cẩn thận mất đồ.";
            const penalty = (0, utils_1.trueRandom)(1, 10);
            balanceChange = -Math.min(balance, penalty);
            queAction = `Bị giang hồ xin đểu tiền nước hoặc làm rơi tiền (-${Math.abs(balanceChange)}k)`;
            color = 0xE67E22;
        }
        else {
            queName = "☠️ ĐẠI HUNG";
            queDesc = "Vô cùng hung hiểm! Nghiệp quật sấp mặt, tai họa rập rình!";
            const penalty = (0, utils_1.trueRandom)(15, 30);
            balanceChange = -Math.min(balance, penalty);
            queAction = `Bị đàn em giang hồ của BotToan quây chặn đường trấn lột (-${Math.abs(balanceChange)}k)`;
            color = 0xFF0000;
            if (Math.random() < 0.2 && message.guild) {
                isJailTriggered = true;
                jailNote = "\n🚔 **Nghiệp quật tàn bạo:** Bị cảnh sát tóm cổ tống giam 1 phút để cải tạo!";
            }
        }
        balance += balanceChange;
        await (0, database_1.updateBalance)(userId, balance);
        if (balanceChange > 0) {
            rewardOrPenaltyText = `Cộng **$${(0, utils_1.formatMoney)(balanceChange)}**`;
        }
        else if (balanceChange < 0) {
            rewardOrPenaltyText = `Trừ **$${(0, utils_1.formatMoney)(Math.abs(balanceChange))}**`;
        }
        else {
            rewardOrPenaltyText = "Không biến động";
        }
        if ('sendTyping' in message.channel)
            await message.channel.sendTyping().catch(() => { });
        const dobParts = profile.birthday.split('/');
        const solar = lunar_javascript_1.Solar.fromYmd(parseInt(dobParts[2]), parseInt(dobParts[1]), parseInt(dobParts[0]));
        const lunar = solar.getLunar();
        const zodiac = translateShengXiao(lunar.getYearShengXiao());
        const ganChi = translateGanChi(lunar.getYearInGanZhi());
        const menh = translateNaYin(lunar.getYearNaYin());
        const cungPhi = getCungPhi(profile.birthday, profile.gender);
        const luckyNumber = (0, utils_1.trueRandom)(0, 99).toString().padStart(2, '0');
        const loveMeters = [
            "🖤🖤🖤🖤🖤 (Đen như đêm ba mươi, cút ngay kẻo bị lừa tình)",
            "💔💔💔🖤🖤 (Simp lỏ vô vọng, liếm chân người ta cũng đéo cho)",
            "🍻🍻🚬🚬🚬 (Bạn nhậu qua đường, hợp nhau lúc trên sòng cờ bạc)",
            "❤️❤️❤️🖤🖤 (Có tiến triển nhẹ, lo nạp tiền cúng crush đi)",
            "💖💖💖💖💖 (Lưỡng tình tương duyệt, nồi nào úp vung nấy, cưới lẹ)"
        ];
        const loveMeter = loveMeters[Math.floor(roll / 21)];
        let policeMeter = "🟢 Rất an toàn (Không ai thèm bắt)";
        if (roll > 75 && roll <= 90) {
            policeMeter = "🟡 Hơi báo động (Đi xe nhớ đội mũ bảo hiểm)";
        }
        else if (roll > 90) {
            policeMeter = "🔴 CỰC KỲ NGUY HIỂM (SWAT đang rình trước nhà)";
        }
        const geminiPrompt = `
            Hãy phán quẻ xem bói hàng ngày cho người chơi này:
            Họ tên: "${profile.name}"
            Giới tính: "${profile.gender}"
            Tuổi: "${ganChi} (${zodiac})"
            Mệnh ngũ hành: "${menh}"
            Cung Phi Bát Trạch: "${cungPhi.name} (${cungPhi.group})"
            Loại quẻ gieo được hôm nay: "${queName}" (${queDesc})
            Biến động tài sản: "${queAction}"
            Số dư ví: ${balance}k, nợ: ${debt}k.
            
            Hãy đưa ra lời phán vận hạn hôm nay gồm đúng 3 mục sau:
            - 🎰 Vận Đỏ Đen: [phán cực bựa xem đánh con đề nào hay chơi Blackjack/Xóc Đĩa ra sao]
            - 💔 Tình Duyên: [phán cực gắt xem có bị cắm sừng hay làm simp lỏ liếm láp không]
            - 🚔 Tai Ương: [cảnh báo trốn nợ ngân hàng, công an bế đi tù]
            
            Yêu cầu bắt buộc: Viết cực kỳ ngắn gọn, bộc lộ tính cà khịa bựa, hài hước châm biếm sâu cay, xưng mày tao, đúng phong cách thầy bói giang hồ BotToan. Tổng độ dài phản hồi dưới 300 ký tự.
        `;
        let explanation = "";
        try {
            explanation = await (0, gemini_1.getMatchmakingFortune)(geminiPrompt);
        }
        catch (err) {
            console.error("Lỗi Gemini giải quẻ:", err);
            const fallbacks = {
                "🧧 ĐẠI CÁT": "- 🎰 **Vận Đỏ Đen:** Đỏ như đít khỉ! Xuống xác ngay con lô đề hoặc tất tay xóc đĩa đi con giời, thần bài đang độ mày rồi!\n" +
                    "- 💔 **Tình Duyên:** Vận đào hoa nở rộ, đi thả thính dạo không lo bị chửi, nồi nào úp vung nấy.\n" +
                    "- 🚔 **Tai Ương:** Chủ nợ tự động quên tên mày, đi đứng hiên ngang đéo sợ bố con thằng nào bắt bớ!",
                "🍊 TRUNG CÁT": "- 🎰 **Vận Đỏ Đen:** Có chút lộc ăn uống nhẹ. Vào Blackjack kiếm vài ván cơm gạo là có tiền đi ăn lẩu cua đồng.\n" +
                    "- 💔 **Tình Duyên:** Người ta đang chú ý nhẹ, lo nạp thẻ cúng crush lẹ đi kẻo nó đi thích đứa khác.\n" +
                    "- 🚔 **Tai Ương:** Đi đứng cẩn thận không ngã xước cái nịt, cơ bản hôm nay vẫn bình an vô sự.",
                "🌾 TIỂU CÁT": "- 🎰 **Vận Đỏ Đen:** Gặp lộc rơi lộc rụng đủ tiền bao anh em sòng bài uống trà đá. Theo nhẹ tay thôi kẻo sập sới.\n" +
                    "- 💔 **Tình Duyên:** Không bị cắm sừng hay làm simp lỏ ăn bơ đã là phước đức ba đời hôm nay của mày rồi.\n" +
                    "- 🚔 **Tai Ương:** Coi chừng chó dữ đuổi theo đớp rách quần ngoài đê.",
                "⚖️ BÌNH HÒA": "- 🎰 **Vận Đỏ Đen:** Tiền vào cửa trước ra cửa sau, đánh chỉ có hòa hoặc lỗ nhẹ. Cất tiền cờ bạc đi ngủ giùm tao cái!\n" +
                    "- 💔 **Tình Duyên:** Vẫn ế ẩm chỏng chơ như cũ, đéo ai thèm nhìn mặt đâu mà mơ mộng.\n" +
                    "- 🚔 **Tai Ương:** Bình yên đến lạnh sống lưng, không ai thèm đòi nợ cũng chẳng ai thèm rủ rê bài bạc.",
                "🍂 TIỂU HUNG": "- 🎰 **Vận Đỏ Đen:** Đen như mõm chó! Vào blackjack chỉ có bị nhà cái bốc 21 nút đục vỡ mồm, cấm gỡ nợ kẻo ra đê!\n" +
                    "- 💔 **Tình Duyên:** Kiếp simp lỏ cống nạp tiền của mà người ta còn đéo thèm nhìn mặt, đúng là đồ đáng thương.\n" +
                    "- 🚔 **Tai Ương:** Đi xe máy nhớ đội mũ bảo hiểm kẻo công an tóm cổ cúng 200k phạt hành chính.",
                "☠️ ĐẠI HUNG": "- 🎰 **Vận Đỏ Đen:** Nghiệp quật sấp mặt! Đụng vào sới bạc hôm nay là cái nịt cũng đéo còn để mang về.\n" +
                    "- 💔 **Tình Duyên:** Vừa bị cắm sừng vừa bị bồ cuỗm sạch tiền đi theo thằng khác, kiếp Simp Lỏ cay đắng.\n" +
                    "- 🚔 **Tai Ương:** SWAT đang rình rập đột kích sòng bài lôi cổ mày đi tù cải tạo nhân phẩm!"
            };
            explanation = fallbacks[queName] || "Vận mệnh hôm nay mờ mịt, tốt nhất là nằm im góc tối cờ bạc ít thôi cưng!";
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle("🔮 BẢN QUẺ GIANG HỒ HÀNG NGÀY 🔮")
            .setDescription(`Bảng gieo quẻ xem bói vận mệnh của con giời <@${userId}>`)
            .setColor(color)
            .addFields({
            name: "👤 Bản Mệnh Khai Báo",
            value: `• Họ tên: \`${profile.name}\` (${profile.gender})\n• Tuổi: \`${ganChi} (${zodiac})\` | Mệnh: \`${menh}\`\n• Cung Phi: \`${cungPhi.name} (${cungPhi.group})\``,
            inline: false
        }, {
            name: `🔮 Quẻ Gieo Được: ${queName}`,
            value: `• *Vận mệnh:* ${queDesc}\n• *Biến cố:* ${queAction}${jailNote}`,
            inline: false
        }, {
            name: "📈 Chỉ Số Vận Hạn Hôm Nay",
            value: `• 🎯 **Con số thần tài:** \`[ ${luckyNumber} ]\` (Thích lô đề thì quất ngay!)\n• 💘 **Đào Hoa kế:** ${loveMeter}\n• 🚔 **Mức độ an ninh:** \`${policeMeter}\``,
            inline: false
        }, {
            name: "💸 Biến Động Tài Chính Thực Tế",
            value: `• Kết quả: **${rewardOrPenaltyText}**\n• Số dư ví hiện tại: **${(0, utils_1.formatMoney)(balance)}** | Đang nợ: **${(0, utils_1.formatMoney)(debt)}**`,
            inline: false
        }, {
            name: "💬 Lời Sấm Truyền Từ Thầy Bói BotToan",
            value: explanation.trim(),
            inline: false
        })
            .setFooter({ text: "Gõ @BotToan gieo que hàng ngày để xem vận hạn (1 lượt/ngày)", iconURL: message.client.user?.displayAvatarURL() })
            .setTimestamp();
        await message.reply({ embeds: [embed] });
        await (0, database_1.markGieoQueToday)(userId, todayStr);
        if (isJailTriggered && message.guild) {
            setTimeout(async () => {
                try {
                    await (0, utils_1.sendToJail)(message.guild, userId, "Nghiệp quật quẻ Đại Hung!");
                    await (0, database_1.banChat)(userId, 60000);
                    await message.channel.send(`🚔 Đã áp giải khứa <@${userId}> vào Nhà Tù 1 phút vì bốc trúng quẻ **Đại Hung** nghiệp chướng quá nặng!`).catch(() => { });
                }
                catch (err) {
                    console.error("Lỗi tống giam Đại Hung:", err);
                }
            }, 3000);
        }
    }
    catch (error) {
        console.error("Lỗi khi xử lý gieo quẻ:", error);
        await message.reply("❌ **Có lỗi tâm linh xảy ra!** Thầy Toàn bị nghẹn nhang không thể gieo quẻ lúc này, hãy thử lại sau!").catch(() => { });
    }
    finally {
        utils_1.activeGamePlayers.delete(userId);
    }
}
