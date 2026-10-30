const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const db = require("../db");

const VERIFIED_ROLE_ID = "1268608479346823178";
const HOANG_DE_USER_ID = "1206317832674086944";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("addaccho")
        .setDescription("Thêm tài khoản hộ thành viên khác (Chỉ dành cho Admin/Hoàng Đế)")
        // --- 🟢 TẤT CẢ OPTION BẮT BUỘC (setRequired: true) ĐẶT LÊN ĐẦU ---
        .addStringOption(option =>
            option.setName("taikhoan")
                .setDescription("Tài khoản")
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName("matkhau")
                .setDescription("Mật khẩu")
                .setRequired(true)
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
                .setRequired(true)
        )
        // --- 🟡 TẤT CẢ OPTION TÙY CHỌN (setRequired: false) ĐẶT XUỐNG CUỐI ---
        .addStringOption(option =>
            option.setName("username")
                .setDescription("Username cũ (Backup)")
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName("password")
                .setDescription("Password cũ (Backup)")
                .setRequired(false)
        ),

    async execute(interaction) {
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
                        interaction.user.id === HOANG_DE_USER_ID;

        if (!isAdmin) {
            return interaction.reply({
                content: "❌ Bạn không có quyền Admin / Hoàng Đế để sử dụng chức năng thêm tài khoản hộ người khác!",
                flags: 64
            });
        }

        const taikhoan = interaction.options.getString("taikhoan") || interaction.options.getString("username");
        const matkhau = interaction.options.getString("matkhau") || interaction.options.getString("password");
        const rank = interaction.options.getString("rank");
        const ingameId = interaction.options.getString("ingameid");
        const targetUser = interaction.options.getUser("target_user");

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
            `INSERT INTO accounts (taikhoan, matkhau, rank, ingameName, createdBy) VALUES (?, ?, ?, ?, ?)`,
            [taikhoan, matkhau, rank, ingameId, ownerId],
            function (err) {
                if (err) {
                    console.error("❌ ADD HO ERROR:", err);
                    return interaction.reply({
                        content: "❌ Gặp sự cố kết nối Database khi lưu tài khoản thêm hộ.",
                        flags: 64
                    });
                }

                return interaction.reply({
                    content: `✅ Đã thêm hộ tài khoản thành công cho <@${ownerId}>\n\n🆔 IG: **${ingameId}**\n🏆 Rank: **${rank}**\n👤 Tài khoản: \`${taikhoan}\`\n🔐 Mật khẩu: \`${matkhau}\`\n\n*Hệ thống đã ghi nhận quyền sở hữu cho <@${ownerId}>.*`,
                    flags: 64
                });
            }
        );
    }
};
