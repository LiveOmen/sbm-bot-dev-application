const { EmbedBuilder } = require('discord.js');

const LOGS_CHANNEL_ID = '1438972014881669131';

// Only these roles can use /mute
const MOD_ROLE_IDS = [
    '1438933975115759798',
];

const MUTED_ROLE_ID = '1439140036674064405';

// Max duration: 30 days in ms
const MAX_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

// Check for mute perms
function hasModRole(interaction) {
    const member = interaction.member;
    if (!member || !member.roles) return false;
    return MOD_ROLE_IDS.some(roleId => member.roles.cache.has(roleId));
}

// Parse duration strings like "10s", "10 sec", "10 minutes", "5d"
function parseDuration(durationStr) {
    if (!durationStr) return null;

    const trimmed = durationStr.trim().toLowerCase();

    // e.g. "10s", "10 s", "10sec", "10 seconds"
    const match = /^(\d+)\s*([a-z]+)$/.exec(trimmed);
    if (!match) return null;

    const amount = parseInt(match[1], 10);
    const unitRaw = match[2];

    if (!Number.isFinite(amount) || amount <= 0) return null;

    let unitMs = null;
    let unitSingular = '';
    let unitPlural = '';

    // seconds
    if (['s', 'sec', 'secs', 'second', 'seconds'].includes(unitRaw)) {
        unitMs = 1000;
        unitSingular = 'second';
        unitPlural = 'seconds';
    }
    // minutes
    else if (['m', 'min', 'mins', 'minute', 'minutes'].includes(unitRaw)) {
        unitMs = 60 * 1000;
        unitSingular = 'minute';
        unitPlural = 'minutes';
    }
    // days
    else if (['d', 'day', 'days'].includes(unitRaw)) {
        unitMs = 24 * 60 * 60 * 1000;
        unitSingular = 'day';
        unitPlural = 'days';
    } else {
        // unsupported unit
        return null;
    }

    let ms = amount * unitMs;
    let clamped = false;

    if (ms > MAX_DURATION_MS) {
        ms = MAX_DURATION_MS;
        clamped = true;
    }

    const label = amount === 1 ? unitSingular : unitPlural;
    const textBase = `${amount} ${label}`;

    const text = clamped ? '30 days (max duration)' : textBase;

    return { ms, text, clamped };
}

