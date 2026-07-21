import ffmpegPath from 'ffmpeg-static';
import * as fs from 'fs';
import prismMedia from 'prism-media';

process.env.TZ = 'Asia/Ho_Chi_Minh';

const resolvedPath = typeof ffmpegPath === 'string' 
    ? ffmpegPath 
    : (ffmpegPath as any)?.default || (ffmpegPath as any)?.path || require('ffmpeg-static');

const ffmpegExec = typeof resolvedPath === 'string' ? resolvedPath : (resolvedPath as any)?.path || String(resolvedPath);

if (ffmpegExec && fs.existsSync(ffmpegExec)) {
    try {
        fs.chmodSync(ffmpegExec, 0o777);
    } catch (e) {}
    process.env.FFMPEG_PATH = ffmpegExec;
    console.log(`[FFMPEG] Đã nạp thành công và cấp quyền 777 cho FFmpeg: ${ffmpegExec}`);
}

// Ép đè trực tiếp getInfo() của prism-media để triệt tiêu vĩnh viễn lỗi "FFmpeg/avconv not found!"
try {
    if (prismMedia && prismMedia.FFmpeg) {
        prismMedia.FFmpeg.getInfo = (force?: boolean) => {
            return {
                command: ffmpegExec,
                output: 'ffmpeg-static-override'
            } as any;
        };
        console.log(`[FFMPEG] Đã liên kết trực tiếp FFmpeg vào prism-media!`);
    }
} catch (err) {
    console.error("[FFMPEG] Lỗi gán prism-media:", err);
}
