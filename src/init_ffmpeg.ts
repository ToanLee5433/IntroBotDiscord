import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

// Set timezone cho server
process.env.TZ = 'Asia/Ho_Chi_Minh';
console.log('[INIT] Timezone đã được đặt: Asia/Ho_Chi_Minh');

// Tự động kiểm tra và chuyển đổi tất cả file âm thanh trong /audio sang định dạng OGG Opus chuẩn Discord (OpusHead)
try {
    const ffmpegPath = require('ffmpeg-static');
    const audioDir = path.join(__dirname, '../audio');
    
    if (fs.existsSync(audioDir) && ffmpegPath) {
        const files = fs.readdirSync(audioDir);
        for (const file of files) {
            const ext = path.extname(file).toLowerCase();
            const base = path.basename(file, ext);
            
            if (ext === '.mp3' || ext === '.wav' || ext === '.m4a' || ext === '.ogg') {
                const targetOgg = path.join(audioDir, base + '.ogg');
                const sourceFile = path.join(audioDir, file);
                
                let needsConversion = false;
                
                if (ext === '.ogg') {
                    // Kiểm tra xem OGG có chuẩn OpusHead không
                    try {
                        const buf = fs.readFileSync(sourceFile);
                        const str = buf.toString('utf8', 0, 100);
                        if (!str.includes('OpusHead')) {
                            needsConversion = true; // Là Vorbis hoặc định dạng OGG không phải Opus
                        }
                    } catch (e) {}
                } else if (!fs.existsSync(targetOgg)) {
                    needsConversion = true; // Có file mp3/wav nhưng chưa có file ogg
                }
                
                if (needsConversion) {
                    console.log(`[AUDIO CONVERT] Đang tự động chuyển đổi file ${file} sang OGG Opus chuẩn Discord...`);
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
                        console.log(`[AUDIO CONVERT] ✅ Đã chuyển đổi thành công ${base}.ogg sang chuẩn OGG Opus!`);
                    } else {
                        if (fs.existsSync(tmpOgg)) fs.unlinkSync(tmpOgg);
                        console.error(`[AUDIO CONVERT LỖI] Không thể chuyển đổi ${file}:`, res.stderr?.toString());
                    }
                }
            }
        }
    }
} catch (err) {
    console.error('[AUDIO CONVERT WARNING] Lỗi khi tự động kiểm tra audio:', err);
}
