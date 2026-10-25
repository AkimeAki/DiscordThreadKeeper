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
			console.log("生き延びて、" + newThread.name + ":" + newThread.id);
		} else {
			await newThread.send({
				embeds: [
					{
						description: "監視中のスレッドの時間はいじらせないよ！",
						color: 0xf44458,
						author: {
							name: `アーカイブされるまでの時間はずっと1週間だよ～ん`,
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
						description: "「スレッドを管理」権限が足らないかも！",
						color: 0xf44458,
						author: {
							name: "スレッドがいじれないな...🤔",
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
						color: 0xf44458,
						author: {
							name: "エラーだ！エラーだぞ！🙀",
							icon_url: "https://r2.aki.wtf/error.png"
						}
					}
				]
			});
		}
	}
};
