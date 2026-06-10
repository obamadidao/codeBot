const {
    ActionRowBuilder,
    StringSelectMenuBuilder
} = require("discord.js");

const db = require("../db");

// =========================
// CHECK ROLE VERIFIED
// =========================
function hasVerifiedRole(member) {
    return member?.roles?.cache?.some(r => r.name === "Verified");
}

// =========================
// LOG FUNCTION
// =========================
async function sendLog(interaction, message) {
    try {
        if (!interaction.guild) return;

        const channel = await interaction.guild.channels.fetch("1345689852804464652").catch(() => null);
        if (!channel || !channel.isTextBased()) return;

        await channel.send({ content: message }).catch(() => null);

    } catch (e) {
        console.log("LOG ERROR:", e);
    }
}

// =========================
// HANDLE BORROW
// =========================
function handleBorrow(interaction, id) {

    // ❌ đã mượn rồi
    db.get(
        "SELECT * FROM accounts WHERE borrowedBy = ?",
        [interaction.user.id],
        (err, already) => {

            if (already) {
                return interaction.reply({
                    content: "❌ Bạn đã mượn 1 acc rồi",
                    flags: 64
                });
            }

            // lấy acc
            db.get(
                "SELECT * FROM accounts WHERE id = ?",
                [id],
                (err, acc) => {

                    if (!acc) {
                        return interaction.reply({
                            content: "❌ Không tìm thấy acc",
                            flags: 64
                        });
                    }

                    if (acc.isBorrowed) {
                        return interaction.reply({
                            content: "❌ Acc đang được mượn",
                            flags: 64
                        });
                    }

                    // update mượn
                    db.run(
                        `UPDATE accounts
                         SET isBorrowed = 1,
                             borrowedBy = ?,
                             borrowTime = ?
                         WHERE id = ?`,
                        [interaction.user.id, Date.now(), id]
                    );

                    // trả acc
                    interaction.reply({
                        content:
`🎮 ACC INFO

🆔 IG: ${acc.ingameName || "Chưa có"}
🏆 Rank: ${acc.rank}
👤 Tài khoản: ${acc.taikhoan || acc.username}
🔐 Mật khẩu: ${acc.matkhau || acc.password}`,
                        flags: 64
                    });

                    // log
                    sendLog(interaction,
`📥 [MƯỢN ACC]

👤 Người mượn: ${interaction.user.tag} (<@${interaction.user.id}>)
🆔 IG: ${acc.ingameName || "N/A"}
───────────────────`
                    );
                }
            );
        }
    );
}

// =========================
// MAIN EVENT
// =========================
module.exports = {
    name: "interactionCreate",

    async execute(interaction, client) {

        try {

            // =========================
            // SLASH COMMAND
            // =========================
            if (interaction.isChatInputCommand()) {
                const command = client.commands.get(interaction.commandName);
                if (!command) return;
                return command.execute(interaction, client);
            }

            // =========================
            // OPEN ACC LIST
            // =========================
            if (interaction.isButton() && interaction.customId === "open_acc") {

                if (!hasVerifiedRole(interaction.member)) {
                    return interaction.reply({
                        content: "❌ Cần role Verified",
                        flags: 64
                    });
                }

                db.all("SELECT * FROM accounts", [], (err, rows) => {

                    if (err) {
                        return interaction.reply({ content: "❌ DB error", flags: 64 });
                    }

                    if (!rows?.length) {
                        return interaction.reply({ content: "❌ Không có acc", flags: 64 });
                    }

                    const menu = new StringSelectMenuBuilder()
                        .setCustomId("select_acc")
                        .setPlaceholder("📋 Chọn acc muốn mượn");

                    rows.forEach(acc => {

                        const status = acc.isBorrowed
                            ? "🔴 Đang dùng"
                            : "🟢 Trống";

                        menu.addOptions({
                            label: `👤IG: ${acc.ingameName || "Chưa có"} | ${status}`.slice(0, 100),
                            description: `🏆 Rank: ${acc.rank}`,
                            value: String(acc.id)
                        });
                    });

                    interaction.reply({
                        content: "📋 Danh sách acc:",
                        components: [new ActionRowBuilder().addComponents(menu)],
                        flags: 64
                    });
                });

                return;
            }

            // =========================
            // SELECT ACC (BORROW)
            // =========================
            if (interaction.isStringSelectMenu() && interaction.customId === "select_acc") {

                if (!hasVerifiedRole(interaction.member)) {
                    return interaction.reply({
                        content: "❌ Cần role Verified",
                        flags: 64
                    });
                }

                const id = interaction.values[0];

                // =========================
                // CHECK ĐÃ DROP ACC CHƯA
                // =========================
                db.get(
                    "SELECT * FROM accounts WHERE createdBy = ? LIMIT 1",
                    [interaction.user.id],
                    (err, row) => {

                        if (err) {
                            return interaction.reply({
                                content: "❌ Lỗi database",
                                flags: 64
                            });
                        }

                        if (!row) {
                            return interaction.reply({
                                content: "❌ Bạn phải thêm ít nhất 1 acc mới được mượn",
                                flags: 64
                            });
                        }

                        // ✅ OK -> cho mượn
                        handleBorrow(interaction, id);
                    }
                );

                return;
            }

        } catch (err) {
            console.log("INTERACTION ERROR:", err);

            if (!interaction.replied && !interaction.deferred) {
                return interaction.reply({
                    content: "❌ Lỗi bot",
                    ephemeral: true
                });
            }
        }
    }
};
