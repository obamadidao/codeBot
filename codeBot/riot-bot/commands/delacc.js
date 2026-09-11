const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const db = require("../db");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("delacc")
        .setDescription("Xóa nhiều acc (admin hoặc acc bạn tạo)"),

    async execute(interaction) {
        // Mặc định hiển thị trang 0 khi vừa dùng lệnh
        await this.renderPage(interaction, 0, false);
    },

    // Hàm tạo giao diện phân trang (MỚI)
    async renderPage(interaction, page, isUpdate) {
        const isAdmin = interaction.member.permissions.has("Administrator");
        const query = isAdmin
            ? "SELECT * FROM accounts"
            : "SELECT * FROM accounts WHERE createdBy = ?";
        const params = isAdmin ? [] : [interaction.user.id];

        db.all(query, params, (err, rows) => {
            if (err || !rows?.length) {
                const msg = { content: "❌ Không có acc nào để xóa", components: [], ephemeral: true };
                return isUpdate ? interaction.update(msg) : interaction.reply(msg);
            }

            const PAGE_SIZE = 25;
            const totalPages = Math.ceil(rows.length / PAGE_SIZE);
            const currentPage = Math.min(Math.max(0, page), totalPages - 1);

            const startIdx = currentPage * PAGE_SIZE;
            const endIdx = startIdx + PAGE_SIZE;
            const limitedRows = rows.slice(startIdx, endIdx);

            const menu = new StringSelectMenuBuilder()
                .setCustomId("delete_multi_acc")
                .setPlaceholder(`Tick acc cần xóa (Trang ${currentPage + 1}/${totalPages})`)
                .setMinValues(1)
                .setMaxValues(limitedRows.length);

            limitedRows.forEach(acc => {
                menu.addOptions({
                    label: `🆔 IG: ${acc.ingameName || "N/A"}`,
                    description: `🏆 Rank: ${acc.rank || "N/A"}`,
                    value: String(acc.id)
                });
            });

            const components = [new ActionRowBuilder().addComponents(menu)];

            // Thêm nút chuyển trang nếu có nhiều hơn 25 acc
            if (totalPages > 1) {
                const paginationRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`delacc_page_${currentPage - 1}`)
                        .setLabel("◀ Trang trước")
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage === 0),
                    new ButtonBuilder()
                        .setCustomId("delacc_dummy")
                        .setLabel(`${currentPage + 1}/${totalPages}`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId(`delacc_page_${currentPage + 1}`)
                        .setLabel("Trang sau ▶")
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage === totalPages - 1)
                );
                components.push(paginationRow);
            }

            const replyData = {
                content: `🗑️ **Chọn nhiều acc để xóa (Tổng số: ${rows.length} acc):**`,
                components: components,
                ephemeral: true
            };

            return isUpdate ? interaction.update(replyData) : interaction.reply(replyData);
        });
    },

    async handle(interaction) {
        // 1. Lắng nghe sự kiện BẤM NÚT CHUYỂN TRANG
        if (interaction.isButton() && interaction.customId.startsWith("delacc_page_")) {
            const page = parseInt(interaction.customId.split("_page_")[1], 10);
            await this.renderPage(interaction, page, true);
            return true;
        }

        // 2. Lắng nghe sự kiện CHỌN ACC ĐỂ XÓA (Giữ nguyên logic cũ)
        if (
            interaction.isStringSelectMenu() &&
            interaction.customId === "delete_multi_acc"
        ) {
            const ids = interaction.values;
            const isAdmin = interaction.member.permissions.has("Administrator");

            if (!ids?.length) {
                return interaction.update({ content: "❌ Không có acc nào được chọn", components: [] });
            }

            const placeholders = ids.map(() => "?").join(",");
            const params = isAdmin ? ids : [...ids, interaction.user.id];
            const query = isAdmin
                ? `SELECT * FROM accounts WHERE id IN (${placeholders})`
                : `SELECT * FROM accounts WHERE id IN (${placeholders}) AND createdBy = ?`;

            db.all(query, params, (err, rows) => {
                if (err || !rows?.length) {
                    return interaction.update({ content: "❌ Không tìm thấy acc hoặc không có quyền", components: [] });
                }

                const deleteIds = rows.map(r => r.id);
                db.run(
                    `DELETE FROM accounts WHERE id IN (${deleteIds.map(() => "?").join(",")})`,
                    deleteIds,
                    (err2) => {
                        if (err2) return interaction.update({ content: "❌ Lỗi khi xóa acc", components: [] });

                        const info = rows.map(r =>
                            `👤 Tài khoản: ${r.taikhoan || r.username || "Không rõ"}\n🔐 Mật khẩu: ${r.matkhau || r.password || "Không rõ"}\n🆔 IG: ${r.ingameName || "N/A"}\n🏆 Rank: ${r.rank || "N/A"}`
                        ).join("\n\n");

                        return interaction.update({
                            content: `✅ Đã xóa thành công ${rows.length} acc:\n\n${info}`,
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
