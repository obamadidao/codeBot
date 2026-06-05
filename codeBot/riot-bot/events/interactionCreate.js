const {
    ActionRowBuilder,
    StringSelectMenuBuilder
} = require("discord.js");

const db = require("../db");

function hasVerifiedRole(member) {
    return member?.roles?.cache?.some(r => r.name === "Verified");
}

// =========================
// SAFE LOG FUNCTION
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

module.exports = {
    name: "interactionCreate",

    async execute(interaction, client) {

        try {

            // =========================
            // SLASH COMMANDS
            // =========================
            if (interaction.isChatInputCommand()) {
                const command = client.commands.get(interaction.commandName);
                if (!command) return;
                return command.execute(interaction, client);
            }

            // =========================
            // EDIT / DELETE HANDLER
            // =========================
            const edit = require("../commands/editacc");
            const del = require("../commands/delacc");

            if (await edit.handle(interaction)) return;
            if (await del.handle(interaction)) return;

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
                    return interaction.reply({ content: "❌ Cần role Verified", flags: 64 });
                }

                const id = interaction.values[0];

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

                        db.get(
                            "SELECT * FROM accounts WHERE id = ?",
                            [id],
                            (err, acc) => {
console.log("========== ACC DATA ==========");
        console.log(JSON.stringify(acc, null, 2));
        console.log("==============================");
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

                                db.run(
    `
    UPDATE accounts
    SET
        isBorrowed = 1,
        borrowedBy = ?,
        borrowTime = ?
    WHERE id = ?
    `,
    [
        interaction.user.id,
        Date.now(),
        id
    ],
    (err) => {
        if (err) {
            console.log("BORROW UPDATE ERROR:", err);
        } else {
            console.log("✅ Saved borrowTime:", Date.now());
        }
    }
);

                                interaction.reply({
    content:
        `🎮 ACC INFO

🆔 IG: ${acc.ingameName || "Chưa có"}
🏆 Rank: ${acc.rank}
👤 Tài khoản: ${acc.taikhoan || acc.username}
🔐 Mật khẩu: ${acc.matkhau || acc.password}`,
    flags: 64
});

                                // LOG MƯỢN ACC
                                sendLog(interaction,
                                    `📥[MƯỢN ACC]

👤 Người mượn: ${interaction.user.tag}(<@${interaction.user.id}>)
🆔 IG: ${acc.ingameName || "N/A"}`
                                );
                            }
                        );
                    }
                );

                return;
            }

            // =========================
            // ADD ACC MODAL
            // =========================
            if (interaction.isModalSubmit() && interaction.customId === "acc_modal") {

                const taikhoan = interaction.fields.getTextInputValue("taikhoan");
                const matkhau = interaction.fields.getTextInputValue("matkhau");
                const rank = interaction.fields.getTextInputValue("rank");

                db.run(
                    "INSERT INTO accounts (taikhoan, matkhau, rank) VALUES (?, ?, ?)",
                    [taikhoan, matkhau, rank]
                );

                return interaction.reply({
                    content: "✅ Đã lưu acc",
                    ephemeral: true
                });
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
