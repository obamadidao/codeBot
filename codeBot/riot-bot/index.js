const startAutoReturn = require("./autoReturn");
require("./keepAlive");
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits, Collection, REST, Routes } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers // 🟢 Bổ sung quyền quét thành viên để kiểm tra role Verified mượt mà
  ]
});

client.commands = new Collection();

// Tự động load toàn bộ lệnh trong thư mục commands vào bộ nhớ Bot
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath)
  .filter(f => f.endsWith(".js"));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command.data && command.data.name) {
    client.commands.set(command.data.name, command);
    console.log(`✔ Bot đã nạp lệnh: /${command.data.name}`);
  }
}

// Tự động load toàn bộ events trong thư mục events
const eventsPath = path.join(__dirname, "events");
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath)
    .filter(f => f.endsWith(".js"));

  for (const file of eventFiles) {
    const event = require(path.join(eventsPath, file));

    client.on(event.name, async (...args) => {
      try {
        await event.execute(...args, client);
      } catch (err) {
        console.log(`❌ Event error (${event.name}):`, err);
      }
    });
  }
}

// 🟢 TỰ ĐỘNG DỌN DẸP CACHE LỆNH CŨ KHI BOT ONLINE (Sửa lỗi ready sang clientReady)
client.once("clientReady", async () => {
  console.log(`✅ Bot online: ${client.user.tag}`);

  try {
    const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
    const clientId = client.user.id;
    const guildId = process.env.GUILD_ID;

    if (clientId && guildId) {
      console.log("🧹 [DỌN CACHE] Đang tiến hành xóa sạch bộ nhớ đệm lệnh Discord cũ trên Server...");
      
      // Xóa toàn bộ lệnh cấp Guild cũ bị kẹt
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: [] }
      );
      
      // Đăng ký lại danh sách lệnh mới nhất (bao gồm cả /addacc và /addaccho)
      const commandsData = [];
      client.commands.forEach(cmd => {
        commandsData.push(cmd.data.toJSON());
      });

      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commandsData }
      );

      console.log(`✨ [DỌN CACHE] Đã đồng bộ thành công ${commandsData.length} lệnh mới sạch sẽ lên Discord Server!`);
    }
  } catch (cleanErr) {
    console.error("❌ Lỗi khi tự động dọn dẹp cache lệnh Discord:", cleanErr);
  }

  // Khởi động hệ thống tự động trả tài khoản mượn
  startAutoReturn(client);
});

client.login(process.env.TOKEN);
