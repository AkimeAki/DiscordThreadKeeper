import { ChannelNotFoundError, GuildNotFoundError } from "#/error.ts";
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

// 荒らしに大量のスレッドを登録されても、起動時の確認やDBが膨らみすぎないようにする
const maxThreadsPerGuild = 100;

export const registerThreadCommand = {
	data: new SlashCommandBuilder()
		.setName("register")
		.setDescription(getMessages(Locale.EnglishUS).registerDescription)
		.setDescriptionLocalizations({ [Locale.Japanese]: getMessages(Locale.Japanese).registerDescription })
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

		const { count } = await db
			.selectFrom("threads")
			.select((eb) => eb.fn.countAll().as("count"))
			.where("guild_id", "=", interaction.guild.id)
			.executeTakeFirstOrThrow();

		if (Number(count) >= maxThreadsPerGuild) {
			await interaction.reply({
				embeds: [
					{
						description: messages.limitDescription(maxThreadsPerGuild),
						color: 0xf44458,
						author: {
							name: messages.limitTitle,
							icon_url: "https://r2.aki.wtf/report.png"
						}
					}
				],
				flags: MessageFlags.Ephemeral
			});

			return;
		}

		await db
			// prettier
			.insertInto("threads")
			.values({
				id: crypto.randomUUID(),
				thread_id: interaction.channel.id,
				guild_id: interaction.guild.id,
				locale: interaction.locale
			})
			.execute();

		await interaction.channel.setAutoArchiveDuration(10080);

		await interaction.reply({
			embeds: [
				{
					description: messages.registeredDescription,
					color: 0xedf8aa,
					author: {
						name: messages.registeredTitle(interaction.channel.name),
						icon_url: "https://r2.aki.wtf/check.png"
					}
				}
			]
		});

		return;
	}
};
