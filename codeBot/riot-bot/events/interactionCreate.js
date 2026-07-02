const {
    ActionRowBuilder,
    StringSelectMenuBuilder
} = require("discord.js");

const db = require("../db");

// ID vai trò Verified để kiểm tra quyền hạn mượn và được thêm hộ tài khoản
const VERIFIED_ROLE_ID = "1268608479346823178";

/**
 * Kiểm tra xem thành viên có vai trò Verified hay không (Hỗ trợ quét cả tên hoặc ID vai trò)
 * @param {import("discord.js").GuildMember} member Thành viên cần kiểm tra
 * @returns {boolean}
 */
function hasVerifiedRole(member) {
    if (!member) return false;
    return member.roles.cache.has(VERIFIED_ROLE_ID) || member.roles.cache.some(r => r.name === "Verified");
}

// ==========================================
// HÀM GỬI NHẬT KÝ BẢO MẬT (SAFE LOG FUNCTION)
// ==========================================
async function sendLog(interaction, message) {
    try {
        if (!interaction.guild) return;

        const channel = await interaction.guild.channels.fetch("1345689852804464652").catch(() => null);
        if (!channel || !channel.isTextBased()) return;

        await channel.send({ content: message }).catch(() => null);
    } catch (e) {
        console.error("❌ LỖI GỬI NHẬT KÝ (LOG ERROR):", e);
    }
}

