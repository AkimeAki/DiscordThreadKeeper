import { ChannelNotFoundError, GuildNotFoundError } from "#/error.ts";
import { db } from "#/libs/kysely.ts";
import type { CacheType, ChatInputCommandInteraction } from "discord.js";
import { InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

// 荒らしに大量のスレッドを登録されても、起動時の確認やDBが膨らみすぎないようにする
const maxThreadsPerGuild = 100;

export const registerThreadCommand = {
	data: new SlashCommandBuilder()
		.setName("register")
		.setDescription("このスレッドが自動でアーカイブされないようにします")
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageThreads)
		.setContexts(InteractionContextType.Guild),
	execute: async (interaction: ChatInputCommandInteraction<CacheType>): Promise<void> => {
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
						description: "このコマンドはスレッドでのみ使うことができます。",
						color: 0xf44458,
						author: {
							name: "スレッドの中で実行してください",
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
						description: `1つのサーバーで監視できるスレッドは${maxThreadsPerGuild}件までです。不要な監視を \`/cancel\` でやめてから、もう一度お試しください。`,
						color: 0xf44458,
						author: {
							name: "これ以上スレッドを監視できません",
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
				guild_id: interaction.guild.id
			})
			.execute();

		await interaction.channel.setAutoArchiveDuration(10080);

		await interaction.reply({
			embeds: [
				{
					description:
						"このスレッドは自動でアーカイブされなくなります。監視をやめるときは `/cancel` を実行してください。",
					color: 0xedf8aa,
					author: {
						name: `「${interaction.channel.name}」の監視を始めました`,
						icon_url: "https://r2.aki.wtf/check.png"
					}
				}
			]
		});

		return;
	}
};
