const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const db = require("../db");

// ID của Role Verified quy định điều kiện để được add hộ thành viên
const VERIFIED_ROLE_ID = "1268608479346823178";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("addaccho")
        .setDescription("Thêm tài khoản hộ thành viên khác (Chỉ dành cho Admin)")
        // Cấu hình Discord chỉ hiển thị lệnh này cho người có quyền Administrator
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName("taikhoan")
                .setDescription("Tài khoản")
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName("matkhau")
                .setDescription("Mật khẩu")
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName("username") // Option dự phòng cũ
                .setDescription("Username cũ")
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName("password") // Option dự phòng cũ
                .setDescription("Password cũ")
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName("rank")
                .setDescription("Rank của tài khoản")
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName("ingameid")
                .setDescription("ID in-game")
                .setRequired(true)
        )
        .addUserOption(option =>
            option.setName("target_user")
                .setDescription("Thành viên được thêm hộ (Bắt buộc phải có role Verified)")
                .setRequired(true) // Bắt buộc nhập đối với lệnh add hộ này
        ),

    async execute(interaction) {
        const taikhoan =
            interaction.options.getString("taikhoan") ||
            interaction.options.getString("username");

        const matkhau =
            interaction.options.getString("matkhau") ||
            interaction.options.getString("password");

        const rank = interaction.options.getString("rank");
        const ingameId = interaction.options.getString("ingameid");
        const targetUser = interaction.options.getUser("target_user");

        // Kiểm tra quyền Administrator tầng sâu ở Code để đảm bảo tuyệt đối an toàn
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        if (!isAdmin) {
            return interaction.reply({
                content: "❌ Bạn không có quyền Administrator để sử dụng chức năng thêm tài khoản hộ người khác!",
                flags: 64
            });
        }

        if (!taikhoan || !matkhau) {
            return interaction.reply({
                content: "❌ Thiếu thông tin tài khoản hoặc mật khẩu.",
                flags: 64
            });
        }

        const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        if (!targetMember) {
            return interaction.reply({
                content: "❌ Không tìm thấy thành viên được chọn trong máy chủ này.",
                flags: 64
            });
        }

        // Kiểm tra role Verified (Dựa vào ID: 1268608479346823178 hoặc tên role là Verified)
        const hasVerified = targetMember.roles.cache.has(VERIFIED_ROLE_ID) || 
                            targetMember.roles.cache.some(r => r.name === "Verified");

        if (!hasVerified) {
            return interaction.reply({
                content: `❌ Thao tác thất bại! Thành viên <@${targetUser.id}> chưa có role **Verified** nên không đủ điều kiện để nhận tài khoản thêm hộ.`,
                flags: 64
            });
        }

        const ownerId = targetUser.id;

        db.run(
            `INSERT INTO accounts
            (taikhoan, matkhau, rank, ingameName, createdBy)
            VALUES (?, ?, ?, ?, ?)`,
            [
                taikhoan,
                matkhau,
                rank,
                ingameId,
                ownerId
            ],
            function (err) {
                if (err) {
                    console.log("ADD HO ERROR:", err);
                    return interaction.reply({
                        content: "❌ Gặp sự cố kết nối Database khi lưu tài khoản thêm hộ.",
                        flags: 64
                    });
                }

                db.get(
                    "SELECT * FROM accounts WHERE id = ?",
                    [this.lastID],
                    (e, row) => {
                        console.log("========== NEW ACCOUNT DIRECTORY (ADD HO) ==========");
                        console.log(JSON.stringify(row, null, 2));
                        console.log("====================================================");
                    }
                );

                return interaction.reply({
                    content: `✅ Đã thêm hộ tài khoản thành công cho <@${ownerId}>\n\n🆔 IG: **${ingameId}**\n🏆 Rank: **${rank}**\n👤 Tài khoản: \`${taikhoan}\`\n🔐 Mật khẩu: \`${matkhau}\`\n\n*Hệ thống đã ghi nhận quyền sở hữu cho <@${ownerId}> (Họ có toàn quyền tự sửa bằng lệnh \`/editacc\`, tự xóa bằng lệnh \`/delacc\` và tự động được mở khóa mượn tài khoản).*`,
                    flags: 64
                });
            }
        );
    }
};
