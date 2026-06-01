const db = require("./db");

module.exports = (client) => {

    console.log("🔄 Auto Return Started");

    setInterval(() => {

        console.log("⏰ Checking accounts...");

        const FIVE_HOURS = 30 * 1000; // test 30 giây

        db.all(
            "SELECT * FROM accounts WHERE isBorrowed = 1",
            [],
            (err, rows) => {

                if (err) {
                    console.log("❌ DB ERROR:", err);
                    return;
                }

                console.log("📋 Borrowed accounts:", rows);

                if (!rows || rows.length === 0) {
                    return;
                }

                rows.forEach(acc => {

                    console.log("🔍 Checking account:", {
                        id: acc.id,
                        ingameName: acc.ingameName,
                        borrowedBy: acc.borrowedBy,
                        borrowTime: acc.borrowTime
                    });

                    if (!acc.borrowTime) {
                        console.log(`❌ Account ${acc.id} không có borrowTime`);
                        return;
                    }

                    const diff = Date.now() - acc.borrowTime;

                    console.log(
                        `⏳ Account ${acc.id} | elapsed: ${Math.floor(diff / 1000)}s`
                    );

                    const expired = diff >= FIVE_HOURS;

                    if (!expired) {
                        return;
                    }

                    console.log(`✅ Auto returning account ${acc.id}`);

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
                        (err) => {

                            if (err) {
                                console.log("❌ UPDATE ERROR:", err);
                                return;
                            }

                            console.log(
                                `✅ Auto returned account ${acc.id}`
                            );
                        }
                    );

                    const guild = client.guilds.cache.first();

                    if (!guild) {
                        console.log("❌ Guild not found");
                        return;
                    }

                    const logChannel =
                        guild.channels.cache.get(
                            "1345689852804464652"
                        );

                    if (logChannel) {

                        logChannel.send(
`📤 [TRẢ ACC]

👤 Người mượn: <@${acc.borrowedBy}>
🆔 IG: ${acc.ingameName || "N/A"}

Acc đã được tự động trả sau 5 tiếng`
                        );

                    } else {
                        console.log("❌ Log channel not found");
                    }
                });
            }
        );

    }, 5000); // kiểm tra mỗi 5 giây
};
