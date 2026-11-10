import { deleteThread } from "#/libs/delete-thread.ts";
import { errorEmbed, successEmbed } from "#/libs/embed.ts";
import { getThread } from "#/libs/get-thread.ts";
import { getMessages } from "#/libs/messages.ts";
import type { ChatInputCommandInteraction } from "discord.js";
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
		.setContexts(InteractionContextType.Guild),
	execute: async (interaction: ChatInputCommandInteraction): Promise<void> => {
		const messages = getMessages(interaction.locale);

		const { guildId, thread } = await getThread(interaction);

		const result = await deleteThread(guildId, thread.id);

		if (result.numDeletedRows === BigInt(0)) {
			await interaction.reply({
				embeds: [errorEmbed(messages.notKeepingTitle, messages.notKeepingDescription)],
				flags: MessageFlags.Ephemeral
			});
		} else {
			await interaction.reply({
				embeds: [successEmbed(messages.cancelledTitle(thread.name), messages.cancelledDescription)]
			});
		}
	}
};
