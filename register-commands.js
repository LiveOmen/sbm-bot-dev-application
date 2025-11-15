require('dotenv').config();
const { REST, Routes, ApplicationCommandOptionType } = require('discord.js');

const commands = [
    {
        name: 'ban',
        description: 'Ban a specified member',
        options: [
            {
                name: 'user',
                description: 'User to ban',
                type: ApplicationCommandOptionType.User,
                required: false,
            },
            {
                name: 'user-id',
                description: 'ID of the user to ban (if user option is not used)',
                type: ApplicationCommandOptionType.String,
                required: false,
            },
            {
                name: 'reason',
                description: 'Reason for the ban',
                type: ApplicationCommandOptionType.String,
                required: false,
            },
        ],
    },
    {
        name: 'unban',
        description: 'Unban a user',
        options: [
            {
                name: 'user',
                description: 'User to unban (if resolvable)',
                type: ApplicationCommandOptionType.User,
                required: false,
            },
            {
                name: 'user-id',
                description: 'ID of the user to unban',
                type: ApplicationCommandOptionType.String,
                required: false,
            },
            {
                name: 'reason',
                description: 'Reason for the unban',
                type: ApplicationCommandOptionType.String,
                required: false,
            },
        ],
    },
    {
        name: 'kick',
        description: 'Kick a user',
        options: [
            {
                name: 'user',
                description: 'User to kick (if resolvable)',
                type: ApplicationCommandOptionType.User,
                required: false,
            },
            {
                name: 'user-id',
                description: 'ID of the user to kick',
                type: ApplicationCommandOptionType.String,
                required: false,
            },
            {
                name: 'reason',
                description: 'Reason for the kick',
                type: ApplicationCommandOptionType.String,
                required: false,
            },
        ],
    },
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('Registering slash commands');

        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands }
        );

        console.log('Slash commands were registered successfully!');
    } catch (error) {
        console.log(`There was an error: ${error}`);
    }
})();