function setupMutes(client) {
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        if (interaction.commandName === 'mute') {
            if (!hasModRole(interaction)) {
                await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
                return;
            }

            const user = interaction.options.getUser('user');
            const userId = interaction.options.getString('user-id');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const durationRaw = interaction.options.getString('duration'); // free-form text like "10m", "10 minutes"

            let durationMs = null;
            let durationText = 'Indefinite';

            if (durationRaw) {
                const parsed = parseDuration(durationRaw);
                if (!parsed) {
                    await interaction.reply({
                        content: '❌ Invalid duration format. Use things like `10s`, `10 sec`, `10m`, `10 minutes`, `3d`. Max is 30 days.',
                        ephemeral: true,
                    });
                    return;
                }
                durationMs = parsed.ms;
                durationText = parsed.text;
            }

            let targetUser;
            if (user) {
                targetUser = user;
            } else if (userId) {
                try {
                    targetUser = await client.users.fetch(userId);
                } catch (error) {
                    await interaction.reply({ content: 'Could not find the user.', ephemeral: true });
                    return;
                }
            } else {
                await interaction.reply({ content: 'You must specify a user to mute.', ephemeral: true });
                return;
            }

            const member = interaction.guild.members.cache.get(targetUser.id);
            if (!member) {
                await interaction.reply({ content: 'Could not find the member in this server.', ephemeral: true });
                return;
            }

            // DM the user about their mute
            if (targetUser) {
                const reasonDM = new EmbedBuilder()
                    .setTitle(`🔇 You have been muted in ${interaction.guild.name}`)
                    .addFields(
                        { name: 'Reason', value: reason },
                        { name: 'Duration', value: durationText },
                    )
                    .setColor('#FF0000');
                await targetUser.send({ embeds: [reasonDM] }).catch(() => {});
            }

            try {
                await member.roles.add(MUTED_ROLE_ID);

                // Log the mute in logs channel
                const logsChannel = client.channels.cache.get(LOGS_CHANNEL_ID);
                if (logsChannel) {
                    const muteEmbed = new EmbedBuilder()
                        .setTitle('🔇 User Muted')
                        .addFields(
                            { name: 'User', value: `${targetUser} (${targetUser.id})` },
                            { name: 'Muted by', value: `${interaction.user} (${interaction.user.id})` },
                            { name: 'Reason', value: reason },
                            { name: 'Duration', value: durationText },
                        )
                        .setColor('#FF0000')
                        .setTimestamp();

                    logsChannel.send({ embeds: [muteEmbed] }).catch(() => {});
                }

                await interaction.reply({ content: `Successfully muted ${targetUser.tag} (${durationText})`, ephemeral: true });

                // If a duration was provided, schedule an automatic unmute
                if (durationMs && durationMs > 0) {
                    setTimeout(async () => {
                        try {
                            const guild = client.guilds.cache.get(interaction.guild.id);
                            if (!guild) return;

                            const freshMember = guild.members.cache.get(targetUser.id) || await guild.members.fetch(targetUser.id).catch(() => null);
                            if (!freshMember) return;

                            // Only unmute if they are still muted
                            if (!freshMember.roles.cache.has(MUTED_ROLE_ID)) return;

                            await freshMember.roles.remove(MUTED_ROLE_ID).catch(() => {});

                            // DM the user about their automatic unmute
                            const autoUnmuteDM = new EmbedBuilder()
                                .setTitle(`🔊 Your mute has expired in ${guild.name}`)
                                .addFields(
                                    { name: 'Original Reason', value: reason },
                                    { name: 'Duration', value: durationText },
                                )
                                .setColor('#00FF00');
                            await targetUser.send({ embeds: [autoUnmuteDM] }).catch(() => {});

                            // Log the auto-unmute
                            const logsChannel2 = client.channels.cache.get(LOGS_CHANNEL_ID);
                            if (logsChannel2) {
                                const autoUnmuteEmbed = new EmbedBuilder()
                                    .setTitle('🔊 User Automatically Unmuted')
                                    .addFields(
                                        { name: 'User', value: `${targetUser} (${targetUser.id})` },
                                        { name: 'Reason', value: `Mute duration expired (${durationText})` },
                                    )
                                    .setColor('#00FF00')
                                    .setTimestamp();

                                logsChannel2.send({ embeds: [autoUnmuteEmbed] }).catch(() => {});
                            }
                        } catch (e) {
                            console.error('Error in auto-unmute timeout:', e);
                        }
                    }, durationMs);
                }
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: `Failed to mute ${targetUser.tag}`, ephemeral: true });
            }
        }

        if (interaction.commandName === 'unmute') {
            if (!hasModRole(interaction)) {
                await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
                return;
            }

            const user = interaction.options.getUser('user');
            const userId = interaction.options.getString('user-id');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            let targetUser;

            if (user) {
                targetUser = user;
            } else if (userId) {
                try {
                    targetUser = await client.users.fetch(userId);
                } catch (error) {
                    await interaction.reply({ content: 'Could not find the user.', ephemeral: true });
                    return;
                }
            } else {
                await interaction.reply({ content: 'You must specify a user to unmute.', ephemeral: true });
                return;
            }

            const member = interaction.guild.members.cache.get(targetUser.id);
            if (!member) {
                await interaction.reply({ content: 'Could not find the member in this server.', ephemeral: true });
                return;
            }

            // DM the user about their unmute
            if (targetUser) {
                const reasonDM = new EmbedBuilder()
                    .setTitle(`🔊 You have been unmuted in ${interaction.guild.name}`)
                    .addFields(
                        { name: 'Reason', value: reason }
                    )
                    .setColor('#00FF00');
                await targetUser.send({ embeds: [reasonDM] }).catch(() => {});
            }

            try {
                await member.roles.remove(MUTED_ROLE_ID);

                // Log the unmute in logs channel
                const logsChannel = client.channels.cache.get(LOGS_CHANNEL_ID);
                if (logsChannel) {
                    const unmuteEmbed = new EmbedBuilder()
                        .setTitle('🔊 User Unmuted')
                        .addFields(
                            { name: 'User', value: `${targetUser} (${targetUser.id})` },
                            { name: 'Unmuted by', value: `${interaction.user} (${interaction.user.id})` },
                            { name: 'Reason', value: reason },
                        )
                        .setColor('#00FF00')
                        .setTimestamp();

                    logsChannel.send({ embeds: [unmuteEmbed] }).catch(() => {});
                }

                await interaction.reply({ content: `Successfully unmuted ${targetUser.tag}`, ephemeral: true });
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: `Failed to unmute ${targetUser.tag}`, ephemeral: true });
            }
        }
    });
}

module.exports = setupMutes;
