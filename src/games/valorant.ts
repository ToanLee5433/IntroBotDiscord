import { Message, ComponentType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { fullAgentsByRole, agentIcons } from '../config';

interface DraftSession {
    currentDraft: string[];
    agentPool: { [key: string]: string[] };
    isDrafting: boolean;
    currentRole: string;
    currentAgent: string;
}

// Cô lập phiên draft động theo channelId để hỗ trợ nhiều kênh chat hoạt động song song
const draftSessions = new Map<string, DraftSession>();

/**
 * Bắt đầu tiến trình Draft đội hình Valorant
 */
export async function playValorantDraft(message: Message) {
    const channelId = message.channelId;
    
    let session = draftSessions.get(channelId);
    if (session && session.isDrafting) {
        await message.reply("Đang pick dở kìa, tập trung chốt đi mày!");
        return;
    }

    session = {
        isDrafting: true,
        currentDraft: [],
        agentPool: {
            "Duelist": [...fullAgentsByRole["Duelist"]],
            "Initiator": [...fullAgentsByRole["Initiator"]],
            "Controller": [...fullAgentsByRole["Controller"]],
            "Sentinel": [...fullAgentsByRole["Sentinel"]]
        },
        currentRole: "",
        currentAgent: ""
    };
    draftSessions.set(channelId, session);

    const draftMsg = await message.reply("🎲 **Bắt đầu Draft Team Valorant! Đang thiết lập bàn quay...**");
    const collector = draftMsg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 300000 }); 

    const showRoleMenu = async (interaction?: any) => {
        const s = draftSessions.get(channelId);
        if (!s) return;

        const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('r_duelist').setLabel('⚔️ Duelist').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('r_initiator').setLabel('👁️ Initiator').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('r_controller').setLabel('💨 Controller').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('r_sentinel').setLabel('🛡️ Sentinel').setStyle(ButtonStyle.Primary)
        );
        const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('r_random').setLabel('🎲 Random Role').setStyle(ButtonStyle.Success)
        );

        const teamText = s.currentDraft.length > 0 ? s.currentDraft.map((v, i) => `**${i + 1}.** ${v}`).join('\n') : "*Chưa có thành viên nào*";

        const embed = new EmbedBuilder()
            .setTitle("🎯 BÀN DRAFT ĐỘI HÌNH VALORANT")
            .setColor(0x00AE86)
            .setDescription(`Chọn vai trò (Role) cho vị trí thứ **${s.currentDraft.length + 1}** trong đội hình:`)
            .addFields({ name: "👥 Đội hình hiện tại", value: teamText, inline: false })
            .setFooter({ text: "Sử dụng các nút bên dưới để chọn" });

        if (interaction) await interaction.update({ embeds: [embed], components: [row1, row2] }).catch(()=>{});
        else await draftMsg.edit({ content: "", embeds: [embed], components: [row1, row2] }).catch(()=>{});
    };

    const rollAgent = async (role: string, interaction: any) => {
        const s = draftSessions.get(channelId);
        if (!s) return;

        if (!s.agentPool[role] || s.agentPool[role].length === 0) {
            s.agentPool[role] = [...fullAgentsByRole[role]];
        }
        s.currentRole = role;
        
        const randomIndex = Math.floor(Math.random() * s.agentPool[role].length);
        s.currentAgent = s.agentPool[role][randomIndex];

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('a_chot').setLabel('✅ Chốt luôn').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('a_doi').setLabel('🔄 Bốc con khác').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('a_back').setLabel('🔙 Quay lại Role').setStyle(ButtonStyle.Secondary)
        );

        const iconUrl = agentIcons.get(s.currentAgent.toLowerCase().trim()) || "";

        const teamText = s.currentDraft.length > 0 ? s.currentDraft.map((v, i) => `**${i + 1}.** ${v}`).join('\n') : "*Chưa có thành viên nào*";

        const embed = new EmbedBuilder()
            .setTitle(`🎭 LƯỢT QUAY TƯỚNG: ${s.currentAgent.toUpperCase()}`)
            .setColor(0xFF4654)
            .setDescription(`Vị trí thứ **${s.currentDraft.length + 1}** (${s.currentRole}) bốc trúng con **${s.currentAgent}**!\nMày chốt luôn hay chê?`)
            .addFields({ name: "👥 Đội hình hiện tại", value: teamText, inline: false })
            .setFooter({ text: "BotToan - Sòng bạc hoàng gia" });

        if (iconUrl) {
            embed.setThumbnail(iconUrl);
        }

        await interaction.update({ embeds: [embed], components: [row] }).catch(()=>{});
    };

    collector.on('collect', async i => {
        const s = draftSessions.get(channelId);
        if (!s) return;

        const id = i.customId;
        
        if (id.startsWith('r_')) {
            let role = id.split('_')[1];
            if (role === 'random') {
                const roles = ["Duelist", "Initiator", "Controller", "Sentinel"];
                role = roles[Math.floor(Math.random() * roles.length)];
            } else {
                role = role.charAt(0).toUpperCase() + role.slice(1); 
            }
            await rollAgent(role, i);
        } 
        else if (id === 'a_chot') {
            s.currentDraft.push(`${s.currentAgent} (${s.currentRole})`);
            s.agentPool[s.currentRole] = s.agentPool[s.currentRole].filter(a => a !== s.currentAgent); 
            
            if (s.currentDraft.length === 5) {
                const teamText = s.currentDraft.map((v, idx) => `**${idx + 1}.** ${v}`).join('\n');
                
                const finalEmbed = new EmbedBuilder()
                    .setTitle("🏆 ĐỘI HÌNH HỦY DIỆT CHỐT XONG 🏆")
                    .setColor(0x00FF00)
                    .setDescription(`Đội hình ra sân chính thức:\n\n${teamText}\n\n*Chuẩn bị vào game và huỷ diệt phòng đấu thôi các con giời!*`)
                    .setFooter({ text: "BotToan - Sòng bạc hoàng gia" });

                await i.update({ embeds: [finalEmbed], components: [] }).catch(()=>{});
                draftSessions.delete(channelId);
                collector.stop();
            } else {
                await showRoleMenu(i); 
            }
        } 
        else if (id === 'a_doi') {
            s.agentPool[s.currentRole] = s.agentPool[s.currentRole].filter(a => a !== s.currentAgent); 
            await rollAgent(s.currentRole, i); 
        } 
        else if (id === 'a_back') {
            await showRoleMenu(i); 
        }
    });

    collector.on('end', collected => {
        const s = draftSessions.get(channelId);
        if (s && s.isDrafting) {
            draftSessions.delete(channelId);
            draftMsg.reply("Ngâm lâu quá đéo ai bấm, tao tự hủy bàn draft nhé!").catch(()=>{});
        }
        draftMsg.edit({ components: [] }).catch(()=>{});
    });

    await showRoleMenu();
}
