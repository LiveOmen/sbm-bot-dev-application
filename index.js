require('dotenv').config();
const { Client, IntentsBitField } = require('discord.js');
const { Flags } = IntentsBitField;

// create client
const client = new Client({
    intents: [
        Flags.Guilds,
        Flags.GuildMembers,
        Flags.GuildMessages,
        Flags.GuildMessageReactions,
        Flags.DirectMessages,
        Flags.GuildMessagePolls,
        Flags.GuildWebhooks,
        Flags.GuildExpressions,
        Flags.GuildModeration,
        Flags.MessageContent,
    ],
});

client.on('clientReady', (c) => console.log(`✅ ${c.user.username} is online!`));

// hook up automod
const setupAutomod = require('./automod/automod.js');
setupAutomod(client);

// hook up ban/unban handlers
const setupBans = require('./automod/bans.js');
setupBans(client);

// login
const token = process.env.TOKEN;
if (!token) {
    console.error('❌ No TOKEN found in .env');
    process.exit(1);
}

client.login(token);
