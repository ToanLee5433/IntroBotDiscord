"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleLixi = handleLixi;
const discord_js_1 = require("discord.js");
const database_1 = require("../database");
const utils_1 = require("../utils");
function generateLixiCuts(totalAmount, peopleCount) {
    const cuts = [];
    let remainingAmount = totalAmount;
    let remainingPeople = peopleCount;
    for (let i = 0; i < peopleCount - 1; i++) {
        // Đảm bảo mỗi phần tối thiểu là 1k
        const maxLimit = remainingAmount - remainingPeople + 1;
        // Áp dụng Double Average: giới hạn ngẫu nhiên = (tiền_còn_lại / người_còn_lại) * 2
        const doubleAverage = Math.max(1, Math.floor((remainingAmount / remainingPeople) * 2));
        const limit = Math.min(maxLimit, doubleAverage);
        const cut = Math.floor(Math.random() * limit) + 1;
        cuts.push(cut);
        remainingAmount -= cut;
        remainingPeople--;
    }
    cuts.push(remainingAmount); // Người cuối nhận phần còn lại
    // Trộn ngẫu nhiên mảng cuts để vị trí nhận tiền là bất ngờ
    return cuts.sort(() => Math.random() - 0.5);
}
/**
 * Xử lý tạo bao Lì Xì phát cho server
 */
