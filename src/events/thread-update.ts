import { type AnyThreadChannel, MessageFlags } from "discord.js";
import { db } from "#/libs/kysely.ts";

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

	// コマンドの処理
	try {
		const result = await db
			// prettier
			.selectFrom("threads")
			.select("id")
			.where("thread_id", "=", newThread.id)
			.where("guild_id", "=", newThread.guildId)
			.execute();

		if (result.length === 0) {
			return;
		}

		await newThread.edit({ archived: false, autoArchiveDuration: 10080 });

		if (isArchived) {
			console.log(`アーカイブを解除しました: ${newThread.id}`);
		} else {
			await newThread.send({
				embeds: [
					{
						description:
							"監視中のスレッドのため、期間を1週間に戻しました。変えるときは、先に `/cancel` で監視をやめてください。",
						color: 0xf44458,
						author: {
							name: "自動アーカイブまでの期間は変更できません",
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
						description: "Botに「スレッドの管理」権限があるか確認してください。",
						color: 0xf44458,
						author: {
							name: "Botの権限が足りません",
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
						description: "自動アーカイブまでの期間を1週間に戻すことができませんでした。",
						color: 0xf44458,
						author: {
							name: "エラーが発生しました",
							icon_url: "https://r2.aki.wtf/error.png"
						}
					}
				]
			});
		}
	}
};
