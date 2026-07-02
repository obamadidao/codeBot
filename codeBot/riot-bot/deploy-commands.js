require("dotenv").config();
const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

const commands = [];

// Đường dẫn trỏ thẳng đến thư mục commands chứa các tệp lệnh
const commandsPath = path.join(__dirname, "commands");

// Đọc toàn bộ các file .js trong thư mục commands
const commandFiles = fs
    .readdirSync(commandsPath)
    .filter(f => f.endsWith(".js"));

for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));

    // ==========================================
    // KIỂM TRA BẢO MẬT PHÁT HIỆN SỰ TỒN TẠI LỆNH (SAFE CHECK)
    // ==========================================
    if (!command.data) {
        console.log(`❌ BỎ QUA FILE ${file} - Thiếu thuộc tính cấu hình 'data'`);
        continue;
    }

    if (typeof command.data.toJSON !== "function") {
        console.log(`❌ BỎ QUA FILE ${file} - SlashCommandBuilder không hợp lệ (Không có hàm toJSON)`);
        continue;
    }

    commands.push(command.data.toJSON());
    console.log(`✔ Đã nạp thành công lệnh: /${command.data.name} (Từ file: ${file})`);
}

console.log(`\n📦 Tổng số lệnh chuẩn bị đăng ký lên Discord: ${commands.length}`);

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
    try {
        const clientId = process.env.CLIENT_ID;
        const guildId = process.env.GUILD_ID;

        if (!clientId || !guildId) {
            console.error("❌ LỖI THIẾU BIẾN: Bạn cần điền đầy đủ CLIENT_ID và GUILD_ID trong file .env!");
            process.exit(1);
        }

        console.log("⏳ Đang tiến hành đăng ký danh sách lệnh mới lên Server Discord của bạn...");

        const result = await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands }
        );

        console.log(`✅ TUYỆT VỜI! Đã đồng bộ thành công ${result.length} lệnh lên Server Discord!`);
        console.log("👉 Bây giờ bạn có thể mở Discord lên, nhấn phím '/' để thấy lệnh /addaccho xuất hiện rực rỡ.");
    } catch (err) {
        console.error("❌ Gặp sự cố nghiêm trọng khi đẩy lệnh lên Discord:", err);
    }
})();
