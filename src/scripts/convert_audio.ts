import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

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
            } catch (e) {}
        } else if (!fs.existsSync(targetOgg)) {
            needsConversion = true;
        }

        if (needsConversion) {
            console.log(`[AUDIO CONVERT] Đang chuyển đổi ${file} -> ${base}.ogg (OpusHead)...`);
            const tmpOgg = path.join(audioDir, `${base}_tmp.ogg`);
            const res = spawnSync(ffmpegPath, [
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
            } else {
                if (fs.existsSync(tmpOgg)) fs.unlinkSync(tmpOgg);
                console.error(`[AUDIO CONVERT LỖI] Không thể chuyển đổi ${file}:`, res.stderr?.toString());
            }
        }
    }
}

console.log(`[AUDIO CONVERT] Hoàn tất! Đã chuyển đổi ${convertedCount} file.`);