module.exports = {
    name: "interactionCreate",

    async execute(interaction, client) {
        try {
            // ==========================================
            // A. LỆNH SLASH COMMANDS
            // ==========================================
            if (interaction.isChatInputCommand()) {
                const ALLOWED_CHANNEL_ID = "1510684535203958865";

                // Giới hạn chỉ cho phép thực thi lệnh mượn/quản lý acc tại kênh chỉ định
                if (interaction.channelId !== ALLOWED_CHANNEL_ID) {
                    return interaction.reply({
                        content: `❌ Bạn ơi, vui lòng di chuyển sang kênh <#${ALLOWED_CHANNEL_ID}> để sử dụng lệnh nhé! Kênh này để đăng thông báo nè.`,
                        flags: 64 // Ẩn tin nhắn, chỉ một mình người gõ sai nhìn thấy
                    });
                }

                const command = client.commands.get(interaction.commandName);
                if (!command) return;
                return await command.execute(interaction, client);
            }

            // ==========================================
            // B. HỘP CHUYỂN TIẾP CHO SỬA & XÓA ACC (EDIT / DELETE HANDLER)
            // ==========================================
            const edit = require("../commands/editacc");
            const del = require("../commands/delacc");

            // Nếu các tệp lệnh editacc/delacc tự nhận diện được CustomId của chúng, chúng sẽ xử lý và trả về true để ngắt luồng tại đây
            if (await edit.handle(interaction)) return;
            if (await del.handle(interaction)) return;

            // ==========================================
            // C. NÚT BẤM MỞ DANH SÁCH TÀI KHOẢN (OPEN ACC LIST)
            // ==========================================
            if (interaction.isButton() && interaction.customId === "open_acc") {

                if (!hasVerifiedRole(interaction.member)) {
                    return interaction.reply({ 
                        content: `❌ Bạn cần có vai trò **Verified** (Cần role <@&${VERIFIED_ROLE_ID}>) để xem danh sách tài khoản mượn!`, 
                        flags: 64 
                    });
                }

                db.all("SELECT * FROM accounts", [], (err, rows) => {
                    if (err) {
                        console.error("❌ Lỗi DB khi lấy danh sách acc:", err);
                        return interaction.reply({ content: "❌ Lỗi hệ thống cơ sở dữ liệu!", flags: 64 });
                    }
                    if (!rows?.length) {
                        return interaction.reply({ content: "❌ Hiện tại hệ thống đang trống, chưa có tài khoản nào sẵn sàng!", flags: 64 });
                    }

                    const menu = new StringSelectMenuBuilder()
                        .setCustomId("select_acc")
                        .setPlaceholder("📋 Chọn một tài khoản bạn muốn mượn");

                    rows.forEach(acc => {
                        const status = acc.isBorrowed ? "🔴 Đang dùng" : "🟢 Trống";

                        menu.addOptions({
                            label: `👤 IG: ${acc.ingameName || "Chưa có"} | ${status}`.slice(0, 100),
                            description: `🏆 Rank: ${acc.rank || "N/A"}`,
                            value: String(acc.id)
                        });
                    });

                    return interaction.reply({
                        content: "📋 **Danh sách tài khoản mượn hiện có trên hệ thống:**",
                        components: [new ActionRowBuilder().addComponents(menu)],
                        flags: 64
                    });
                });
                return;
            }

            // ==========================================
            // D. CHỌN MƯỢN TÀI KHOẢN (SELECT ACC - BORROW)
            // ==========================================
            if (interaction.isStringSelectMenu() && interaction.customId === "select_acc") {

                if (!hasVerifiedRole(interaction.member)) {
                    return interaction.reply({ 
                        content: `❌ Bạn cần có vai trò **Verified** (Cần role <@&${VERIFIED_ROLE_ID}>) mới có quyền mượn tài khoản!`, 
                        flags: 64 
                    });
                }

                const id = interaction.values[0];

                // Kiểm tra xem người dùng này đã mượn một tài khoản nào trước đó chưa
                db.get(
                    "SELECT * FROM accounts WHERE borrowedBy = ?",
                    [interaction.user.id],
                    (err, already) => {
                        if (err) {
                            console.error("❌ Lỗi DB truy vấn trạng thái người mượn:", err);
                            return interaction.reply({ content: "❌ Lỗi hệ thống cơ sở dữ liệu!", flags: 64 });
                        }
                        if (already) {
                            return interaction.reply({ 
                                content: `❌ Bạn đã mượn tài khoản **${already.ingameName || "N/A"}** rồi! Vui lòng trả tài khoản đó trước khi muốn mượn tài khoản mới.`, 
                                flags: 64 
                            });
                        }

                        // Lấy thông tin tài khoản đích muốn mượn
                        db.get(
                            "SELECT * FROM accounts WHERE id = ?",
                            [id],
                            (err, acc) => {
                                if (err) {
                                    console.error("❌ Lỗi DB truy vấn acc mượn:", err);
                                    return interaction.reply({ content: "❌ Lỗi hệ thống cơ sở dữ liệu!", flags: 64 });
                                }
                                if (!acc) {
                                    return interaction.reply({ content: "❌ Không tìm thấy thông tin tài khoản này trên hệ thống!", flags: 64 });
                                }
                                if (acc.isBorrowed) {
                                    return interaction.reply({ content: "❌ Tài khoản này hiện đang được người khác mượn sử dụng rồi!", flags: 64 });
                                }

                                // 🟢 KHẮC PHỤC TRIỆT ĐỂ LỖI BẤT ĐỒNG BỘ: Gửi phản hồi TRONG callback của lệnh cập nhật DB thành công
                                db.run(
                                    "UPDATE accounts SET isBorrowed = 1, borrowedBy = ?, borrowTime = ? WHERE id = ?",
                                    [interaction.user.id, Date.now(), id],
                                    (updateErr) => {
                                        if (updateErr) {
                                            console.error("❌ Lỗi cập nhật trạng thái mượn tài khoản:", updateErr);
                                            return interaction.reply({ content: "❌ Gặp sự cố hệ thống khi ghi nhận mượn tài khoản!", flags: 64 });
                                        }

                                        // Đồng bộ hóa tên trường dữ liệu mới (taikhoan / matkhau) và hỗ trợ dự phòng trường cũ (username / password)
                                        const finalUser = acc.taikhoan || acc.username || "Không rõ";
                                        const finalPass = acc.matkhau || acc.password || "Không rõ";

                                        interaction.reply({
                                            content: `🎮 **ĐÃ MƯỢN TÀI KHOẢN THÀNH CÔNG! THÔNG TIN CHI TIẾT:**\n\n🆔 IG: **${acc.ingameName || "Chưa có"}**\n🏆 Rank: **${acc.rank || "N/A"}**\n👤 Tài khoản: \`${finalUser}\`\n🔐 Mật khẩu: \`${finalPass}\`\n\n⚠️ *Lưu ý: Thời gian mượn tối đa là 4 tiếng. Sau thời gian này hệ thống sẽ tự động thu hồi tài khoản của bạn.*`,
                                            flags: 64
                                        });

                                        // GỬI LOG MƯỢN ACC CHI TIẾT
                                        sendLog(interaction,
                                            `📥 **[MƯỢN ACC]**\n\n👤 Người mượn: ${interaction.user.tag} (<@${interaction.user.id}>)\n🆔 IG: **${acc.ingameName || "N/A"}**\n⏱️ Thời gian: <t:${Math.floor(Date.now() / 1000)}:F>\n───────────────────`
                                        );
                                    }
                                );
                            }
                        );
                    }
                );
                return;
            }

            // ==========================================
            // E. LƯU TÀI KHOẢN MỚI TỪ KHUNG NHẬP LIỆU (ADD ACC MODAL)
            // ==========================================
            if (interaction.isModalSubmit() && interaction.customId === "acc_modal") {
                const username = interaction.fields.getTextInputValue("username");
                const password = interaction.fields.getTextInputValue("password");
                const rank = interaction.fields.getTextInputValue("rank");

                // 🟢 ĐỒNG BỘ CỘT DỮ LIỆU MỚI: taikhoan, matkhau, rank và THÊM createdBy để xác định chủ sở hữu hợp pháp
                db.run(
                    "INSERT INTO accounts (taikhoan, matkhau, rank, createdBy) VALUES (?, ?, ?, ?)",
                    [username, password, rank, interaction.user.id],
                    (insertErr) => {
                        if (insertErr) {
                            console.error("❌ Lỗi DB khi thêm tài khoản mới từ Modal:", insertErr);
                            return interaction.reply({ 
                                content: "❌ Không thể lưu tài khoản vào cơ sở dữ liệu. Vui lòng liên hệ Admin!", 
                                ephemeral: true 
                            });
                        }

                        return interaction.reply({
                            content: "✅ **Đã lưu thông tin tài khoản thành công!** Hệ thống đã ghi nhận bạn là chủ sở hữu chính thức (Bạn có quyền sử dụng `/editacc` hoặc `/delacc` đối với tài khoản này).",
                            ephemeral: true
                        });
                    }
                );
            }

        } catch (err) {
            console.error("❌ PHÁT HIỆN LỖI SỰ KIỆN TƯƠNG TÁC (INTERACTION ERROR):", err);

            if (!interaction.replied && !interaction.deferred) {
                return interaction.reply({
                    content: "❌ Đã xảy ra lỗi bất ngờ từ phía hệ thống Bot! Vui lòng thử lại sau.",
                    ephemeral: true
                }).catch(() => null);
            }
        }
    }
};
