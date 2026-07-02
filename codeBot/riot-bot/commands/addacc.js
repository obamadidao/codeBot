const { SlashCommandBuilder } = require("discord.js");
const db = require("../db");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("addacc")
        .setDescription("Thêm acc mới")
        .addStringOption(option =>
            option.setName("taikhoan")
                .setDescription("Tài khoản")
                .setRequired(false) // Cho phép optional để tránh lỗi slash cache cũ
        )
        .addStringOption(option =>
            option.setName("matkhau")
                .setDescription("Mật khẩu")
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName("username") // Giữ lại để backup
                .setDescription("Username cũ")
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName("password") // Giữ lại để backup
                .setDescription("Password cũ")
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName("rank")
                .setDescription("Rank")
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName("ingameid")
                .setDescription("ID in-game")
                .setRequired(true)
        )
        .addUserOption(option =>
            option.setName("target_user")
                .setDescription("Thành viên được thêm hộ (Chỉ dành cho Admin)")
                .setRequired(false)
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

        // Mặc định người sở hữu tài khoản là người thực thi lệnh
        let ownerId = interaction.user.id;
        let isAddHo = false;

        // XỬ LÝ CHỨC NĂNG THÊM HỘ DÀNH CHO ADMIN
        if (targetUser) {
            const isAdmin = interaction.member.permissions.has("Administrator");
            if (!isAdmin) {
                return interaction.reply({
                    content: "❌ Bạn không có quyền Administrator để sử dụng chức năng thêm tài khoản hộ người khác!",
                    flags: 64
                });
            }

            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            if (!targetMember) {
                return interaction.reply({
                    content: "❌ Không tìm thấy thành viên được chọn trong server này.",
                    flags: 64
                });
            }

            // Kiểm tra role Verified (ID: 1268608479346823178 hoặc tên role là Verified)
            const VERIFIED_ROLE_ID = "1268608479346823178";
            const hasVerified = targetMember.roles.cache.has(VERIFIED_ROLE_ID) || 
                                targetMember.roles.cache.some(r => r.name === "Verified");

            if (!hasVerified) {
                return interaction.reply({
                    content: `❌ Thao tác thất bại! Thành viên <@${targetUser.id}> không sở hữu role **Verified** nên không hợp lệ để được thêm hộ tài khoản.`,
                    flags: 64
                });
            }

            ownerId = targetUser.id;
            isAddHo = true;
        }

        console.log("========== ADD ACC ==========");
        console.log({
            taikhoan,
            matkhau,
            rank,
            ingameId,
            ownerId,
            isAddHo
        });
        console.log("=============================");

        if (!taikhoan || !matkhau) {
            return interaction.reply({
                content: "❌ Thiếu thông tin tài khoản hoặc mật khẩu (có thể do slash command chưa kịp update dữ liệu).",
                flags: 64
            });
        }

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
                    console.log("ADD ERROR:", err);
                    return interaction.reply({
                        content: "❌ Gặp sự cố kết nối với Database khi lưu tài khoản.",
                        flags: 64
                    });
                }

                db.get(
                    "SELECT * FROM accounts WHERE id = ?",
                    [this.lastID],
                    (e, row) => {
                        console.log("========== NEW ACCOUNT DIRECTORY ==========");
                        console.log(JSON.stringify(row, null, 2));
                        console.log("===========================================");
                    }
                );

                const responseMessage = isAddHo
                    ? `✅ Đã thêm hộ tài khoản thành công cho <@${ownerId}>\n\n🆔 IG: **${ingameId}**\n🏆 Rank: **${rank}**\n👤 Tài khoản: \`${taikhoan}\`\n🔐 Mật khẩu: \`${matkhau}\`\n\n*Hệ thống đã ghi nhận quyền sở hữu cho <@${ownerId}> (Họ có thể tự quản lý và tự động mở khóa mượn tài khoản).*`
                    : `✅ Đã thêm acc thành công\n\n🆔 IG: **${ingameId}**\n🏆 Rank: **${rank}**\n👤 Tài khoản: \`${taikhoan}\`\n🔐 Mật khẩu: \`${matkhau}\``;

                return interaction.reply({
                    content: responseMessage,
                    flags: 64
                });
            }
        );
    }
};
