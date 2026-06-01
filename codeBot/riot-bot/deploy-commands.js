require("dotenv").config();
const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

const commands = [];

const commandFiles = fs
    .readdirSync(path.join(__dirname, "commands"))
    .filter(f => f.endsWith(".js"));

for (const file of commandFiles) {

    const command = require(`./commands/${file}`);

    // =========================
    // SAFE CHECK (QUAN TRỌNG)
    // =========================
    if (!command.data) {
        console.log(`❌ SKIP ${file} - missing data`);
        continue;
    }

    if (typeof command.data.toJSON !== "function") {
        console.log(`❌ SKIP ${file} - invalid SlashCommandBuilder`);
        continue;
    }

    commands.push(command.data.toJSON());
}

console.log("Commands loaded:", commands.length);

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
    try {
        const result = await rest.put(
            Routes.applicationGuildCommands(
                process.env.CLIENT_ID,
                process.env.GUILD_ID
            ),
            { body: commands }
        );

        console.log(`✅ Slash commands deployed: ${result.length}`);
    } catch (err) {
        console.log("❌ Deploy error:", err);
    }
})();