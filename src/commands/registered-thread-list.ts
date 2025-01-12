import { GuildNotFoundError } from "@/error.js";
import { deleteThread } from "@/libs/delete-thread";
import { db } from "@/libs/kysely.js";
import type { CacheType, ChatInputCommandInteraction, RESTError } from "discord.js";
import { RESTJSONErrorCodes, SlashCommandBuilder } from "discord.js";

export const registeredThreadListCommand = {
	data: new SlashCommandBuilder().setName("list").setDescription("監視中のスレッドを確認"),
	execute: async (interaction: ChatInputCommandInteraction<CacheType>): Promise<void> => {
		if (interaction.guild === null) {
			throw new GuildNotFoundError();
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
							name: "監視中のスレッドはなかったよ！",
							icon_url: "https://r2.aki.wtf/check.png"
						}
					}
				],
				ephemeral: true
			});
		} else {
			const threadIds = result.map((r) => r.thread_id);
			let description = "";

			let isDelete = false;

			for (const threadId of Array.from(threadIds.values())) {
				try {
					const thread = await interaction.guild.channels.fetch(threadId);
					if (thread !== null) {
						description += `- ${thread.name}\n`;
					}
				} catch (e) {
					if ((e as RESTError).code === RESTJSONErrorCodes.UnknownChannel) {
						await deleteThread(interaction.guild.id, threadId);
						isDelete = true;
					} else if ((e as RESTError).code === RESTJSONErrorCodes.UnknownGuild) {
						await deleteThread(interaction.guild.id, threadId);
						isDelete = true;
					} else {
						console.error(e);
					}
				}
			}

			description = description.replace(/\n$/, "");

			if (isDelete) {
				await interaction.reply({
					embeds: [
						{
							description: description + "\n消したスレッドはもう見てないよ😎",
							color: 0xedf8aa,
							author: {
								name: "このスレッドをずっと見てるよ～👀...ん？スレッド消した？",
								icon_url: "https://r2.aki.wtf/check.png"
							}
						}
					],
					ephemeral: true
				});
			} else {
				await interaction.reply({
					embeds: [
						{
							description: description,
							color: 0xedf8aa,
							author: {
								name: "このスレッドをずっと見てるよ～👀",
								icon_url: "https://r2.aki.wtf/check.png"
							}
						}
					],
					ephemeral: true
				});
			}
		}

		return;
	}
};
