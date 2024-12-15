import { db } from "@/libs/kysely.js";
import type { CacheType, ChatInputCommandInteraction } from "discord.js";
import { SlashCommandBuilder } from "discord.js";

export const cancelThreadCommand = {
	data: new SlashCommandBuilder().setName("cancel").setDescription("コマンドを打ったスレッドの寿命を元に戻す。"),
	execute: async (interaction: ChatInputCommandInteraction<CacheType>): Promise<void> => {
		if (interaction.channel === null || interaction.guild === null) {
			throw new Error();
		}

		if (!interaction.channel.isThread()) {
			await interaction.reply({
				embeds: [
					{
						description: "ここは監視するつもりは無いな。",
						color: 0xf44458,
						author: {
							name: "ここはスレッドじゃないみたいだ",
							icon_url: "https://r2.aki.wtf/report.png"
						}
					}
				],
				ephemeral: true
			});

			return;
		}

		const result = await db()
			// prettier
			.deleteFrom("threads")
			.where("guild_id", "=", interaction.guild.id)
			.where("thread_id", "=", interaction.channel.id)
			.executeTakeFirst();

		if (result.numDeletedRows === BigInt(0)) {
			await interaction.reply({
				embeds: [
					{
						color: 0xf44458,
						author: {
							name: "このスレッドの寿命は既に元に戻っている",
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
						description: "もう無理に生きる必要は無い。",
						color: 0xedf8aa,
						author: {
							name: `「${interaction.channel.name}」の寿命が元に戻った`,
							icon_url: "https://r2.aki.wtf/check.png"
						}
					}
				]
			});
		}

		return;
	}
};
