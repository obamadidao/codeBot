const {
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionFlagsBits
} = require("discord.js");

const db = require("../db");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("editacc")
        .setDescription("Chỉnh sửa thông tin tài khoản (Chủ sở hữu hoặc Admin)"),

    async execute(interaction) {
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

        // Quyết định danh sách hiển thị: Admin xem toàn bộ acc, người thường chỉ thấy acc của mình
        const query = isAdmin
            ? "SELECT * FROM accounts"
            : "SELECT * FROM accounts WHERE createdBy = ?";
        const params = isAdmin ? [] : [interaction.user.id];

        db.all(query, params, (err, rows) => {
            if (err) {
                console.error("LỖI LIÊN KẾT TRUY VẤN EDITACC:", err);
                return interaction.reply({
                    content: "❌ Gặp sự cố kết nối dữ liệu DB khi lấy danh sách tài khoản!",
                    flags: 64
                });
            }

            if (!rows?.length) {
                return interaction.reply({
                    content: isAdmin 
                        ? "❌ Hệ thống hiện tại đang trống! Chưa có tài khoản nào được tạo để chỉnh sửa." 
                        : "❌ Bạn chưa có tài khoản nào trên hệ thống để thực hiện chỉnh sửa!",
                    flags: 64
                });
            }

            const menu = new StringSelectMenuBuilder()
                .setCustomId("edit_select_acc")
                .setPlaceholder("📋 Chọn tài khoản bạn muốn sửa");

            rows.forEach(acc => {
                const accountName = acc.taikhoan || acc.username || "Không rõ";
                const status = acc.isBorrowed ? "🔴 Đang dùng" : "🟢 Trống";

                menu.addOptions({
                    label: `👤 IG: ${acc.ingameName || "Chưa có"} | ${status}`.slice(0, 100),
                    description: `Tài khoản: ${accountName} | Rank: ${acc.rank || "N/A"}`,
                    value: String(acc.id)
                });
            });

            return interaction.reply({
                content: "✏️ **Chọn tài khoản bạn muốn tiến hành thay đổi thông tin:**",
                components: [
                    new ActionRowBuilder().addComponents(menu)
                ],
                flags: 64
            });
        });
    },

    async handle(interaction) {
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

        // ==========================================
        // 1. CHỌN ACC ĐỂ SỬA (Dropdown cấp 1)
        // ==========================================
        if (
            interaction.isStringSelectMenu() &&
            interaction.customId === "edit_select_acc"
        ) {
            const id = interaction.values[0];

            db.get(
                "SELECT * FROM accounts WHERE id = ?",
                [id],
                async (err, acc) => {
                    if (err || !acc) {
                        return interaction.reply({
                            content: "❌ Không tìm thấy thông tin tài khoản này trên hệ thống!",
                            flags: 64
                        });
                    }

                    // KIỂM TRA PHÂN QUYỀN
                    if (!isAdmin && acc.createdBy !== interaction.user.id) {
                        return interaction.reply({
                            content: "❌ Bạn không có quyền chỉnh sửa tài khoản này! Chỉ Admin hoặc chính chủ tài khoản mới được can thiệp.",
                            flags: 64
                        });
                    }

                    const menu = new StringSelectMenuBuilder()
                        .setCustomId(`edit_field_${id}`)
                        .setPlaceholder("Chọn thông tin muốn sửa")
                        .addOptions(
                            {
                                label: "Tài khoản",
                                value: "taikhoan"
                            },
                            {
                                label: "Mật khẩu",
                                value: "matkhau"
                            },
                            {
                                label: "Hạng Rank",
                                value: "rank"
                            },
                            {
                                label: "ID In-game",
                                value: "ingameName"
                            }
                        );

                    return interaction.reply({
                        content: `📌 **THÔNG TIN TÀI KHOẢN CHỌN**\n\n👤 Tài khoản: \`${acc.taikhoan || acc.username || "N/A"}\`\n🔐 Mật khẩu: \`${acc.matkhau || acc.password || "N/A"}\`\n🆔 IG: **${acc.ingameName || "N/A"}**\n🏆 Rank: **${acc.rank || "N/A"}**\n\n👉 Chọn trường thông tin muốn sửa bên dưới:`,
                        components: [
                            new ActionRowBuilder().addComponents(menu)
                        ],
                        flags: 64
                    });
                }
            );

            return true;
        }

        // ==========================================
        // 2. CHỌN TRƯỜNG THÔNG TIN MUỐN CHỈNH SỬA (Dropdown cấp 2)
        // ==========================================
        if (
            interaction.isStringSelectMenu() &&
            interaction.customId.startsWith("edit_field_")
        ) {
            const id = interaction.customId.split("_")[2];
            const field = interaction.values[0];

            db.get(
                "SELECT * FROM accounts WHERE id = ?",
                [id],
                async (err, acc) => {
                    if (err || !acc) {
                        return interaction.reply({
                            content: "❌ Không tìm thấy tài khoản!",
                            flags: 64
                        });
                    }

                    // KIỂM TRA PHÂN QUYỀN
                    if (!isAdmin && acc.createdBy !== interaction.user.id) {
                        return interaction.reply({
                            content: "❌ Bạn không có quyền chỉnh sửa tài khoản này!",
                            flags: 64
                        });
                    }

                    const fieldNames = {
                        taikhoan: "Tài khoản",
                        matkhau: "Mật khẩu",
                        rank: "Rank",
                        ingameName: "ID In-game"
                    };

                    const modal = new ModalBuilder()
                        .setCustomId(`edit_modal_${id}_${field}`)
                        .setTitle(`Sửa ${fieldNames[field]}`);

                    const input = new TextInputBuilder()
                        .setCustomId("value")
                        .setLabel(`Nhập ${fieldNames[field]} mới`)
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder(String(acc[field] || ""))
                        .setRequired(true);

                    modal.addComponents(
                        new ActionRowBuilder().addComponents(input)
                    );

                    return interaction.showModal(modal);
                }
            );

            return true;
        }

        // ==========================================
        // 3. XỬ LÝ LƯU THÔNG TIN MỚI (Modal Submit)
        // ==========================================
        if (
            interaction.isModalSubmit() &&
            interaction.customId.startsWith("edit_modal_")
        ) {
            const parts = interaction.customId.split("_");
            const id = parts[2];
            const field = parts[3];
            const value = interaction.fields.getTextInputValue("value");

            const allowedFields = [
                "taikhoan",
                "matkhau",
                "rank",
                "ingameName"
            ];

            if (!allowedFields.includes(field)) {
                return interaction.reply({
                    content: "❌ Trường thông tin không hợp lệ!",
                    flags: 64
                });
            }

            db.get(
                "SELECT * FROM accounts WHERE id = ?",
                [id],
                (err, acc) => {
                    if (err || !acc) {
                        return interaction.reply({
                            content: "❌ Không tìm thấy thông tin tài khoản cần cập nhật!",
                            flags: 64
                        });
                    }

                    // KIỂM TRA PHÂN QUYỀN TRƯỚC KHI UPDATE
                    if (!isAdmin && acc.createdBy !== interaction.user.id) {
                        return interaction.reply({
                            content: "❌ Bạn không có quyền chỉnh sửa tài khoản này!",
                            flags: 64
                        });
                    }

                    const oldValue = acc[field];

                    db.run(
                        `UPDATE accounts SET ${field} = ? WHERE id = ?`,
                        [value, id],
                        (errRun) => {
                            if (errRun) {
                                console.error("LỖI SQL GHI ĐÈ EDITACC:", errRun);
                                return interaction.reply({
                                    content: "❌ Gặp sự cố khi ghi đè dữ liệu mới vào DB!",
                                    flags: 64
                                });
                            }

                            return interaction.reply({
                                content: `✅ **Cập nhật thông tin thành công!**\n\n🔹 Giá trị cũ: \`${oldValue || "Trống"}\`\n♻️\n🔸 Giá trị mới: \`${value}\``,
                                flags: 64
                            });
                        }
                    );
                }
            );

            return true;
        }

        return false;
    }
};
