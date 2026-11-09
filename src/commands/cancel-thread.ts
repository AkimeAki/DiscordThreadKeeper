import { ChannelNotFoundError, GuildNotFoundError } from "#/error.ts";
import { deleteThread } from "#/libs/delete-thread.ts";
import { errorEmbed, successEmbed } from "#/libs/embed.ts";
import { getMessages } from "#/libs/messages.ts";
import type { CacheType, ChatInputCommandInteraction } from "discord.js";
import {
	ApplicationIntegrationType,
	InteractionContextType,
	Locale,
	MessageFlags,
	PermissionFlagsBits,
	SlashCommandBuilder
} from "discord.js";

export const cancelThreadCommand = {
	data: new SlashCommandBuilder()
		.setName("cancel")
		.setDescription(getMessages(Locale.EnglishUS).cancelDescription)
		.setDescriptionLocalizations({ [Locale.Japanese]: getMessages(Locale.Japanese).cancelDescription })
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageThreads)
		.setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
		.setNSFW(false)
		.setContexts(InteractionContextType.Guild),
	execute: async (interaction: ChatInputCommandInteraction<CacheType>): Promise<void> => {
		const messages = getMessages(interaction.locale);

		if (interaction.guild === null) {
			throw new GuildNotFoundError();
		}

		// アーカイブ済みのスレッドは接続直後の一覧に含まれず、キャッシュにないとinteraction.channelがnullになる
		const channel = interaction.channel ?? (await interaction.client.channels.fetch(interaction.channelId));
		if (channel === null) {
			throw new ChannelNotFoundError();
		}

		if (!channel.isThread()) {
			await interaction.reply({
				embeds: [errorEmbed(messages.notThreadTitle, messages.notThreadDescription)],
				flags: MessageFlags.Ephemeral
			});

			return;
		}

		const result = await deleteThread(interaction.guild.id, channel.id);

		if (result.numDeletedRows === BigInt(0)) {
			await interaction.reply({
				embeds: [errorEmbed(messages.notKeepingTitle, messages.notKeepingDescription)],
				flags: MessageFlags.Ephemeral
			});
		} else {
			await interaction.reply({
				embeds: [successEmbed(messages.cancelledTitle(channel.name), messages.cancelledDescription)]
			});
		}

		return;
	}
};
