import { GuildNotFoundError } from "#/error.ts";
import { deleteThread } from "#/libs/delete-thread.ts";
import { db } from "#/libs/kysely.ts";
import { logError } from "#/libs/log-error.ts";
import { getMessages } from "#/libs/messages.ts";
import type { CacheType, ChatInputCommandInteraction, RESTError } from "discord.js";
import {
	ApplicationIntegrationType,
	ChannelType,
	InteractionContextType,
	Locale,
	MessageFlags,
	PermissionFlagsBits,
	RESTJSONErrorCodes,
	SlashCommandBuilder
} from "discord.js";

// Discordの埋め込みの説明文の上限。登録の上限まで長い名前が並ぶと収まらないので、超える分は次のメッセージに分ける
const maxDescriptionLength = 4096;

export const registeredThreadListCommand = {
	data: new SlashCommandBuilder()
		.setName("list")
		.setDescription(getMessages(Locale.EnglishUS).listDescription)
		.setDescriptionLocalizations({ [Locale.Japanese]: getMessages(Locale.Japanese).listDescription })
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageThreads)
		.setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
		.setNSFW(false)
		.setContexts(InteractionContextType.Guild),
	execute: async (interaction: ChatInputCommandInteraction<CacheType>): Promise<void> => {
		const messages = getMessages(interaction.locale);

		if (!interaction.inCachedGuild()) {
			throw new GuildNotFoundError();
		}

		// キャッシュにないスレッドは1件ずつAPIで取得するので、件数が多いと3秒の応答期限を過ぎる
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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
					logError(e);
				}
			}
		}

		if (names.length === 0 && !isDelete) {
			await interaction.editReply({
				embeds: [
					{
						color: 0xedf8aa,
						author: {
							name: messages.emptyListTitle,
							icon_url: "https://r2.aki.wtf/check.png"
						}
					}
				]
			});

			return;
		}

		const lines = names.map((name) => `- ${name}`);
		if (isDelete) {
			lines.push(messages.removedDeletedThreads);
		}

		const descriptions: string[] = [];
		let current = "";
		for (const line of lines) {
			if (current !== "" && current.length + 1 + line.length > maxDescriptionLength) {
				descriptions.push(current);
				current = "";
			}

			current = current === "" ? line : `${current}\n${line}`;
		}
		descriptions.push(current);

		for (const [index, description] of descriptions.entries()) {
			const embed = {
				description,
				color: 0xedf8aa,
				author: {
					name: messages.listTitle,
					icon_url: "https://r2.aki.wtf/check.png"
				}
			};

			if (index === 0) {
				await interaction.editReply({ embeds: [embed] });
			} else {
				await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
			}
		}

		return;
	}
};
