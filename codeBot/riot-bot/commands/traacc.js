const { SlashCommandBuilder } = require("discord.js");
const db = require("../db");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("traacc")
        .setDescription("Trả lại tài khoản đang mượn"),

    async execute(interaction) {
        // Trả lời ẩn (Ephemeral) tạm thời để tránh lỗi timeout 3 giây của Discord
        await interaction.deferReply({ ephemeral: true });

        // Lấy thông tin các tài khoản đang mượn của thành viên này
        db.all(
            "SELECT * FROM accounts WHERE borrowedBy = ?",
            [interaction.user.id],
            async (err, rows) => {
                if (err) {
                    console.error("❌ Lỗi DB khi kiểm tra trả tài khoản:", err);
                    return interaction.editReply({
                        content: "❌ Gặp sự cố kết nối với Database khi kiểm tra tài khoản!"
                    });
                }

                if (!rows || rows.length === 0) {
                    return interaction.editReply({
                        content: "❌ Bạn hiện tại không mượn bất kỳ tài khoản nào trên hệ thống."
                    });
                }

                // Thực hiện cập nhật trả tài khoản trong cơ sở dữ liệu
                db.run(
                    `
                    UPDATE accounts
                    SET
                        isBorrowed = 0,
                        borrowedBy = NULL,
                        borrowTime = NULL
                    WHERE borrowedBy = ?
                    `,
                    [interaction.user.id],
                    async (updateErr) => {
                        if (updateErr) {
                            console.error("❌ Lỗi cập nhật trả tài khoản trong DB:", updateErr);
                            return interaction.editReply({
                                content: "❌ Gặp sự cố khi thực hiện cập nhật trả tài khoản vào DB!"
                            });
                        }

                        // Gửi phản hồi thành công riêng tư cho người dùng
                        await interaction.editReply({
                            content: "✅ Bạn đã hoàn trả thành công tất cả tài khoản đang mượn!"
                        });

                        // 🟢 TỐI ƯU KÊNH NHẬT KÝ: Kết hợp tìm kiếm Cache và Fetch để chống lỗi rỗng Cache Discord
                        try {
                            const logChannel = interaction.guild.channels.cache.get("1345689852804464652")
                                || await interaction.guild.channels.fetch("1345689852804464652").catch(() => null);

                            if (logChannel && logChannel.isTextBased()) {
                                // Quét danh sách tài khoản vừa trả để gửi thông báo chi tiết
                                for (const acc of rows) {
                                    await logChannel.send(
`📤 **[TRẢ TÀI KHOẢN]**

👤 Người trả: <@${interaction.user.id}>
🆔 IG: **${acc.ingameName || "N/A"}**
⏱️ Thời gian trả: <t:${Math.floor(Date.now() / 1000)}:F>
───────────────────`
                                    ).catch(() => null);
                                }
                            }
                        } catch (discordErr) {
                            console.error("❌ Lỗi khi gửi nhật ký trả tài khoản lên Discord:", discordErr);
                        }
                    }
                );
            }
        );
    }
};
