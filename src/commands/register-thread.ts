import { ChannelNotFoundError, GuildNotFoundError } from "@/error";
import { db } from "@/libs/kysely.js";
import type { CacheType, ChatInputCommandInteraction } from "discord.js";
import { SlashCommandBuilder } from "discord.js";

export const registerThreadCommand = {
	data: new SlashCommandBuilder().setName("register").setDescription("このスレッドを閉じないようにする"),
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
						description: "スレッド以外も監視すると目が疲れちゃうよ😫",
						color: 0xf44458,
						author: {
							name: "ここはスレッドじゃないみたいだ！",
							icon_url: "https://r2.aki.wtf/report.png"
						}
					}
				],
				ephemeral: true
			});

			return;
		}

		await db()
			// prettier
			.insertInto("threads")
			.values({
				id: crypto.randomUUID(),
				thread_id: interaction.channel.id,
				guild_id: interaction.guild.id
			})
			.execute();

		await interaction.channel.setArchived(true);
		await new Promise((resolve) => setTimeout(resolve, 1000));
		await interaction.channel.setArchived(false);
		await interaction.channel.setAutoArchiveDuration(10080);

		await interaction.reply({
			embeds: [
				{
					description: "がんばるよ～！٩(ᐛ )و",
					color: 0xedf8aa,
					author: {
						name: `ずっと「${interaction.channel.name}」を見てるからね！`,
						icon_url: "https://r2.aki.wtf/check.png"
					}
				}
			]
		});

		return;
	}
};
