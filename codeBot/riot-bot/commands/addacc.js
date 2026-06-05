const { SlashCommandBuilder } = require("discord.js");
const db = require("../db");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("addacc")
        .setDescription("Thêm acc mới")
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
                .setDescription("Rank")
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName("ingameid")
                .setDescription("ID in-game")
                .setRequired(true)
        ),

    async execute(interaction) {

        const taikhoan = interaction.options.getString("taikhoan");
        const matkhau = interaction.options.getString("matkhau");
        const rank = interaction.options.getString("rank");
        const ingameId = interaction.options.getString("ingameid");

        db.run(
            `INSERT INTO accounts
            (taikhoan, matkhau, rank, ingameName, createdBy)
            VALUES (?, ?, ?, ?, ?)`,
            [taikhoan, matkhau, rank, ingameId, interaction.user.id],
            async (err) => {

                if (err) {
                    console.log(err);

                    return interaction.reply({
                        content: "❌ Lỗi database",
                        flags: 64
                    });
                }

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
