const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const db = require("../db");

// ID Role Verified và ID Role Admin
const VERIFIED_ROLE_ID = "1268608479346823178";
const ADMIN_ROLE_ID = "1206317832674086944"; // ID Role Admin của máy chủ

// Hàm bọc DB Query bằng Promise để sử dụng async/await mượt mà
function getAccCounts() {
    return new Promise((resolve, reject) => {
        db.all("SELECT createdBy, COUNT(*) as totalAcc FROM accounts GROUP BY createdBy", [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("checkverified")
        .setDescription("Xuất danh sách thành viên có role Verified xem họ đã drop acc chưa (Chỉ Admin)"),
        // Đã bỏ .setDefaultMemberPermissions để lệnh luôn hiển thị trên giao diện Discord cho tất cả mọi người

    async execute(interaction) {
        // Kiểm tra xem User gọi lệnh có Role Admin HOẶC có quyền Administrator hay không
        const hasAdminRole = interaction.member.roles.cache.has(ADMIN_ROLE_ID);
        const hasAdminPermission = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

        if (!hasAdminRole && !hasAdminPermission) {
            return interaction.reply({
                content: `❌ Chỉ thành viên có vai trò <@&${ADMIN_ROLE_ID}> hoặc Admin mới có quyền sử dụng lệnh này!`,
                flags: 64
            });
        }

        await interaction.deferReply({ flags: 64 });

        try {
            // Fetch toàn bộ thành viên server
            const members = await interaction.guild.members.fetch();
            
            // Lọc các thành viên có role Verified
            const verifiedMembers = members.filter(m => 
                !m.user.bot && (m.roles.cache.has(VERIFIED_ROLE_ID) || m.roles.cache.some(r => r.name === "Verified"))
            );

            if (verifiedMembers.size === 0) {
                return interaction.editReply({
                    content: "⚠️ Không tìm thấy thành viên nào có role Verified trong máy chủ."
                });
            }

            // Truy vấn database bằng await
            const rows = await getAccCounts();
            const accMap = new Map();
            rows.forEach(r => accMap.set(r.createdBy, r.totalAcc));

            const hasDropped = [];
            const notDropped = [];

            verifiedMembers.forEach(member => {
                const count = accMap.get(member.id) || 0;
                if (count > 0) {
                    hasDropped.push(`• <@${member.id}> (\`${member.user.tag}\`) - **${count} acc**`);
                } else {
                    notDropped.push(`• <@${member.id}> (\`${member.user.tag}\`)`);
                }
            });

            const embed = new EmbedBuilder()
                .setTitle("📊 BÁO CÁO TÌNH TRẠNG DROP ACC - ROLE VERIFIED")
                .setColor(0x00AE8D)
                .setTimestamp()
                .addFields(
                    {
                        name: `🔴 Chưa drop acc / Đã xóa hết acc (${notDropped.length} người) - NÊN THU HỒI ROLE:`,
                        value: notDropped.length > 0 ? notDropped.slice(0, 30).join("\n") + (notDropped.length > 30 ? `\n*...và ${notDropped.length - 30} người khác*` : "") : "✅ Tất cả đều đã drop acc!"
                    },
                    {
                        name: `🟢 Đã drop acc hợp lệ (${hasDropped.length} người):`,
                        value: hasDropped.length > 0 ? hasDropped.slice(0, 30).join("\n") + (hasDropped.length > 30 ? `\n*...và ${hasDropped.length - 30} người khác*` : "") : "❌ Chưa có ai drop acc nào!"
                    }
                );

            return interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error("❌ Lỗi khi thực thi checkverified:", error);
            return interaction.editReply({ content: "❌ Gặp sự cố khi quét danh sách thành viên!" });
        }
    }
};
