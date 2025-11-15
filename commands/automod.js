// src/automod/automod.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

// Path to the JSON file that stores banned words
const BANNED_WORDS_PATH = path.join(__dirname, 'moderation', 'bannedwords.json');

// Roles allowed to manage automod (/automod add/remove/list)
// Recommended admin only (for obvious reasons)
const MOD_ROLE_IDS = [
    '1438933975115759798',
];

// Loads banned words from JSON file
function loadBannedWords() {
    try {
        const raw = fs.readFileSync(BANNED_WORDS_PATH, 'utf8');
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
            return arr.map(w => String(w).toLowerCase());
        }
    } catch (err) {
        console.warn('bannedwords.json not found or invalid, starting with empty list');
    }
    return [];
}

// Saves banned words to JSON file
function saveBannedWords(words) {
    try {
        fs.writeFileSync(BANNED_WORDS_PATH, JSON.stringify(words, null, 2), 'utf8');
    } catch (err) {
        console.error('Failed to save banned words:', err);
    }
}

// Initialize in-memory list
let bannedWords = loadBannedWords();

// Check if user has mod role to manage automod
function hasModRole(interaction) {
    const member = interaction.member;
    if (!member || !member.roles) return false;
    return MOD_ROLE_IDS.some(roleId => member.roles.cache.has(roleId));
}

function setupAutomod(client) {

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

    // =============== MESSAGE HANDLER ===============
    client.on('messageCreate', async (message) => {
        try {
            if (!message.guild || message.author.bot) return;
            if (message.member?.roles.cache.has(exemptRoleId)) return;

            const raw = message.content;
            if (!raw) return;

            const lower         = raw.toLowerCase();
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

    // =============== /automod COMMAND HANDLER ===============
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;
        if (interaction.commandName !== 'automod') return;

        // perms check
        if (!hasModRole(interaction)) {
            return interaction.reply({
                content: '❌ You do not have permission to manage automod.',
                ephemeral: true,
            });
        }

        const sub = interaction.options.getSubcommand();

        // /automod add
        if (sub === 'add') {
            const w1 = interaction.options.getString('word1');
            const w2 = interaction.options.getString('word2');
            const w3 = interaction.options.getString('word3');

            const rawWords = [w1, w2, w3].filter(Boolean);
            if (rawWords.length === 0) {
                return interaction.reply({
                    content: '❌ You must specify at least one word to add.',
                    ephemeral: true,
                });
            }

            const toAdd = rawWords
                .map(w => w.trim().toLowerCase())
                .filter(w => w.length > 0);

            if (toAdd.length === 0) {
                return interaction.reply({
                    content: '❌ No valid words provided.',
                    ephemeral: true,
                });
            }

            let added = [];
            for (const w of toAdd) {
                if (!bannedWords.includes(w)) {
                    bannedWords.push(w);
                    added.push(w);
                }
            }

            if (added.length > 0) {
                saveBannedWords(bannedWords);
            }

            return interaction.reply({
                content: added.length > 0
                    ? `✅ Added to automod list: \`${added.join('`, `')}\``
                    : 'ℹ️ All provided words were already in the automod list.',
                ephemeral: true,
            });
        }

        // /automod remove
        if (sub === 'remove') {
            const w1 = interaction.options.getString('word1');
            const w2 = interaction.options.getString('word2');
            const w3 = interaction.options.getString('word3');

            const rawWords = [w1, w2, w3].filter(Boolean);
            if (rawWords.length === 0) {
                return interaction.reply({
                    content: '❌ You must specify at least one word to remove.',
                    ephemeral: true,
                });
            }

            const toRemove = rawWords
                .map(w => w.trim().toLowerCase())
                .filter(w => w.length > 0);

            if (toRemove.length === 0) {
                return interaction.reply({
                    content: '❌ No valid words provided.',
                    ephemeral: true,
                });
            }

            const beforeCount = bannedWords.length;
            bannedWords = bannedWords.filter(w => !toRemove.includes(w));
            const removedCount = beforeCount - bannedWords.length;

            if (removedCount > 0) {
                saveBannedWords(bannedWords);
            }

            return interaction.reply({
                content: removedCount > 0
                    ? `✅ Removed ${removedCount} word(s) from the automod list.`
                    : 'ℹ️ None of the provided words were in the automod list.',
                ephemeral: true,
            });
        }

        // /automod list
        if (sub === 'list') {
            if (bannedWords.length === 0) {
                return interaction.reply({
                    content: 'ℹ️ The automod banned words list is currently empty.',
                    ephemeral: true,
                });
            }

            // Chunk if super long; for now simple join
            const sorted = [...bannedWords].sort();
            const display = sorted.join(', ');

            const listEmbed = new EmbedBuilder()
                .setTitle('🛡️ Automod Banned Words')
                .setDescription(display.length > 4000 ? display.slice(0, 3970) + '…' : display)
                .setColor('#d13838')
                .setTimestamp();

            return interaction.reply({
                embeds: [listEmbed],
                ephemeral: true,
            });
        }
    });
}

module.exports = setupAutomod;
