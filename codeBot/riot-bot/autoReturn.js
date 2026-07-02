const db = require("./db");

module.exports = (client) => {
    console.log("🔄 Auto Return Started");

    setInterval(() => {
        const FOUR_HOURS = 4 * 60 * 60 * 1000; // 4 tiếng đổi ra mili-giây (đồng bộ theo cấu hình của bạn)

        db.all(
            "SELECT * FROM accounts WHERE isBorrowed = 1",
            [],
            async (err, rows) => {
                if (err) {
                    console.error("❌ Lỗi khi tải tài khoản đang mượn từ DB:", err);
                    return;
                }

                if (!rows || rows.length === 0) return;

                // Sử dụng vòng lặp an toàn và tuần tự
                for (const acc of rows) {
                    try {
                        if (!acc.borrowTime) {
                            // Phòng trường hợp tài khoản cũ bị kẹt NULL trong Database, tự động trả để giải phóng
                            console.log(`⚠️ Tài khoản ${acc.id} không có borrowTime. Tiến hành tự động hồi trả để sửa dữ liệu...`);
                            db.run("UPDATE accounts SET isBorrowed = 0, borrowedBy = NULL, borrowTime = NULL WHERE id = ?", [acc.id]);
                            continue;
                        }

                        // Sửa lỗi lệch đơn vị thời gian (nếu lưu dạng giây thì tự quy đổi sang mili-giây)
                        let borrowTimestamp = Number(acc.borrowTime);
                        if (String(borrowTimestamp).length === 10) {
                            borrowTimestamp *= 1000;
                        }

                        const expired = Date.now() - borrowTimestamp >= FOUR_HOURS;
                        if (!expired) continue;

                        db.run(
                            `
                            UPDATE accounts
                            SET
                                isBorrowed = 0,
                                borrowedBy = NULL,
                                borrowTime = NULL
                            WHERE id = ?
                            `,
                            [acc.id],
                            async (updateErr) => {
                                if (updateErr) {
                                    console.error(`❌ Không thể cập nhật trả tài khoản ${acc.id} trong DB:`, updateErr);
                                    return;
                                }

                                console.log(`✅ Auto returned account ${acc.id}`);

                                // Gửi tin nhắn thông báo sử dụng Direct Fetch tránh lỗi rỗng Cache
                                try {
                                    const logChannel = client.channels.cache.get("1345689852804464652")
                                        || await client.channels.fetch("1345689852804464652").catch(() => null);

                                    if (logChannel && logChannel.isTextBased()) {
                                        await logChannel.send(
`📤 **[TỰ ĐỘNG THU HỒI]**

👤 Người mượn trước đó: <@${acc.borrowedBy}>
🆔 IG: **${acc.ingameName || "N/A"}**
⏱️ Thời gian thu hồi: <t:${Math.floor(Date.now() / 1000)}:F>
⚠️ *Hệ thống đã tự động thu hồi tài khoản sau 4 tiếng mượn quy định.*
───────────────────`
                                        ).catch(() => null);
                                    }
                                } catch (discordErr) {
                                    console.error("❌ Lỗi gửi thông báo lên kênh Discord:", discordErr);
                                }
                            }
                        );

                    } catch (itemErr) {
                        console.error(`❌ Gặp lỗi bất ngờ khi xử lý tài khoản ID ${acc.id}:`, itemErr);
                    }
                }
            }
        );

    }, 60000); // kiểm tra mỗi 1 phút
};
