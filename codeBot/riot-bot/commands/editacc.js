const {
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require("discord.js");

const db = require("../db");

module.exports = {

    data: new SlashCommandBuilder()
        .setName("editacc")
        .setDescription("Edit acc (chỉ acc bạn thêm)"),

    async execute(interaction) {

        db.all(
            "SELECT * FROM accounts WHERE createdBy = ?",
            [interaction.user.id],
            (err, rows) => {

                if (err) {
                    return interaction.reply({ content: "❌ DB error", ephemeral: true });
                }

                if (!rows?.length) {
                    return interaction.reply({
                        content: "❌ Bạn chưa thêm acc nào",
                        ephemeral: true
                    });
                }

                const menu = new StringSelectMenuBuilder()
                    .setCustomId("edit_select_acc")
                    .setPlaceholder("Chọn acc bạn muốn sửa");

                rows.forEach(acc => {
                    menu.addOptions({
                        label: acc.username.slice(0, 100),
                        description: `ID IG: ${acc.ingameName || "N/A"} | Rank: ${acc.rank}`,
                        value: String(acc.id)
                    });
                });

                interaction.reply({
                    content: "✏️ Chọn acc bạn đã tạo:",
                    components: [new ActionRowBuilder().addComponents(menu)],
                    ephemeral: true
                });
            }
        );
    },

    async handle(interaction) {

        // =========================
        // CHỌN ACC
        // =========================
        if (interaction.isStringSelectMenu() && interaction.customId === "edit_select_acc") {

            const id = interaction.values[0];

            db.get("SELECT * FROM accounts WHERE id = ?", [id], async (err, acc) => {

                if (err || !acc) {
                    return interaction.reply({ content: "❌ Không tìm thấy acc", ephemeral: true });
                }

                if (acc.createdBy !== interaction.user.id) {
                    return interaction.reply({ content: "❌ Không có quyền", ephemeral: true });
                }

                const menu = new StringSelectMenuBuilder()
                    .setCustomId(`edit_field_${id}`)
                    .setPlaceholder("Chọn field muốn sửa")
                    .addOptions(
                        {
                            label: "Username",
                            value: "username"
                        },
                        {
                            label: "Password",
                            value: "password"
                        },
                        {
                            label: "Rank",
                            value: "rank"
                        },
                        {
                            label: "ID In-game",
                            value: "ingameName"
                        }
                    );

                return interaction.reply({
                    content:
                        `📌 INFO ACC

👤 Username: ${acc.username}
🔐 Password: ${acc.password}
🆔 IG: ${acc.ingameName || "N/A"}
🏆 Rank: ${acc.rank}

👉 Chọn field muốn sửa`,
                    components: [new ActionRowBuilder().addComponents(menu)],
                    ephemeral: true
                });
            });

            return true;
        }

        // =========================
        // CHỌN FIELD
        // =========================
        if (interaction.isStringSelectMenu() && interaction.customId.startsWith("edit_field_")) {

            const id = interaction.customId.split("_")[2];
            const field = interaction.values[0];

            db.get("SELECT * FROM accounts WHERE id = ?", [id], async (err, acc) => {

                if (err || !acc) {
                    return interaction.reply({ content: "❌ Không tìm thấy acc", ephemeral: true });
                }

                if (acc.createdBy !== interaction.user.id) {
                    return interaction.reply({ content: "❌ Không có quyền", ephemeral: true });
                }

                const modal = new ModalBuilder()
                    .setCustomId(`edit_modal_${id}_${field}`)
                    .setTitle(`Edit ${field}`);

                const input = new TextInputBuilder()
                    .setCustomId("value")
                    .setLabel(`Nhập ${field} mới`)
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder(String(acc[field] || ""))
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(input)
                );

                return interaction.showModal(modal);
            });

            return true;
        }

        // =========================
        // SUBMIT UPDATE
        // =========================
        if (interaction.isModalSubmit() && interaction.customId.startsWith("edit_modal_")) {

            const parts = interaction.customId.split("_");
            const id = parts[2];
            const field = parts[3];

            const value = interaction.fields.getTextInputValue("value");

            const allowed = ["username", "password", "rank", "ingameName"];
            if (!allowed.includes(field)) {
                return interaction.reply({
                    content: "❌ Field không hợp lệ",
                    ephemeral: true
                });
            }

            db.get("SELECT * FROM accounts WHERE id = ?", [id], (err, acc) => {

                if (err || !acc) {
                    return interaction.reply({
                        content: "❌ Không tìm thấy acc",
                        ephemeral: true
                    });
                }

                if (acc.createdBy !== interaction.user.id) {
                    return interaction.reply({
                        content: "❌ Không có quyền",
                        ephemeral: true
                    });
                }

                const oldValue = acc[field];

                db.run(
                    `UPDATE accounts SET ${field} = ? WHERE id = ?`,
                    [value, id],
                    (err) => {

                        if (err) {
                            return interaction.reply({
                                content: "❌ Lỗi khi cập nhật",
                                ephemeral: true
                            });
                        }

                        return interaction.reply({
                            content:
                                `✅ Cập nhật thành công

Cũ: ${oldValue || "trống"}
♻️
Mới: ${value}`,
                            ephemeral: true
                        });
                    }
                );
            });

            return true;
        }

        return false;
    }

};