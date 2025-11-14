require('dotenv').config();
const { Client, IntentsBitField, EmbedBuilder } = require('discord.js');
const { Flags } = IntentsBitField;

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

const bannedWords = [
    'fag','nigga','nigger','faggot','dyke','cunt','chink','beaner','nazi','retard','coon','negro','tranny','jiggaboo'
].map(w => w.toLowerCase());

const exemptRoleId = '1438667765085896805';
const logsChannel  = '1438664809200750703';

// leetspeak → keep punctuation
const applyLeet = str => str
    .toLowerCase()
    .replace(/[1!l]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/[4@]/g, 'a')
    .replace(/[0]/g, 'o')
    .replace(/[5\$]/g, 's');

// normalize: strip non-alphanum + collapse repeats
const normalizeForFilter = str => applyLeet(str)
    .replace(/[^a-z0-9]/g, '')
    .replace(/(.)\1+/g, '$1');

// Levenshtein
function levenshtein(a, b) {
    const dp = Array.from({ length: b.length + 1 }, (_, i) =>
        Array(a.length + 1).fill(0).map((_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            dp[i][j] = b[i - 1] === a[j - 1]
                ? dp[i - 1][j - 1]
                : Math.min(
                    dp[i - 1][j - 1] + 1, // sub
                    dp[i][j - 1] + 1,     // ins
                    dp[i - 1][j] + 1      // del
                );
        }
    }
    return dp[b.length][a.length];
}

const escapeRegExp = str => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const makeSpacingRegex = banned =>
    new RegExp(
        banned.split('').map(ch => `${escapeRegExp(ch)}[^a-z0-9]*`).join(''),
        'i'
    );

client.on('messageCreate', async (message) => {
    try {
        if (!message.guild || message.author.bot) return;
        if (message.member?.roles.cache.has(exemptRoleId)) return;

        const raw = message.content;
        if (!raw) return;

        const lower        = raw.toLowerCase();
        const leetPreserved = applyLeet(lower);
        const normalized    = normalizeForFilter(lower);

        let hit = null;

        outer: for (const banned of bannedWords) {
            // 1) direct substring on normalized text
            if (normalized && normalized.includes(banned)) {
                hit = { type: 'direct', match: banned, variant: normalized };
                break outer;
            }

            // 2) spacing / punctuation variants
            if (makeSpacingRegex(banned).test(leetPreserved)) {
                hit = { type: 'spaced', match: banned };
                break outer;
            }

            // 3) fuzzy edit-distance
            if (normalized) {
                const dist = levenshtein(normalized, banned);
                const maxEdits = banned.length >= 5 ? 2 : 1;
                if (dist <= maxEdits) {
                    hit = { type: 'fuzzy', match: normalized, target: banned, distance: dist };
                    break outer;
                }
            }
        }

        if (!hit) return;

        await message.delete().catch(() => {});

        const embed = new EmbedBuilder()
            .setTitle('⚠️ Deleted Banned Message')
            .setColor('#d13838')
            .setDescription(
                `A message was deleted in <#${message.channel.id}>.\n\n` +
                `**User:** ${message.author} \`(${message.author.id})\`\n` +
                `\n**Original message:**\n\`${raw}\``
            )
            .setTimestamp()
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }));

        message.guild.channels.cache.get(logsChannel)
            ?.send({ embeds: [embed] })
            .catch(() => {});
    } catch (err) {
        console.error('Error in automod handler:', err);
    }
});

client.login(process.env.TOKEN);