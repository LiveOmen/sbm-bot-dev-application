const { EmbedBuilder } = require('discord.js');

const LOGS_CHANNEL_ID = '1438972014881669131';

// Only these roles can use /ban and /unban
const MOD_ROLE_IDS = [
    '1438933975115759798',
];

// Check for ban perms
function hasModRole(interaction) {
    const member = interaction.member;
    if (!member || !member.roles) return false;
    return MOD_ROLE_IDS.some(roleId => member.roles.cache.has(roleId));
}

function setupBans(client) {
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        // Guard: only mods can use these commands
        if (interaction.commandName === 'ban' || interaction.commandName === 'unban') {
            if (!hasModRole(interaction)) {
                return interaction.reply({
                    content: '❌ You do not have permission to use this command.',
                    ephemeral: true,
                });
            }
        }

        // /ban
        if (interaction.commandName === 'ban') {
            try {
                await interaction.deferReply({ ephemeral: true });

                const userOpt = interaction.options.getUser('user');        // may be null
                const userIdOpt = interaction.options.getString('user-id'); // may be null
                const reason = interaction.options.getString('reason') || 'No reason provided';

                if (!userOpt && !userIdOpt) {
                    return interaction.editReply(
                        '❌ You must provide either a user or a user ID.'
                    );
                }

                let targetUser = userOpt || null;
                const targetId = userOpt ? userOpt.id : userIdOpt;

                // Try to fetch user object if we only got an ID
                if (!targetUser) {
                    targetUser = await client.users.fetch(targetId).catch(() => null);
                }

                // Fetch member from the guild (for the actual ban)
                let member = await interaction.guild.members.fetch(targetId).catch(() => null);

                if (!member) {
                    // If not cached as member, try ban-by-id anyway
                    // (Discord allows banning by ID to prevent rejoin)
                    await interaction.guild.members.ban(targetId, { reason }).catch(async (err) => {
                        console.error('Error banning by ID:', err);
                        throw new Error('BAN_FAILED');
                    });

                    await interaction.editReply(
                        `✅ Banned user ID \`${targetId}\` for: *${reason}*`
                    );
                } else {
                    // Normal path: member is in guild
                    // Try to DM before ban
                    if (targetUser) {
                        const dmEmbed = new EmbedBuilder()
                            .setTitle('🔨 You have been banned')
                            .setColor('#ff3333')
                            .setDescription(
                                `You have been banned from **${interaction.guild.name}**.\n\n` +
                                `**Reason:** ${reason}\n` +
                                `**Banned by:** ${interaction.user.tag}`
                            )
                            .setTimestamp()
                            .setThumbnail(interaction.guild.iconURL({ dynamic: true }) || null);

                        await targetUser.send({ embeds: [dmEmbed] }).catch(() => {
                            // ignore DM failures
                        });
                    }

                    // Check bannable
                    if (!member.bannable) {
                        return interaction.editReply(
                            '❌ I cannot ban this user (likely higher role than me).'
                        );
                    }

                    await member.ban({ reason });

                    await interaction.editReply(
                        `✅ Banned **${targetUser ? targetUser.tag : targetId}** for: *${reason}*`
                    );
                }

                // Log embed
                const banEmbed = new EmbedBuilder()
                    .setTitle('🔨 User Banned')
                    .setColor('#ff3333')
                    .addFields(
                        {
                            name: 'User',
                            value: targetUser
                                ? `${targetUser} \`(${targetId})\``
                                : `\`ID: ${targetId}\``,
                        },
                        { name: 'Banned By', value: `${interaction.user} \`(${interaction.user.id})\`` },
                        { name: 'Reason', value: reason }
                    )
                    .setTimestamp()
                    .setThumbnail(targetUser?.displayAvatarURL({ dynamic: true }) || null);

                const logChannel = interaction.guild.channels.cache.get(LOGS_CHANNEL_ID);
                if (logChannel) {
                    await logChannel.send({ embeds: [banEmbed] }).catch(() => {});
                }
            } catch (err) {
                console.error('Error in /ban handler:', err);
                if (interaction.deferred || interaction.replied) {
                    interaction.editReply('❌ An error occurred while processing the ban.').catch(() => {});
                } else {
                    interaction.reply({
                        content: '❌ An error occurred while processing the ban.',
                        ephemeral: true,
                    }).catch(() => {});
                }
            }
        }

        // /unban
        if (interaction.commandName === 'unban') {
            try {
                await interaction.deferReply({ ephemeral: true });

                const userOpt = interaction.options.getUser('user');
                const userIdOpt = interaction.options.getString('user-id');
                const reason = interaction.options.getString('reason') || 'No reason provided';

                const targetId = userIdOpt || (userOpt && userOpt.id);

                if (!targetId) {
                    return interaction.editReply(
                        '❌ You must provide either a user or a user ID.'
                    );
                }

                // Try to fetch the ban info
                const banInfo = await interaction.guild.bans.fetch(targetId).catch(() => null);

                if (!banInfo) {
                    return interaction.editReply(
                        '❌ That user is not banned or the ID is invalid.'
                    );
                }

                await interaction.guild.members.unban(targetId, reason);

                await interaction.editReply(
                    `✅ Unbanned **${banInfo.user.tag}**`
                );

                // Log embed
                const unbanEmbed = new EmbedBuilder()
                    .setTitle('🟢 User Unbanned')
                    .setColor('#34eb4f')
                    .addFields(
                        { name: 'User', value: `${banInfo.user} \`(${banInfo.user.id})\`` },
                        { name: 'Unbanned By', value: `${interaction.user} \`(${interaction.user.id})\`` },
                        { name: 'Reason', value: reason }
                    )
                    .setTimestamp()
                    .setThumbnail(banInfo.user.displayAvatarURL({ dynamic: true }));

                const logChannel = interaction.guild.channels.cache.get(LOGS_CHANNEL_ID);
                if (logChannel) {
                    await logChannel.send({ embeds: [unbanEmbed] }).catch(() => {});
                }
            } catch (err) {
                console.error('Error in /unban handler:', err);
                if (interaction.deferred || interaction.replied) {
                    interaction.editReply('❌ An error occurred while processing the unban.').catch(() => {});
                } else {
                    interaction.reply({
                        content: '❌ An error occurred while processing the unban.',
                        ephemeral: true,
                    }).catch(() => {});
                }
            }
        }
    });
}

module.exports = setupBans;
