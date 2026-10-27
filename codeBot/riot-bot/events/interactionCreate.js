const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle
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
            // C. NÚT BẤM MỞ DANH SÁCH TÀI KHOẢN (OPEN ACC LIST - PHÂN TRANG)
            // ==========================================
            if (interaction.isButton() && interaction.customId.startsWith("open_acc")) {

                if (!hasVerifiedRole(interaction.member)) {
                    return interaction.reply({ 
                        content: `❌ Bạn cần có vai trò **Verified** (Cần role <@&${VERIFIED_ROLE_ID}>) để xem danh sách tài khoản mượn!`, 
                        flags: 64 
                    });
                }

                // 🟢 KIỂM TRA ĐIỀU KIỆN 1: BẮT BUỘC PHẢI ĐANG ĐÓNG GÓP (DROP) ÍT NHẤT 1 ACC VÀO HỆ THỐNG
                db.get(
                    "SELECT COUNT(*) as count FROM accounts WHERE createdBy = ?",
                    [interaction.user.id],
                    (checkErr, result) => {
                        if (checkErr) {
                            console.error("❌ Lỗi DB kiểm tra điều kiện sở hữu acc:", checkErr);
                            return interaction.reply({ content: "❌ Lỗi hệ thống cơ sở dữ liệu!", flags: 64 });
                        }

                        if (!result || result.count === 0) {
                            return interaction.reply({
                                content: `❌ **Quyền mượn bị từ chối!** Bạn cần phải đóng góp (drop) ít nhất **1 tài khoản** vào kho hệ thống thì mới được phép xem và mượn tài khoản khác.`,
                                flags: 64
                            });
                        }

                        // Đủ điều kiện sở hữu acc -> Tiến hành lấy danh sách acc
                        const isPageUpdate = interaction.customId.includes("_page_");
                        const page = isPageUpdate ? parseInt(interaction.customId.split("_page_")[1], 10) : 0;
                        const PAGE_SIZE = 20;

                        db.all("SELECT * FROM accounts", [], (err, rows) => {
                            if (err) {
                                console.error("❌ Lỗi DB khi lấy danh sách acc:", err);
                                return interaction.reply({ content: "❌ Lỗi hệ thống cơ sở dữ liệu!", flags: 64 });
                            }
                            if (!rows?.length) {
                                const emptyPayload = { content: "❌ Hiện tại hệ thống đang trống, chưa có tài khoản nào sẵn sàng!", flags: 64 };
                                return isPageUpdate ? interaction.update(emptyPayload) : interaction.reply(emptyPayload);
                            }

                            const totalAccounts = rows.length;
                            const totalPages = Math.ceil(totalAccounts / PAGE_SIZE);
                            const currentPage = Math.min(Math.max(0, page), totalPages - 1);

                            const startIdx = currentPage * PAGE_SIZE;
                            const endIdx = startIdx + PAGE_SIZE;
                            const limitedRows = rows.slice(startIdx, endIdx);

                            const menu = new StringSelectMenuBuilder()
                                .setCustomId("select_acc")
                                .setPlaceholder(`📋 Chọn tài khoản mượn (Trang ${currentPage + 1}/${totalPages})`);

                            limitedRows.forEach(acc => {
                                const status = acc.isBorrowed ? "🔴 Đang dùng" : "🟢 Trống";

                                menu.addOptions({
                                    label: `👤 IG: ${acc.ingameName || "Chưa có"} | ${status}`.slice(0, 100),
                                    description: `🏆 Rank: ${acc.rank || "N/A"}`,
                                    value: String(acc.id)
                                });
                            });

                            const components = [new ActionRowBuilder().addComponents(menu)];

                            if (totalPages > 1) {
                                const paginationRow = new ActionRowBuilder().addComponents(
                                    new ButtonBuilder()
                                        .setCustomId(`open_acc_page_${currentPage - 1}`)
                                        .setLabel("◀ Trang trước")
                                        .setStyle(ButtonStyle.Secondary)
                                        .setDisabled(currentPage === 0),
                                    new ButtonBuilder()
                                        .setCustomId("dummy_page_indicator")
                                        .setLabel(`${currentPage + 1}/${totalPages}`)
                                        .setStyle(ButtonStyle.Secondary)
                                        .setDisabled(true),
                                    new ButtonBuilder()
                                        .setCustomId(`open_acc_page_${currentPage + 1}`)
                                        .setLabel("Trang sau ▶")
                                        .setStyle(ButtonStyle.Secondary)
                                        .setDisabled(currentPage === totalPages - 1)
                                );
                                components.push(paginationRow);
                            }

                            const responsePayload = {
                                content: `📋 **Danh sách tài khoản mượn hiện có trên hệ thống:**\n*(Hiển thị trang số ${currentPage + 1}/${totalPages} - Tổng số: ${totalAccounts} acc)*`,
                                components: components,
                                flags: 64
                            };

                            if (isPageUpdate) {
                                return interaction.update(responsePayload);
                            } else {
                                return interaction.reply(responsePayload);
                            }
                        });
                    }
                );
                return;
            }

            // ==========================================
            // D. CHỌN MƯỢN TÀI KHOẢN (SELECT ACC - BORROW)
            // ==========================================
            if (interaction.isStringSelectMenu() && interaction.customId === "select_acc") {

                // 🟢 THÊM DEFER REPLY: Trì hoãn phản hồi để chống lỗi 10062 (Unknown Interaction)
                await interaction.deferReply({ flags: 64 });

                if (!hasVerifiedRole(interaction.member)) {
                    return interaction.editReply({ 
                        content: `❌ Bạn cần có vai trò **Verified** (Cần role <@&${VERIFIED_ROLE_ID}>) mới có quyền mượn tài khoản!`
                    });
                }

                // 🟢 KIỂM TRA ĐIỀU KIỆN 2: Kiểm tra lại số lượng acc đang sở hữu trước khi giao mật khẩu
                db.get(
                    "SELECT COUNT(*) as count FROM accounts WHERE createdBy = ?",
                    [interaction.user.id],
                    async (checkErr, userAccCount) => {
                        if (checkErr || !userAccCount || userAccCount.count === 0) {
                            return interaction.editReply({
                                content: `❌ **Thao tác thất bại!** Bạn hiện không sở hữu (drop) tài khoản nào trên hệ thống nên không thể mượn tài khoản.`
                            });
                        }

                        const id = interaction.values[0];

                        // Kiểm tra xem người dùng này đã mượn tài khoản nào trước đó chưa
                        db.get(
                            "SELECT * FROM accounts WHERE borrowedBy = ?",
                            [interaction.user.id],
                            (err, already) => {
                                if (err) {
                                    console.error("❌ Lỗi DB truy vấn trạng thái người mượn:", err);
                                    return interaction.editReply({ content: "❌ Lỗi hệ thống cơ sở dữ liệu!" });
                                }
                                if (already) {
                                    return interaction.editReply({ 
                                        content: `❌ Bạn đã mượn tài khoản **${already.ingameName || "N/A"}** rồi! Vui lòng trả tài khoản đó trước khi muốn mượn tài khoản mới.` 
                                    });
                                }

                                // Lấy thông tin tài khoản đích muốn mượn
                                db.get(
                                    "SELECT * FROM accounts WHERE id = ?",
                                    [id],
                                    (err, acc) => {
                                        if (err) {
                                            console.error("❌ Lỗi DB truy vấn acc mượn:", err);
                                            return interaction.editReply({ content: "❌ Lỗi hệ thống cơ sở dữ liệu!" });
                                        }
                                        if (!acc) {
                                            return interaction.editReply({ content: "❌ Không tìm thấy thông tin tài khoản này trên hệ thống!" });
                                        }
                                        if (acc.isBorrowed) {
                                            return interaction.editReply({ content: "❌ Tài khoản này hiện đang được người khác mượn sử dụng rồi!" });
                                        }

                                        // Cập nhật thông tin mượn tài khoản vào cơ sở dữ liệu
                                        db.run(
                                            "UPDATE accounts SET isBorrowed = 1, borrowedBy = ?, borrowTime = ? WHERE id = ?",
                                            [interaction.user.id, Date.now(), id],
                                            (updateErr) => {
                                                if (updateErr) {
                                                    console.error("❌ Lỗi cập nhật trạng thái mượn tài khoản:", updateErr);
                                                    return interaction.editReply({ content: "❌ Gặp sự cố hệ thống khi ghi nhận mượn tài khoản!" });
                                                }

                                                const finalUser = acc.taikhoan || acc.username || "Không rõ";
                                                const finalPass = acc.matkhau || acc.password || "Không rõ";

                                                interaction.editReply({
                                                    content: `🎮 **ĐÃ MƯỢN TÀI KHOẢN THÀNH CÔNG! THÔNG TIN CHI TIẾT:**\n\n🆔 IG: **${acc.ingameName || "Chưa có"}**\n🏆 Rank: **${acc.rank || "N/A"}**\n👤 Tài khoản: \`${finalUser}\`\n🔐 Mật khẩu: \`${finalPass}\`\n\n⚠️ *Lưu ý: Thời gian mượn tối đa là 4 tiếng. Sau thời gian này hệ thống sẽ tự động thu hồi tài khoản của bạn.*`
                                                });

                                                const returnTimestamp = Math.floor((Date.now() + 4 * 60 * 60 * 1000) / 1000);

                                                // Gửi log chi tiết
                                                sendLog(interaction,
                                                    `📥 **[MƯỢN ACC]**\n\n👤 Người mượn: ${interaction.user.tag} (<@${interaction.user.id}>)\n🆔 IG: **${acc.ingameName || "N/A"}**\n⏳ **Tự động trả lúc:** <t:${returnTimestamp}:F> (<t:${returnTimestamp}:R>)\n⏱️ Thời gian: <t:${Math.floor(Date.now() / 1000)}:F>\n───────────────────`
                                                );
                                            }
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

                db.run(
                    "INSERT INTO accounts (taikhoan, matkhau, rank, createdBy) VALUES (?, ?, ?, ?)",
                    [username, password, rank, interaction.user.id],
                    (insertErr) => {
                        if (insertErr) {
                            console.error("❌ Lỗi DB khi thêm tài khoản mới từ Modal:", insertErr);
                            return interaction.reply({ 
                                content: "❌ Không thể lưu tài khoản vào cơ sở dữ liệu. Vui lòng liên hệ Admin!", 
                                flags: 64 
                            });
                        }

                        return interaction.reply({
                            content: "✅ **Đã lưu thông tin tài khoản thành công!** Bạn đã kích hoạt quyền mượn acc trên hệ thống.",
                            flags: 64
                        });
                    }
                );
            }

        } catch (err) {
            console.error("❌ PHÁT HIỆN LỖI SỰ KIỆN TƯƠNG TÁC (INTERACTION ERROR):", err);

            if (!interaction.replied && !interaction.deferred) {
                return interaction.reply({
                    content: "❌ Đã xảy ra lỗi bất ngờ từ phía hệ thống Bot! Vui lòng thử lại sau.",
                    flags: 64
                }).catch(() => null);
            }
        }
    }
};
