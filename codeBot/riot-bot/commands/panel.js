const {
    SlashCommandBuilder,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("panel")
        .setDescription("Tạo panel mượn acc"),

    async execute(interaction) {

        const embed = new EmbedBuilder()
            .setTitle("🎮 RIOT ACCOUNT SYSTEM")
            .setDescription("Bấm nút để xem danh sách acc")
            .setColor("Blue");

        const button = new ButtonBuilder()
            .setCustomId("open_acc")
            .setLabel("Xem danh sách acc")
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder()
            .addComponents(button);

        await interaction.reply({
            embeds: [embed],
            components: [row]
        });
    }
};