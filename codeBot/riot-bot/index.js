require("./keepAlive");
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits, Collection } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

client.commands = new Collection();

// load commands
const commandFiles = fs.readdirSync(path.join(__dirname, "commands"))
  .filter(f => f.endsWith(".js"));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.data.name, command);
}

// load events
const eventFiles = fs.readdirSync(path.join(__dirname, "events"))
  .filter(f => f.endsWith(".js"));

for (const file of eventFiles) {
  const event = require(`./events/${file}`);

  client.on(event.name, async (...args) => {
    try {
      await event.execute(...args, client);
    } catch (err) {
      console.log(`❌ Event error (${event.name}):`, err);
    }
  });
}

client.once("ready", () => {
  console.log(`✅ Bot online: ${client.user.tag}`);
});

client.login(process.env.TOKEN);