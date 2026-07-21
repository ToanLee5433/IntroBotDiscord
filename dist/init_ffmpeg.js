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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ffmpeg_static_1 = __importDefault(require("ffmpeg-static"));
const fs = __importStar(require("fs"));
const prism_media_1 = __importDefault(require("prism-media"));
process.env.TZ = 'Asia/Ho_Chi_Minh';
const resolvedPath = typeof ffmpeg_static_1.default === 'string'
    ? ffmpeg_static_1.default
    : ffmpeg_static_1.default?.default || ffmpeg_static_1.default?.path || require('ffmpeg-static');
const ffmpegExec = typeof resolvedPath === 'string' ? resolvedPath : resolvedPath?.path || String(resolvedPath);
if (ffmpegExec && fs.existsSync(ffmpegExec)) {
    try {
        fs.chmodSync(ffmpegExec, 0o777);
    }
    catch (e) { }
    process.env.FFMPEG_PATH = ffmpegExec;
    console.log(`[FFMPEG] Đã nạp thành công và cấp quyền 777 cho FFmpeg: ${ffmpegExec}`);
}
// Ép đè trực tiếp getInfo() của prism-media để triệt tiêu vĩnh viễn lỗi "FFmpeg/avconv not found!"
try {
    if (prism_media_1.default && prism_media_1.default.FFmpeg) {
        prism_media_1.default.FFmpeg.getInfo = (force) => {
            return {
                command: ffmpegExec,
                output: 'ffmpeg-static-override'
            };
        };
        console.log(`[FFMPEG] Đã liên kết trực tiếp FFmpeg vào prism-media!`);
    }
}
catch (err) {
    console.error("[FFMPEG] Lỗi gán prism-media:", err);
}
