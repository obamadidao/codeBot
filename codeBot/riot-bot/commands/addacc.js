const { SlashCommandBuilder } = require("discord.js");
const db = require("../db");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("addacc")
        .setDescription("Thêm acc mới")
        .addStringOption(option =>
            option.setName("taikhoan")
                .setDescription("Tài khoản")
                .setRequired(false) // ❗ cho phép optional để tránh lỗi
        )
        .addStringOption(option =>
            option.setName("matkhau")
                .setDescription("Mật khẩu")
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName("username") // 👈 giữ lại để backup
                .setDescription("Username cũ")
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName("password") // 👈 giữ lại để backup
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
        ),

    async execute(interaction) {

        // 👇 FIX CHÍNH Ở ĐÂY
        const taikhoan =
            interaction.options.getString("taikhoan") ||
            interaction.options.getString("username");

        const matkhau =
            interaction.options.getString("matkhau") ||
            interaction.options.getString("password");

        const rank = interaction.options.getString("rank");
        const ingameId = interaction.options.getString("ingameid");

        console.log("========== ADD ACC ==========");
        console.log({
            taikhoan,
            matkhau,
            rank,
            ingameId
        });
        console.log("=============================");

        // ❗ Check null để tránh insert lỗi
        if (!taikhoan || !matkhau) {
            return interaction.reply({
                content: "❌ Thiếu tài khoản hoặc mật khẩu (có thể slash command chưa update)",
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
                interaction.user.id
            ],
            function (err) {

                if (err) {
                    console.log("ADD ERROR:", err);

                    return interaction.reply({
                        content: "❌ Lỗi database",
                        flags: 64
                    });
                }

                db.get(
                    "SELECT * FROM accounts WHERE id = ?",
                    [this.lastID],
                    (e, row) => {

                        console.log("========== NEW ACCOUNT ==========");
                        console.log(JSON.stringify(row, null, 2));
                        console.log("=================================");
                    }
                );

                return interaction.reply({
                    content:
`✅ Đã thêm acc thành công

🆔 IG: ${ingameId}
🏆 Rank: ${rank}
👤 Tài khoản: ${taikhoan}
🔐 Mật khẩu: ${matkhau}`,
                    flags: 64
                });
            }
        );
    }
};
