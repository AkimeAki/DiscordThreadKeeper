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

		const result = await deleteThread(interaction.guild.id, channel.id);

		if (result.numDeletedRows === BigInt(0)) {
			await interaction.reply({
				embeds: [
					{
						description: messages.notKeepingDescription,
						color: 0xf44458,
						author: {
							name: messages.notKeepingTitle,
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
							name: messages.cancelledTitle(channel.name),
							icon_url: "https://r2.aki.wtf/check.png"
						}
					}
				]
			});
		}

		return;
	}
};
