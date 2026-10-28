require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits, Collection, REST, Routes } = require("discord.js");

const startAutoReturn = require("./autoReturn");
require("./keepAlive");

// Khởi tạo Client với đầy đủ Intents cần thiết
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers // BẮT BUỘC: Bật Intent này để lệnh /checkverified quét thành viên
  ]
});

client.commands = new Collection();

// Tự động tìm thư mục commands (Hỗ trợ cả khi file nằm ở gốc hoặc trong riot-bot/)
let commandsPath = path.join(__dirname, "commands");
if (!fs.existsSync(commandsPath)) {
  commandsPath = path.join(__dirname, "riot-bot", "commands");
}

if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith(".js"));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    delete require.cache[require.resolve(filePath)]; // Xóa cache node.js để nạp bản mới nhất
    const command = require(filePath);

    if (command.data && command.data.name) {
      client.commands.set(command.data.name, command);
      console.log(`✔ Bot đã nạp lệnh: /${command.data.name}`);
    } else {
      console.log(`❌ Bỏ qua file ${file} - Thiếu thuộc tính 'data'`);
    }
  }
} else {
  console.error(`❌ KHÔNG TÌM THẤY THƯ MỤC COMMANDS TẠI: ${commandsPath}`);
}

// Tự động load toàn bộ events
let eventsPath = path.join(__dirname, "events");
if (!fs.existsSync(eventsPath)) {
  eventsPath = path.join(__dirname, "riot-bot", "events");
}

if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith(".js"));

  for (const file of eventFiles) {
    const event = require(path.join(eventsPath, file));

    client.on(event.name, async (...args) => {
      try {
        await event.execute(...args, client);
      } catch (err) {
        console.error(`❌ Event error (${event.name}):`, err);
      }
    });
  }
}

// ĐỒNG BỘ LỆNH TRỰC TIẾP KHI BOT READY
client.once("ready", async () => {
  console.log(`✅ Bot online thành công với tên: ${client.user.tag}`);

  try {
    const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
    const clientId = client.user.id;
    const guildId = process.env.GUILD_ID;

    if (clientId && guildId) {
      console.log(`⏳ Đang tiến hành ghi đè ${client.commands.size} lệnh lên Server (ID: ${guildId})...`);

      const commandsData = Array.from(client.commands.values()).map(cmd => cmd.data.toJSON());

      // Ghi đè trực tiếp danh sách lệnh hiện tại mà không cần dòng { body: [] } gây mất lệnh
      const result = await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commandsData }
      );

      console.log(`✨ [THÀNH CÔNG] Đã đồng bộ ${result.length} lệnh lên Server Discord!`);
    } else {
      console.error("❌ THIẾU GUILD_ID TRONG BIẾN MÔI TRƯỜNG!");
    }
  } catch (cleanErr) {
    console.error("❌ Lỗi khi đồng bộ lệnh Discord:", cleanErr);
  }

  // Khởi động hệ thống tự động trả tài khoản
  if (typeof startAutoReturn === "function") {
    startAutoReturn(client);
  }
});

client.login(process.env.TOKEN);
