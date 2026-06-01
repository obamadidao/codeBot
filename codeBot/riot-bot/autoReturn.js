const db = require("./db");

module.exports = function(client) {

    setInterval(() => {

        const FIVE_HOURS = 5 * 60 * 60 * 1000;

        db.all(
            `
            SELECT *
            FROM accounts
            WHERE isBorrowed = 1
            AND borrowTime IS NOT NULL
            `,
            [],
            (err, rows) => {

                if (err) return console.log(err);

                rows.forEach(acc => {

                    const expired =
                        Date.now() - acc.borrowTime >= FIVE_HOURS;

                    if (!expired) return;

                    db.run(
                        `
                        UPDATE accounts
                        SET
                            isBorrowed = 0,
                            borrowedBy = NULL,
                            borrowTime = NULL
                        WHERE id = ?
                        `,
                        [acc.id]
                    );

                    const guild = client.guilds.cache.first();

                    if (!guild) return;

                    const logChannel =
                        guild.channels.cache.get("1345689852804464652");

                    if (logChannel) {
                        logChannel.send(
`⏰ [AUTO RETURN]

👤 Người mượn: <@${acc.borrowedBy}>
🎮 IGN: ${acc.ingameName || "N/A"}

Acc đã được tự động trả sau 5 tiếng.`
                        );
                    }

                    console.log(
                        `✅ Auto trả acc ID ${acc.id}`
                    );

                });

            }
        );

    }, 60 * 1000); // kiểm tra mỗi phút

};
