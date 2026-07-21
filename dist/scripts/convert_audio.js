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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const ffmpegPath = require('ffmpeg-static');
const audioDir = path.join(__dirname, '../../audio');
console.log('[AUDIO CONVERT] Đang quét thư mục audio...');
if (!fs.existsSync(audioDir)) {
    console.error('[AUDIO CONVERT LỖI] Thư mục audio không tồn tại!');
    process.exit(1);
}
const files = fs.readdirSync(audioDir);
let convertedCount = 0;
for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const base = path.basename(file, ext);
    if (ext === '.mp3' || ext === '.wav' || ext === '.m4a' || ext === '.ogg') {
        const targetOgg = path.join(audioDir, base + '.ogg');
        const sourceFile = path.join(audioDir, file);
        let needsConversion = false;
        if (ext === '.ogg') {
            try {
                const buf = fs.readFileSync(sourceFile);
                const str = buf.toString('utf8', 0, 100);
                if (!str.includes('OpusHead')) {
                    needsConversion = true;
                }
            }
            catch (e) { }
        }
        else if (!fs.existsSync(targetOgg)) {
            needsConversion = true;
        }
        if (needsConversion) {
            console.log(`[AUDIO CONVERT] Đang chuyển đổi ${file} -> ${base}.ogg (OpusHead)...`);
            const tmpOgg = path.join(audioDir, `${base}_tmp.ogg`);
            const res = (0, child_process_1.spawnSync)(ffmpegPath, [
                '-y',
                '-i', sourceFile,
                '-c:a', 'libopus',
                '-b:a', '96k',
                '-ar', '48000',
                '-ac', '2',
                tmpOgg
            ]);
            if (res.status === 0 && fs.existsSync(tmpOgg)) {
                fs.renameSync(tmpOgg, targetOgg);
                console.log(`[AUDIO CONVERT] ✅ Đã chuyển đổi thành công: ${base}.ogg`);
                convertedCount++;
            }
            else {
                if (fs.existsSync(tmpOgg))
                    fs.unlinkSync(tmpOgg);
                console.error(`[AUDIO CONVERT LỖI] Không thể chuyển đổi ${file}:`, res.stderr?.toString());
            }
        }
    }
}
console.log(`[AUDIO CONVERT] Hoàn tất! Đã chuyển đổi ${convertedCount} file.`);
