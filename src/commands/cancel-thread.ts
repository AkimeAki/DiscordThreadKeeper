import { ChannelNotFoundError, GuildNotFoundError } from "#/error.ts";
import { deleteThread } from "#/libs/delete-thread.ts";
import type { CacheType, ChatInputCommandInteraction } from "discord.js";
import { SlashCommandBuilder } from "discord.js";

export const cancelThreadCommand = {
	data: new SlashCommandBuilder().setName("cancel").setDescription("コマンドを打ったスレッドが閉じるようになる"),
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
						description: "ここは見てないよ🫣",
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

		const result = await deleteThread(interaction.guild.id, interaction.channel.id);

		if (result.numDeletedRows === BigInt(0)) {
			await interaction.reply({
				embeds: [
					{
						description: "見ておく必要あったかな😰",
						color: 0xf44458,
						author: {
							name: "このスレッドは見てないよ！",
							icon_url: "https://r2.aki.wtf/report.png"
						}
					}
				],
				ephemeral: true
			});
		} else {
			await interaction.reply({
				embeds: [
					{
						description: "他に見るスレッドはあるかな？",
						color: 0xedf8aa,
						author: {
							name: `「${interaction.channel.name}」はもう見ないよ！`,
							icon_url: "https://r2.aki.wtf/check.png"
						}
					}
				]
			});
		}

		return;
	}
};
