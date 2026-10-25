import { GuildNotFoundError } from "#/error.ts";
import { deleteThread } from "#/libs/delete-thread.ts";
import { db } from "#/libs/kysely.ts";
import type { CacheType, ChatInputCommandInteraction, RESTError } from "discord.js";
import {
	ChannelType,
	InteractionContextType,
	PermissionFlagsBits,
	RESTJSONErrorCodes,
	SlashCommandBuilder
} from "discord.js";

export const registeredThreadListCommand = {
	data: new SlashCommandBuilder()
		.setName("list")
		.setDescription("監視中のスレッドを一覧で表示します")
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageThreads)
		.setContexts(InteractionContextType.Guild),
	execute: async (interaction: ChatInputCommandInteraction<CacheType>): Promise<void> => {
		if (!interaction.inCachedGuild()) {
			throw new GuildNotFoundError();
		}

		const result = await db
			// prettier
			.selectFrom("threads")
			.select("thread_id")
			.where("guild_id", "=", interaction.guild.id)
			.execute();

		const names: string[] = [];
		let isDelete = false;

		for (const { thread_id: threadId } of result) {
			try {
				const thread = await interaction.guild.channels.fetch(threadId);
				if (thread === null) {
					continue;
				}

				// Botは自分の権限でスレッドを取得するので、実行した人が見られないスレッドの名前は出さない。
				// 非公開スレッドは参加者かどうかを調べるとスレッドごとにAPIを呼ぶことになるため、「スレッドの管理」を持つ人だけに見せる
				const permissions = thread.permissionsFor(interaction.member);
				const canView =
					permissions.has(PermissionFlagsBits.ViewChannel) &&
					(thread.type !== ChannelType.PrivateThread || permissions.has(PermissionFlagsBits.ManageThreads));
				if (canView) {
					names.push(thread.name);
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

		if (names.length === 0 && !isDelete) {
			await interaction.reply({
				embeds: [
					{
						color: 0xedf8aa,
						author: {
							name: "監視中のスレッドはありません",
							icon_url: "https://r2.aki.wtf/check.png"
						}
					}
				],
				ephemeral: true
			});

			return;
		}

		const lines = names.map((name) => `- ${name}`);
		if (isDelete) {
			lines.push("削除されたスレッドは、監視の対象から外しました。");
		}

		await interaction.reply({
			embeds: [
				{
					description: lines.join("\n"),
					color: 0xedf8aa,
					author: {
						name: "監視中のスレッド",
						icon_url: "https://r2.aki.wtf/check.png"
					}
				}
			],
			ephemeral: true
		});

		return;
	}
};
