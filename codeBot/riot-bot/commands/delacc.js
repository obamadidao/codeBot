const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const db = require("../db");

module.exports = {

    data: new SlashCommandBuilder()
        .setName("delacc")
        .setDescription("Xóa nhiều acc (admin hoặc acc bạn tạo)"),

    async execute(interaction) {

        const isAdmin = interaction.member.permissions.has("Administrator");

        db.all(
            isAdmin
                ? "SELECT * FROM accounts"
                : "SELECT * FROM accounts WHERE createdBy = ?",
            isAdmin ? [] : [interaction.user.id],
            (err, rows) => {

                if (err || !rows?.length) {
                    return interaction.reply({
                        content: "❌ Không có acc nào để xóa",
                        ephemeral: true
                    });
                }

                const menu = new StringSelectMenuBuilder()
                    .setCustomId("delete_multi_acc")
                    .setPlaceholder("Tick acc cần xóa")
                    .setMinValues(1)
                    .setMaxValues(rows.length);

                rows.forEach(acc => {
                    menu.addOptions({
                        label: `🆔 IG: ${acc.ingameName || "N/A"}`,
                        description: `🏆 Rank: ${acc.rank || "N/A"}`,
                        value: String(acc.id)
                    });
                });

                interaction.reply({
                    content: "🗑️ Chọn nhiều acc để xóa:",
                    components: [
                        new ActionRowBuilder().addComponents(menu)
                    ],
                    ephemeral: true
                });
            }
        );
    },

    async handle(interaction) {

        // =========================
        // CHỌN NHIỀU ACC
        // =========================
        if (
            interaction.isStringSelectMenu() &&
            interaction.customId === "delete_multi_acc"
        ) {

            const ids = interaction.values;
            const isAdmin = interaction.member.permissions.has("Administrator");

            if (!ids?.length) {
                return interaction.update({
                    content: "❌ Không có acc nào được chọn",
                    components: []
                });
            }

            const placeholders = ids.map(() => "?").join(",");

            const params = isAdmin
                ? ids
                : [...ids, interaction.user.id];

            const query = isAdmin
                ? `SELECT * FROM accounts WHERE id IN (${placeholders})`
                : `SELECT * FROM accounts WHERE id IN (${placeholders}) AND createdBy = ?`;

            db.all(query, params, (err, rows) => {

                if (err || !rows?.length) {
                    return interaction.update({
                        content: "❌ Không tìm thấy acc hoặc không có quyền",
                        components: []
                    });
                }

                const deleteIds = rows.map(r => r.id);

                db.run(
                    `DELETE FROM accounts WHERE id IN (${deleteIds.map(() => "?").join(",")})`,
                    deleteIds,
                    (err2) => {

                        if (err2) {
                            return interaction.update({
                                content: "❌ Lỗi khi xóa acc",
                                components: []
                            });
                        }

                        const info = rows
                            .map(r =>
                                `👤 Tài khoản: ${r.username}
🔐 Mật khẩu: ${r.password}
🆔 IG: ${r.ingameName || "N/A"}
🏆 Rank: ${r.rank || "N/A"}`
                            )
                            .join("\n\n");

                        return interaction.update({
                            content:
`✅ Đã xóa ${rows.length} acc:

${info}`,
                            components: []
                        });
                    }
                );
            });

            return true;
        }

        return false;
    }
};
