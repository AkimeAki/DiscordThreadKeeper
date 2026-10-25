import { ChannelNotFoundError, GuildNotFoundError } from "#/error.ts";
import { deleteThread } from "#/libs/delete-thread.ts";
import type { CacheType, ChatInputCommandInteraction } from "discord.js";
import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

export const cancelThreadCommand = {
	data: new SlashCommandBuilder()
		.setName("cancel")
		.setDescription("このスレッドの監視をやめます")
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
				ephemeral: true
			});

			return;
		}

		const result = await deleteThread(interaction.guild.id, interaction.channel.id);

		if (result.numDeletedRows === BigInt(0)) {
			await interaction.reply({
				embeds: [
					{
						description: "監視を始めるときは `/register` を実行してください。",
						color: 0xf44458,
						author: {
							name: "このスレッドは監視していません",
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
						description: "このスレッドは、通常どおり自動でアーカイブされます。",
						color: 0xedf8aa,
						author: {
							name: `「${interaction.channel.name}」の監視をやめました`,
							icon_url: "https://r2.aki.wtf/check.png"
						}
					}
				]
			});
		}

		return;
	}
};
