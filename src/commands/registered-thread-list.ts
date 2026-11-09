import { GuildNotFoundError } from "#/error.ts";
import { successEmbed } from "#/libs/embed.ts";
import { db } from "#/libs/kysely.ts";
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

export const registeredThreadListCommand = {
	data: new SlashCommandBuilder()
		.setName("list")
		.setDescription(getMessages(Locale.EnglishUS).listDescription)
		.setDescriptionLocalizations({ [Locale.Japanese]: getMessages(Locale.Japanese).listDescription })
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageThreads)
		.setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
		.setContexts(InteractionContextType.Guild),
	execute: async (interaction: ChatInputCommandInteraction<CacheType>): Promise<void> => {
		const messages = getMessages(interaction.locale);

		if (!interaction.inCachedGuild()) {
			throw new GuildNotFoundError();
		}

		const result = await db
			// prettier
			.selectFrom("threads")
			.select("thread_id")
			.where("guild_id", "=", interaction.guild.id)
			.execute();

		if (result.length === 0) {
			await interaction.reply({ embeds: [successEmbed(messages.emptyListTitle)], flags: MessageFlags.Ephemeral });

			return;
		}

		// 名前を書かずメンションにすると、閲覧できない人にはDiscordが名前を隠す。登録の上限まで並べても説明文の上限の4096文字に収まる
		const description = result
			.map(({ thread_id: threadId }) => {
				return `- <#${threadId}>`;
			})
			.join("\n");

		await interaction.reply({
			embeds: [successEmbed(messages.listTitle, description)],
			flags: MessageFlags.Ephemeral
		});
	}
};
