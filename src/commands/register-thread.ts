import { db } from "@/libs/kysely.js";
import type { CacheType, ChatInputCommandInteraction } from "discord.js";
import { SlashCommandBuilder } from "discord.js";

export const registerThreadCommand = {
	data: new SlashCommandBuilder()
		.setName("register")
		.setDescription("コマンドを打ったスレッドの寿命を無期限にする。"),
	execute: async (interaction: ChatInputCommandInteraction<CacheType>): Promise<void> => {
		if (interaction.channel === null || interaction.guild === null) {
			throw new Error();
		}

		if (!interaction.channel.isThread()) {
			await interaction.reply({
				embeds: [
					{
						description: "スレッド以外も監視すると目が疲れる。",
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

		await db()
			// prettier
			.insertInto("threads")
			.values({
				id: crypto.randomUUID(),
				thread_id: interaction.channel.id,
				guild_id: interaction.guild.id
			})
			.execute();

		await interaction.channel.setArchived(false);
		await interaction.channel.setAutoArchiveDuration(10080);

		await interaction.reply({
			embeds: [
				{
					description: "ずっと目立っててうざいね。",
					color: 0xedf8aa,
					author: {
						name: `これから「${interaction.channel.name}」の寿命は無期限だ`,
						icon_url: "https://r2.aki.wtf/check.png"
					}
				}
			]
		});

		return;
	}
};
