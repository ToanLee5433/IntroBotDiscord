import ffmpegPath from 'ffmpeg-static';
import * as fs from 'fs';

process.env.TZ = 'Asia/Ho_Chi_Minh';

const ffmpegExec = typeof ffmpegPath === 'string' ? ffmpegPath : (ffmpegPath as any)?.default || require('ffmpeg-static');
if (ffmpegExec && typeof ffmpegExec === 'string') {
    process.env.FFMPEG_PATH = ffmpegExec;
    try {
        fs.chmodSync(ffmpegExec, 0o755);
    } catch (e) {}
    console.log(`[FFMPEG] Đã nạp đường dẫn FFmpeg trước mọi module: ${ffmpegExec}`);
}
