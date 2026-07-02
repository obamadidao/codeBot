require("dotenv").config();
const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

const commands = [];

// Đường dẫn trỏ thẳng đến thư mục commands chứa các tệp lệnh (Đồng bộ theo thư mục riot-bot/)
const commandsPath = path.join(__dirname, "commands");

// Đọc toàn bộ các file .js trong thư mục commands
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    // ==========================================================
    // KIỂM TRA BẢO MẬT & ĐỘ HỢP LỆ CỦA LỆNH (SAFE CHECK)
    // ==========================================================
    if (command.data) {
        commands.push(command.data.toJSON());
        console.log(`✔ Đã chuẩn bị đăng ký lệnh: /${command.data.name} (Từ file: ${file})`);
    } else {
        console.log(`❌ BỎ QUA FILE ${file} - Thiếu thuộc tính cấu hình 'data'`);
    }
}

console.log(`\n📦 Tổng số lệnh chuẩn bị đăng ký lên Discord: ${commands.length}`);

// Khởi tạo REST với Token của Bot
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
    try {
        const clientId = process.env.CLIENT_ID;
        const guildId = process.env.GUILD_ID;

        if (!clientId || !guildId) {
            console.error("❌ LỖI THIẾU BIẾN: Bạn cần điền đầy đủ CLIENT_ID và GUILD_ID trong file .env hoặc cấu hình Variables trên Railway!");
            process.exit(1);
        }

        console.log(`\n⏳ Đang tiến hành đăng ký danh sách lệnh mới lên Server Discord (ID: ${guildId})...`);

        // Gửi yêu cầu đăng ký đè toàn bộ lệnh mới nhất cấp Server (Guild Commands) để hiển thị lập tức
        const result = await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands }
        );

        console.log(`✅ TUYỆT VỜI! Đã đồng bộ thành công ${result.length} lệnh lên Server Discord!`);
        console.log("👉 Bây giờ bạn có thể mở Discord lên, nhấn phím '/' hoặc reload Discord (Ctrl + R) để thấy các lệnh mới xuất hiện rực rỡ.");
    } catch (err) {
        console.error("❌ Gặp sự cố nghiêm trọng khi đẩy lệnh lên Discord:", err);
    }
})();
