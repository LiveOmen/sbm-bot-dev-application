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
    {
        name: 'mute',
        description: 'Mute a user',
        options: [
            {
                name: 'user',
                description: 'User to mute (if resolvable)',
                type: ApplicationCommandOptionType.User,
                required: false,
            },
            {
                name: 'user-id',
                description: 'ID of the user to mute',
                type: ApplicationCommandOptionType.String,
                required: false,
            },
            {
                name: 'reason',
                description: 'Reason for the mute',
                type: ApplicationCommandOptionType.String,
                required: false,
            },
            {
                name: 'duration',
                description: 'Duration of the mute (for temporary unmutes)',
                type: ApplicationCommandOptionType.String,
                required: false,
            },
        ],
    },
    {
        name: 'unmute',
        description: 'Unmute a user',
        options: [
            {
                name: 'user',
                description: 'User to unmute (if resolvable)',
                type: ApplicationCommandOptionType.User,
                required: false,
            },
            {
                name: 'user-id',
                description: 'ID of the user to unmute',
                type: ApplicationCommandOptionType.String,
                required: false,
            },
            {
                name: 'reason',
                description: 'Reason for the unmute',
                type: ApplicationCommandOptionType.String,
                required: false,
            },
        ],
    },
    {
        name: 'automod',
        description: 'Manage automod banned words',
        options: [
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: 'add',
                description: 'Add up to 3 words to the automod banned list',
                options: [
                    {
                        name: 'word1',
                        description: 'First word to add',
                        type: ApplicationCommandOptionType.String,
                        required: true,
                    },
                    {
                        name: 'word2',
                        description: 'Second word to add (optional)',
                        type: ApplicationCommandOptionType.String,
                        required: false,
                    },
                    {
                        name: 'word3',
                        description: 'Third word to add (optional)',
                        type: ApplicationCommandOptionType.String,
                        required: false,
                    },
                ],
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: 'remove',
                description: 'Remove up to 3 words from the automod banned list',
                options: [
                    {
                        name: 'word1',
                        description: 'First word to remove',
                        type: ApplicationCommandOptionType.String,
                        required: true,
                    },
                    {
                        name: 'word2',
                        description: 'Second word to remove (optional)',
                        type: ApplicationCommandOptionType.String,
                        required: false,
                    },
                    {
                        name: 'word3',
                        description: 'Third word to remove (optional)',
                        type: ApplicationCommandOptionType.String,
                        required: false,
                    },
                ],
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: 'list',
                description: 'List all automod banned words',
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
