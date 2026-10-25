import { type AnyThreadChannel, MessageFlags } from "discord.js";
import { db } from "#/libs/kysely.ts";
import { getMessages } from "#/libs/messages.ts";

export const threadUpdate = async (oldThread: AnyThreadChannel, newThread: AnyThreadChannel) => {
	const isArchived = oldThread.archived !== true && newThread.archived === true;
	const isDurationChanged =
		oldThread.autoArchiveDuration !== newThread.autoArchiveDuration && newThread.autoArchiveDuration !== 10080;

	// アーカイブされたか、アーカイブまでの期間が変更されたときだけ処理する
	if (!isArchived && !isDurationChanged) {
		return;
	}

	// モデレーターがロックしてアーカイブしたスレッドは、意図して閉じたものとみなして解除しない
	if (isArchived && newThread.locked === true) {
		return;
	}

	// 登録したときの言語でスレッドに投稿する。登録を読む前に失敗したときは、サーバーの言語で知らせる
	let messages = getMessages(newThread.guild.preferredLocale);

	try {
		const result = await db
			// prettier
			.selectFrom("threads")
			.select("locale")
			.where("thread_id", "=", newThread.id)
			.where("guild_id", "=", newThread.guildId)
			.execute();

		const [row] = result;
		if (row === undefined) {
			return;
		}

		messages = getMessages(row.locale);

		await newThread.edit({ archived: false, autoArchiveDuration: 10080 });

		if (isArchived) {
			console.log(`アーカイブを解除しました: ${newThread.id}`);
		} else {
			await newThread.send({
				embeds: [
					{
						description: messages.durationLockedDescription,
						color: 0xf44458,
						author: {
							name: messages.durationLockedTitle,
							icon_url: "https://r2.aki.wtf/report.png"
						}
					}
				],
				flags: MessageFlags.SuppressNotifications
			});
		}
	} catch (e) {
		// 戻せなかったアーカイブ済みのスレッドには投稿も失敗しやすく、処理されない例外でBotが落ちるので、ログだけ残す
		if (isArchived) {
			console.error(e);
			return;
		}

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		if ((e as any).code === 50001) {
			await newThread.send({
				embeds: [
					{
						description: messages.missingPermissionDescription,
						color: 0xf44458,
						author: {
							name: messages.missingPermissionTitle,
							icon_url: "https://r2.aki.wtf/report.png"
						}
					}
				]
			});
		} else {
			console.error(e);
			await newThread.send({
				embeds: [
					{
						description: messages.durationResetFailedDescription,
						color: 0xf44458,
						author: {
							name: messages.unknownErrorTitle,
							icon_url: "https://r2.aki.wtf/error.png"
						}
					}
				]
			});
		}
	}
};
