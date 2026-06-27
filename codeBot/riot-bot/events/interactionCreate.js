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
                // ID kênh "muon-acc" được phép dùng lệnh
                const ALLOWED_CHANNEL_ID = "1510684535203958865";

                // Kiểm tra nếu user gõ lệnh ở kênh khác kênh muon-acc
                if (interaction.channelId !== ALLOWED_CHANNEL_ID) {
                    return interaction.reply({
                        content: `❌ Bạn ơi, vui lòng di chuyển sang kênh <#${ALLOWED_CHANNEL_ID}> để sử dụng lệnh nhé! Kênh này để đăng thông báo nè.`,
                        flags: 64 // Ẩn tin nhắn, chỉ một mình người gõ sai nhìn thấy
                    });
                }

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
            // SELECT ACC (BORROW) - ĐÃ FIX LỖI NULL
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
                        if (err) return interaction.reply({ content: "❌ DB error", flags: 64 });

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
                                if (err) return interaction.reply({ content: "❌ DB error", flags: 64 });

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

                                // Thực hiện cập nhật trạng thái mượn vào DB trước
                                db.run(
                                    "UPDATE accounts SET isBorrowed = 1, borrowedBy = ?, borrowTime = ? WHERE id = ?",
                                    [interaction.user.id, Date.now(), id],
                                    (updateErr) => {
                                        if (updateErr) {
                                            console.error("❌ Lỗi cập nhật thời gian mượn vào DB:", updateErr);
                                            return interaction.reply({ content: "❌ Lỗi cập nhật cơ sở dữ liệu", flags: 64 });
                                        }

                                        // DB đã cập nhật xong hoàn toàn mới tiến hành phản hồi dữ liệu tĩnh của 'acc'
                                        interaction.reply({
                                            content: `🎮 ACC INFO\n\n🆔 IG: ${acc.ingameName || "Chưa có"}\n🏆 Rank: ${acc.rank}\n👤 Username: ${acc.username}\n🔐 Password: ${acc.password}`,
                                            flags: 64
                                        });

                                        // LOG MƯỢN ACC
                                        sendLog(interaction,
                                            `📥[MƯỢN ACC]\n\n👤 Người mượn: ${interaction.user.tag} (<@${interaction.user.id}>)\n🆔 IG: ${acc.ingameName || "N/A"}\n───────────────────`
                                        );
                                    }
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

                const username = interaction.fields.getTextInputValue("username");
                const password = interaction.fields.getTextInputValue("password");
                const rank = interaction.fields.getTextInputValue("rank");

                db.run(
                    "INSERT INTO accounts (username, password, rank) VALUES (?, ?, ?)",
                    [username, password, rank]
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
