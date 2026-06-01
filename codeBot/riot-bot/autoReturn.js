const db = require("./db");

module.exports = (client) => {

    setInterval(() => {

        const FIVE_HOURS = 1 * 60 * 1000;

        db.all(
            "SELECT * FROM accounts WHERE isBorrowed = 1",
            [],
            (err, rows) => {

                if (err || !rows) return;

                rows.forEach(acc => {

                    if (!acc.borrowTime) return;

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
                        guild.channels.cache.get(
                            "1345689852804464652"
                        );

                    if (logChannel) {

                        logChannel.send(
`⏰ [AUTO RETURN]

👤 Người mượn: <@${acc.borrowedBy}>
🆔 IG: ${acc.ingameName || "N/A"}

Acc đã được tự động trả sau 5 tiếng.`
                        );

                    }

                    console.log(
                        `✅ Auto returned account ${acc.id}`
                    );
                });
            }
        );

    }, 60000);

};
