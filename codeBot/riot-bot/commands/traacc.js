const { SlashCommandBuilder } = require("discord.js");
const db = require("../db");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("traacc")
        .setDescription("Trả lại acc đang mượn"),

    async execute(interaction) {

        db.all(
            "SELECT * FROM accounts WHERE borrowedBy = ?",
            [interaction.user.id],
            (err, rows) => {

                if (err) {
                    console.log(err);
                    return interaction.reply({
                        content: "❌ Lỗi database",
                        ephemeral: true
                    });
                }

                if (!rows || rows.length === 0) {
                    return interaction.reply({
                        content: "❌ Bạn không đang mượn acc nào",
                        ephemeral: true
                    });
                }

                db.run(
                    `
                    UPDATE accounts
                    SET
                        isBorrowed = 0,
                        borrowedBy = NULL,
                        borrowTime = NULL
                    WHERE borrowedBy = ?
                    `,
                    [interaction.user.id]
                );

                const logChannel = interaction.guild.channels.cache.get("1345689852804464652");

                if (logChannel) {
                    rows.forEach(acc => {
                        logChannel.send(
`
📤 [TRẢ ACC]

👤 Người trả: ${interaction.user.tag} (<@${interaction.user.id}>)
🆔 IG: ${acc.ingameName || "N/A"}
───────────────────`
                        );
                    });
                }

                interaction.reply({
                    content: "✅ Bạn đã trả tất cả acc đang mượn",
                    ephemeral: true
                });
            }
        );
    }
};
