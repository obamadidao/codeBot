const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const db = require("../db");

module.exports = {

    data: new SlashCommandBuilder()
        .setName("listacc")
        .setDescription("Xem dashboard acc"),

    async execute(interaction) {

        db.all("SELECT * FROM accounts", [], (err, rows) => {

            if (err || !rows?.length) {
                return interaction.reply({
                    content: "❌ Không có acc nào",
                    ephemeral: true
                });
            }

            const embed = new EmbedBuilder()
                .setTitle("📊 DASHBOARD ACC LIST")
                .setColor("Blue")
                .setFooter({ text: "System Account Manager" });

            let desc = "";

            rows.forEach((acc, i) => {

                const status = acc.isBorrowed
                    ? `🔴 Đang dùng (<@${acc.borrowedBy}>)`
                    : "🟢 Trống";

                desc +=
                    `**#${i + 1}**
👤 User: ${acc.username}
🎮 IGN: ${acc.ingameName || "Chưa có"}
🏆 Rank: ${acc.rank}
📌 Status: ${status}
🆔 ID: ${acc.id}

───────────────────

`;
            });

            embed.setDescription(desc);

            interaction.reply({
                embeds: [embed],
                ephemeral: true
            });
        });
    }

};