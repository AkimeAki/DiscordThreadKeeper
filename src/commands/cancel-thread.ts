import { ChannelNotFoundError, GuildNotFoundError } from "#/error.ts";
import { deleteThread } from "#/libs/delete-thread.ts";
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

		if (interaction.channel === null) {
			throw new ChannelNotFoundError();
		}

		if (interaction.guild === null) {
			throw new GuildNotFoundError();
		}

		if (!interaction.channel.isThread()) {
			await interaction.reply({
				embeds: [
					{
						description: messages.notThreadDescription,
						color: 0xf44458,
						author: {
							name: messages.notThreadTitle,
							icon_url: "https://r2.aki.wtf/report.png"
						}
					}
				],
				flags: MessageFlags.Ephemeral
			});

			return;
		}

		const result = await deleteThread(interaction.guild.id, interaction.channel.id);

		if (result.numDeletedRows === BigInt(0)) {
			await interaction.reply({
				embeds: [
					{
						description: messages.notWatchingDescription,
						color: 0xf44458,
						author: {
							name: messages.notWatchingTitle,
							icon_url: "https://r2.aki.wtf/report.png"
						}
					}
				],
				flags: MessageFlags.Ephemeral
			});
		} else {
			await interaction.reply({
				embeds: [
					{
						description: messages.cancelledDescription,
						color: 0xedf8aa,
						author: {
							name: messages.cancelledTitle(interaction.channel.name),
							icon_url: "https://r2.aki.wtf/check.png"
						}
					}
				]
			});
		}

		return;
	}
};
