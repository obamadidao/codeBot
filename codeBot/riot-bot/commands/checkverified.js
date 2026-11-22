const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const db = require("../db");

// ID Role Verified
const VERIFIED_ROLE_ID = "1268608479346823178";

// Lưu mốc thời gian fetch thành viên theo từng server để tránh lỗi GatewayRateLimitError (Opcode 8)
const lastFetchMap = new Map();
const FETCH_COOLDOWN_MS = 60 * 1000; // 60 giây

// Lấy toàn bộ acc hiện còn trong kho (bao gồm cả acc tự drop và acc được drop hộ qua createdBy)
function getAllAccountsInStock() {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM accounts ORDER BY id ASC", [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

// Chỉ lấy mã số acc (#ID) và tên tài khoản (taikhoan / username), KHÔNG lấy ingameName (ingameid)
function formatAccountLabel(row) {
    const accId = row.id !== undefined && row.id !== null ? `#${row.id} ` : "";
    const accName =
        (row.taikhoan && String(row.taikhoan).trim()) ||
        (row.username && String(row.username).trim()) ||
        "Chưa có tên TK";

    return `\`${accId}${accName}\``;
}

// Chia mảng các dòng thành nhiều đoạn nhỏ <= 1000 ký tự (không cắt ngang tên acc)
function chunkLines(lines, maxLength = 1000) {
    const chunks = [];
    let current = "";

    for (const line of lines) {
        const nextLine = current ? `\n${line}` : line;
        if ((current + nextLine).length <= maxLength) {
            current += nextLine;
        } else {
            if (current) {
                chunks.push(current);
                current = "";
            }

            // Trường hợp 1 người drop quá nhiều acc khiến riêng 1 dòng dài hơn 1000 ký tự
            if (line.length > maxLength) {
                const parts = line.split(", ");
                let subLine = "";
                for (const part of parts) {
                    const nextPart = subLine ? `, ${part}` : part;
                    if ((subLine + nextPart).length > maxLength) {
                        if (subLine) chunks.push(subLine);
                        subLine = `  ↳ ${part}`;
                    } else {
                        subLine += nextPart;
                    }
                }
                current = subLine;
            } else {
                current = line;
            }
        }
    }

    if (current) chunks.push(current);
    return chunks;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("checkverified")
        .setDescription("Xem danh sách thành viên Verified kèm số lượng và tên tài khoản các acc trong kho"),

    async execute(interaction) {
        await interaction.deferReply({ flags: 64 });

        try {
            const guild = interaction.guild;
            const now = Date.now();
            const lastFetch = lastFetchMap.get(guild.id) || 0;

            // Chỉ fetch toàn bộ thành viên nếu đã qua 60 giây hoặc cache chưa đủ người
            let members = guild.members.cache;
            if (now - lastFetch >= FETCH_COOLDOWN_MS || members.size < guild.memberCount) {
                const fetched = await guild.members.fetch().catch(() => null);
                if (fetched) {
                    members = fetched;
                    lastFetchMap.set(guild.id, now);
                }
            }

            // Lọc các thành viên có role Verified
            const verifiedMembers = members.filter(m =>
                !m.user.bot && (m.roles.cache.has(VERIFIED_ROLE_ID) || m.roles.cache.some(r => r.name === "Verified"))
            );

            if (verifiedMembers.size === 0) {
                return interaction.editReply({
                    content: "⚠️ Không tìm thấy thành viên nào có role Verified trong máy chủ."
                });
            }

            // Truy vấn toàn bộ acc còn trong kho và gom theo người sở hữu (createdBy)
            const rows = await getAllAccountsInStock();
            const accMap = new Map();
            for (const r of rows) {
                const ownerId = r.createdBy || r.ownerId;
                if (!ownerId) continue;
                if (!accMap.has(ownerId)) accMap.set(ownerId, []);
                accMap.get(ownerId).push(formatAccountLabel(r));
            }

            const hasDroppedRaw = [];
            const notDropped = [];

            verifiedMembers.forEach(member => {
                const userAccs = accMap.get(member.id) || [];

                // Hợp lệ khi có ít nhất 1 acc còn trong kho
                if (userAccs.length >= 1) {
                    hasDroppedRaw.push({
                        count: userAccs.length,
                        text: `• <@${member.id}> (\`${member.user.tag}\`) — **${userAccs.length} acc**: ${userAccs.join(", ")}`
                    });
                } else {
                    notDropped.push(`• <@${member.id}> (\`${member.user.tag}\`)`);
                }
            });

            // Sắp xếp người có nhiều acc trong kho nhất lên đầu
            hasDroppedRaw.sort((a, b) => b.count - a.count);
            const hasDropped = hasDroppedRaw.map(item => item.text);

            const embed = new EmbedBuilder()
                .setTitle("📊 BÁO CÁO TÌNH TRẠNG DROP ACC - ROLE VERIFIED")
                .setColor(0x00AE8D)
                .setFooter({ text: `Tổng acc hiện còn trong kho: ${rows.length} acc` })
                .setTimestamp();

            const fieldsToAdd = [];

            // 1. Nhóm chưa drop acc hoặc đã xóa hết acc khỏi kho (0 acc)
            if (notDropped.length === 0) {
                fieldsToAdd.push({
                    name: "🔴 Chưa drop acc / Đã xóa hết acc (0 người):",
                    value: "✅ Tất cả đều đã drop acc!"
                });
            } else {
                const notDroppedChunks = chunkLines(notDropped, 1000);
                notDroppedChunks.forEach((chunk, idx) => {
                    fieldsToAdd.push({
                        name: idx === 0
                            ? `🔴 Chưa drop acc / Đã xóa hết acc (${notDropped.length} người):`
                            : `🔴 Chưa drop acc (phần ${idx + 1}):`,
                        value: chunk
                    });
                });
            }

            // 2. Nhóm đã drop acc hợp lệ (>= 1 acc còn trong kho) kèm số lượng và tên tài khoản
            if (hasDropped.length === 0) {
                fieldsToAdd.push({
                    name: "🟢 Đã drop acc hợp lệ (0 người):",
                    value: "❌ Chưa có ai drop acc nào!"
                });
            } else {
                const hasDroppedChunks = chunkLines(hasDropped, 1000);
                hasDroppedChunks.forEach((chunk, idx) => {
                    fieldsToAdd.push({
                        name: idx === 0
                            ? `🟢 Đã drop acc hợp lệ (${hasDropped.length} người):`
                            : `🟢 Đã drop acc hợp lệ (phần ${idx + 1}):`,
                        value: chunk
                    });
                });
            }

            // Đảm bảo tổng số field <= 25 và tổng ký tự Embed <= 5800 theo chuẩn Discord API
            let totalChars = 150;
            const safeFields = [];
            for (const f of fieldsToAdd) {
                if (safeFields.length >= 25) break;
                if (totalChars + f.name.length + f.value.length > 5800) break;
                safeFields.push(f);
                totalChars += f.name.length + f.value.length;
            }

            embed.addFields(safeFields);

            return interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error("❌ Lỗi khi thực thi checkverified:", error);
            return interaction.editReply({ content: "❌ Gặp sự cố khi quét danh sách thành viên!" });
        }
    }
};