const { EmbedBuilder } = require('discord.js');

const LOGS_CHANNEL_ID = '1438972014881669131';

// Only these roles can use /kick
const MOD_ROLE_IDS = [
    '1438933975115759798',
];

// Check for kick perms
function hasModRole(interaction) {
    const member = interaction.member;
    if (!member || !member.roles) return false;
    return MOD_ROLE_IDS.some(roleId => member.roles.cache.has(roleId));
}

function setupKicks(client) {
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        // kick
        if (interaction.commandName === 'kick') {
            if (!hasModRole(interaction)) {
                await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
                return;
            }

            const user = interaction.options.getUser('user');
            const userId = interaction.options.getString('user-id');
            const reason = interaction.options.getString('reason') || 'No reason provided';

            let targetUser = user;
            if (!targetUser && userId) {
                try {
                    targetUser = await client.users.fetch(userId);
                } catch (error) {
                    await interaction.reply({ content: 'Could not fetch the user with the provided ID.', ephemeral: true });
                    return;
                }
            }

            if (!targetUser) {
                await interaction.reply({ content: 'Please provide a valid user or user ID.', ephemeral: true });
                return;
            }

            const member = interaction.guild.members.cache.get(targetUser.id);
            if (!member) {
                await interaction.reply({ content: 'The user is not in this server.', ephemeral: true });
                return;
            }

            if (!member.kickable) {
                await interaction.reply({ content: 'I do not have permission to kick this user.', ephemeral: true });
                return;
            }

            if(targetUser) {
                const reasonDM = new EmbedBuilder()
                    .setTitle(`👢 You have been kicked from ${interaction.guild.name}`)
                    .addFields(
                        { name: 'Reason', value: reason }
                    )
                    .setColor('#FF0000');
                await targetUser.send({ embeds: [reasonDM] });
            }

            // log kick and perform it
            const kickEmbed = new EmbedBuilder()
                .setTitle('👢 User Kicked')
                .addFields(
                    { name: 'User', value: `${targetUser} (${targetUser.id})` },
                    { name: 'Kicked by', value: `${interaction.user} (${interaction.user.id})` },
                    { name: 'Reason', value: reason }
                )
                .setColor('#FFA500')
                .setTimestamp()
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }) || null);
            const logChannel = interaction.guild.channels.cache.get(LOGS_CHANNEL_ID);
            if (logChannel) {
                await logChannel.send({ embeds: [kickEmbed] }).catch(() => {});
            }

            await member.kick(reason);

            await interaction.reply(`✅ Kicked **${targetUser.tag}** for: *${reason}*`);
        }
    });
}

module.exports = setupKicks;