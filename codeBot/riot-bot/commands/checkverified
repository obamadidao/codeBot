const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const db = require("../db");

// ID Role Verified và ID Role Admin/Hoàng Đế
const VERIFIED_ROLE_ID = "1268608479346823178";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("checkverified")
        .setDescription("Xuất danh sách thành viên có role Verified xem họ đã drop acc chưa (Chỉ Admin)")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // Kiểm tra quyền Admin
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        if (!isAdmin) {
            return interaction.reply({
                content: "❌ Chỉ Admin mới có quyền sử dụng lệnh kiểm tra này!",
                flags: 64
            });
        }

        await interaction.deferReply({ flags: 64 });

        try {
            // Lấy tất cả thành viên trong server về cache
            const members = await interaction.guild.members.fetch();
            
            // Lọc ra các thành viên có role Verified (theo ID hoặc tên "Verified")
            const verifiedMembers = members.filter(m => 
                !m.user.bot && (m.roles.cache.has(VERIFIED_ROLE_ID) || m.roles.cache.some(r => r.name === "Verified"))
            );

            if (verifiedMembers.size === 0) {
                return interaction.editReply({
                    content: "⚠️ Không tìm thấy thành viên nào có role Verified trong máy chủ."
                });
            }

            // Truy vấn danh sách số lượng acc mỗi user đóng góp từ Database
            db.all("SELECT createdBy, COUNT(*) as totalAcc FROM accounts GROUP BY createdBy", [], async (err, rows) => {
                if (err) {
                    console.error("❌ Lỗi DB khi check verified:", err);
                    return interaction.editReply({ content: "❌ Lỗi truy vấn cơ sở dữ liệu!" });
                }

                // Map lưu ID user -> Số lượng acc đã tạo
                const accMap = new Map();
                if (rows && rows.length > 0) {
                    rows.forEach(r => accMap.set(r.createdBy, r.totalAcc));
                }

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
            });

        } catch (error) {
            console.error("❌ Lỗi khi thực thi checkverified:", error);
            return interaction.editReply({ content: "❌ Gặp sự cố khi quét danh sách thành viên!" });
        }
    }
};