async function handleLixi(message, amount, maxPeople) {
    const senderId = message.author.id;
    if (amount <= 0 || maxPeople <= 0) {
        await message.reply("❌ Cú pháp sai rồi! Số tiền và số người nhận lì xì phải lớn hơn 0.");
        return;
    }
    if (maxPeople > 20) {
        await message.reply("❌ Đông quá mày ơi! Tối đa chỉ phát lì xì cho 20 người thôi để còn chia đều.");
        return;
    }
    // Kiểm tra ví người phát
    let senderBalance = await (0, database_1.getBalance)(senderId);
    if (senderBalance < amount) {
        await message.reply(`❌ **ĐÉO ĐỦ TIỀN SĨ DIỆN!** Mày chỉ còn **${(0, utils_1.formatMoney)(senderBalance)}**, đéo đủ để phát lì xì **${(0, utils_1.formatMoney)(amount)}**.`);
        return;
    }
    // Trừ tiền người phát
    senderBalance -= amount;
    await (0, database_1.updateBalance)(senderId, senderBalance);
    // Sinh các phần lì xì
    const cuts = generateLixiCuts(amount, maxPeople);
    // Lưu vết người đã giật
    const grabbedUsers = [];
    let isGrabbing = false; // Lock chống race condition: 2 người bấm cùng lúc pop cùng 1 phần
    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId('lx_giat').setLabel('🧧 Giật Lì Xì').setStyle(discord_js_1.ButtonStyle.Danger));
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle("🧧 BAO LÌ XÌ MAY MẮN CỦA ĐẠI GIA")
        .setDescription(`Đại gia <@${senderId}> vừa thả một bao lì xì trị giá **${(0, utils_1.formatMoney)(amount)}** cho **${maxPeople} người** giật nhanh nhất!\n\n👇 Bấm nút màu đỏ bên dưới để giật lì xì!`)
        .setColor(0xFF4500)
        .setThumbnail("https://images.unsplash.com/photo-1590073844006-33379778ae09?auto=format&fit=crop&q=80&w=200") // Ảnh đỏ tượng trưng lì xì
        .setFooter({ text: `Tổng số tiền: ${(0, utils_1.formatMoney)(amount)} | Tổng số phần: ${maxPeople}` });
    if (!('send' in message.channel))
        return;
    const lixiMsg = await message.channel.send({ embeds: [embed], components: [row] });
    const collector = lixiMsg.createMessageComponentCollector({ componentType: discord_js_1.ComponentType.Button, time: 180000 }); // Lì xì tồn tại trong 3 phút
    collector.on('collect', async (i) => {
        if (i.customId !== 'lx_giat')
            return;
        const userId = i.user.id;
        // Chặn người phát tự giật lì xì của mình
        if (userId === senderId) {
            await i.reply({ content: "Mày là đại gia phát lì xì mà đi giật lại là sao? Nhường cho đàn em đi!", ephemeral: true }).catch(() => { });
            return;
        }
        // Chặn concurrent grab — 2 người bấm cùng lúc
        if (isGrabbing) {
            await i.reply({ content: "🚦 Ơ bấm nhanh quá! Chờ tí đợi người trước lấy xong đã con!", ephemeral: true }).catch(() => { });
            return;
        }
        // Kiểm tra xem đã giật chưa
        if (grabbedUsers.some(u => u.userId === userId)) {
            await i.reply({ content: "Mày giật một lần rồi, tham lam vừa thôi nhường cho đứa khác nữa!", ephemeral: true }).catch(() => { });
            return;
        }
        isGrabbing = true;
        try {
            // Lấy phần lì xì ra
            const grabAmount = cuts.pop();
            if (grabAmount === undefined) {
                await i.reply({ content: "Bao lì xì đã được giật hết sạch rồi con ạ, chậm chân rồi!", ephemeral: true }).catch(() => { });
                collector.stop();
                return;
            }
            // Cộng tiền cho người giật
            let userBalance = await (0, database_1.getBalance)(userId);
            userBalance += grabAmount;
            await (0, database_1.updateBalance)(userId, userBalance);
            grabbedUsers.push({ userId, amount: grabAmount });
            // Cập nhật Embed danh sách người đã giật
            const listText = grabbedUsers.map((u, idx) => `**${idx + 1}.** <@${u.userId}> đã cướp được **${(0, utils_1.formatMoney)(u.amount)}**`).join("\n");
            const updatedEmbed = discord_js_1.EmbedBuilder.from(embed)
                .setDescription(`Đại gia <@${senderId}> vừa thả bao lì xì trị giá **${(0, utils_1.formatMoney)(amount)}**!\nSố phần còn lại: **${cuts.length} / ${maxPeople}**\n\n👥 **Danh sách cướp được:**\n${listText}`);
            await i.reply({ content: `🧧 Mày đã giật được **${(0, utils_1.formatMoney)(grabAmount)}**!`, ephemeral: true }).catch(() => { });
            if (cuts.length === 0) {
                collector.stop();
            }
            else {
                await lixiMsg.edit({ embeds: [updatedEmbed] }).catch(() => { });
            }
        }
        finally {
            isGrabbing = false;
        }
    });
    collector.on('end', async () => {
        // Hủy nút bấm
        await lixiMsg.edit({ components: [] }).catch(() => { });
        const listText = grabbedUsers.length > 0
            ? grabbedUsers.map((u, idx) => `**${idx + 1}.** <@${u.userId}> đã cướp được **${(0, utils_1.formatMoney)(u.amount)}**`).join("\n")
            : "*Không có ai giật lì xì.*";
        let finalDesc = `💰 **Bao lì xì đã kết thúc!**\n\n👥 **Kết quả cướp giật:**\n${listText}`;
        // Kiểm tra xem còn dư phần lì xì nào không để hoàn trả tiền
        if (cuts.length > 0) {
            const refundAmount = cuts.reduce((sum, cut) => sum + cut, 0);
            let currentSenderBal = await (0, database_1.getBalance)(senderId);
            currentSenderBal += refundAmount;
            await (0, database_1.updateBalance)(senderId, currentSenderBal);
            finalDesc += `\n\n🔄 **Hoàn trả:** Do hết thời gian 3 phút nhưng còn dư **${cuts.length} phần**, hệ thống đã hoàn trả lại **${(0, utils_1.formatMoney)(refundAmount)}** vào ví của đại gia <@${senderId}>.`;
        }
        // Tìm người cướp được nhiều nhất và ít nhất để vinh danh/chia buồn
        if (grabbedUsers.length > 0) {
            const sortedUsers = [...grabbedUsers].sort((a, b) => b.amount - a.amount);
            const luckyUser = sortedUsers[0];
            const unluckyUser = sortedUsers[sortedUsers.length - 1];
            finalDesc += `\n\n🏆 **Bàn tay vàng:** <@${luckyUser.userId}> húp nhiều nhất với **${(0, utils_1.formatMoney)(luckyUser.amount)}**.\n💩 **Bàn tay thối:** <@${unluckyUser.userId}> ăn quả tạ nhặt được ít nhất chỉ **${(0, utils_1.formatMoney)(unluckyUser.amount)}**.`;
        }
        const finalEmbed = new discord_js_1.EmbedBuilder()
            .setTitle("🧧 TỔNG KẾT BAO LÌ XÌ")
            .setDescription(finalDesc)
            .setColor(0x34495E)
            .setFooter({ text: "BotToan - Sòng bạc hoàng gia" });
        await lixiMsg.edit({ embeds: [finalEmbed] }).catch(() => { });
    });
}
