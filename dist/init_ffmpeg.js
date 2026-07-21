"use strict";
// Set timezone cho server
process.env.TZ = 'Asia/Ho_Chi_Minh';
// Không cần FFmpeg - tất cả audio đã được chuyển sang OGG Opus (StreamType.OggOpus)
// OGG Opus được @discordjs/voice đọc trực tiếp mà không cần FFmpeg
console.log('[INIT] Timezone đã được đặt: Asia/Ho_Chi_Minh');
