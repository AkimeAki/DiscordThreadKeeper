import { db } from "@/libs/kysely";
import type { CacheType, ChatInputCommandInteraction } from "discord.js";
import { SlashCommandBuilder } from "discord.js";

export const registeredThreadListCommand = {
	data: new SlashCommandBuilder().setName("list").setDescription("寿命が無期限のスレッド一覧を取得。"),
	execute: async (interaction: ChatInputCommandInteraction<CacheType>): Promise<void> => {
		if (interaction.channel === null || interaction.guild === null) {
			throw new Error();
		}

		const result = await db()
			// prettier
			.selectFrom("threads")
			.select("thread_id")
			.where("guild_id", "=", interaction.guild.id)
			.execute();

		if (result.length === 0) {
			await interaction.reply({
				embeds: [
					{
						color: 0xedf8aa,
						author: {
							name: "寿命が無期限のスレッドはなかったよ",
							icon_url: "https://r2.aki.wtf/check.png"
						}
					}
				],
				ephemeral: true
			});
		} else {
			const threadIds = result.map((r) => r.thread_id);
			let description = "";

			for (const threadId of Array.from(threadIds.values())) {
				const thread = await interaction.guild.channels.fetch(threadId);
				if (thread !== null) {
					description += `- ${thread.name}\n`;
				}
			}

			description = description.replace(/\n$/, "");

			await interaction.reply({
				embeds: [
					{
						description: description,
						color: 0xedf8aa,
						author: {
							name: "寿命が無期限のスレッドはこれ",
							icon_url: "https://r2.aki.wtf/check.png"
						}
					}
				],
				ephemeral: true
			});
		}

		return;
	}
};
