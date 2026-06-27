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
                const ALLOWED_CHANNEL_ID = "1510684535203958865";

                if (interaction.channelId !== ALLOWED_CHANNEL_ID) {
                    return interaction.reply({
                        content: `❌ Bạn ơi, vui lòng di chuyển sang kênh <#${ALLOWED_CHANNEL_ID}> để sử dụng lệnh nhé! Kênh này để đăng thông báo nè.`,
                        flags: 64 
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
                    return interaction.reply({ content: "❌ Cần role Verified", flags: 64 });
                }

                db.all("SELECT * FROM accounts", [], (err, rows) => {
                    if (err) return interaction.reply({ content: "❌ DB error", flags: 64 });
                    if (!rows?.length) return interaction.reply({ content: "❌ Không có acc", flags: 64 });

                    const menu = new StringSelectMenuBuilder()
                        .setCustomId("select_acc")
                        .setPlaceholder("📋 Chọn acc muốn mượn");

                    rows.forEach(acc => {
                        const status = acc.isBorrowed ? "🔴 Đang dùng" : "🟢 Trống";

                        menu.addOptions({
                            label: `👤IG: ${acc.ingameName || "Chưa có"} | ${status}`.slice(0, 100),
                            description: `🏆 Rank: ${acc.rank}`,
                            value: String(acc.id)
                        });
                    });

                    return interaction.reply({
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
                        if (err) return interaction.reply({ content: "❌ DB error", flags: 64 });
                        if (already) return interaction.reply({ content: "❌ Bạn đã mượn 1 acc rồi", flags: 64 });

                        db.get(
                            "SELECT * FROM accounts WHERE id = ?",
                            [id],
                            (err, acc) => {
                                if (err) return interaction.reply({ content: "❌ DB error", flags: 64 });
                                if (!acc) return interaction.reply({ content: "❌ Không tìm thấy acc", flags: 64 });
                                if (acc.isBorrowed) return interaction.reply({ content: "❌ Acc đang được mượn", flags: 64 });

                                // 🟢 FIX LỖI: Di chuyển interaction.reply vào TRONG callback của db.run để tránh lỗi bất đồng bộ
                                db.run(
                                    "UPDATE accounts SET isBorrowed = 1, borrowedBy = ?, borrowTime = ? WHERE id = ?",
                                    [interaction.user.id, Date.now(), id],
                                    (updateErr) => {
                                        if (updateErr) {
                                            console.error("❌ Lỗi cập nhật DB:", updateErr);
                                            return interaction.reply({ content: "❌ Lỗi hệ thống khi mượn acc", flags: 64 });
                                        }

                                        // 🟢 FIX LỖI: Đồng bộ lấy tên cột taikhoan / matkhau thay vì username / password cũ
                                        const finalUser = acc.taikhoan || acc.username || "Không rõ";
                                        const finalPass = acc.matkhau || acc.password || "Không rõ";

                                        interaction.reply({
                                            content: `🎮 ACC INFO\n\n🆔 IG: ${acc.ingameName || "Chưa có"}\n🏆 Rank: ${acc.rank}\n👤 Tài khoản: ${finalUser}\n🔐 Mật khẩu: ${finalPass}`,
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

                // 🟢 FIX LỖI LỚN: Thay đổi query thành cột taikhoan, matkhau và THÊM createdBy để lệnh /editacc nhận diện được chủ sở hữu
                db.run(
                    "INSERT INTO accounts (taikhoan, matkhau, rank, createdBy) VALUES (?, ?, ?, ?)",
                    [username, password, rank, interaction.user.id],
                    (insertErr) => {
                        if (insertErr) {
                            console.error("❌ Lỗi DB khi thêm acc:", insertErr);
                            return interaction.reply({ content: "❌ Không thể lưu tài khoản vào DB", ephemeral: true });
                        }

                        return interaction.reply({
                            content: "✅ Đã lưu acc thành công! Hệ thống đã ghi nhận bạn là chủ sở hữu (bạn có quyền dùng `/editacc` để sửa).",
                            ephemeral: true
                        });
                    }
                );
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
