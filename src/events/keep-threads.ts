import { type Client, type RESTError, RESTJSONErrorCodes } from "discord.js";
import { db } from "#/libs/kysely.ts";
import { deleteGuildThreads, deleteThread } from "#/libs/delete-thread.ts";
import { logError } from "#/libs/log-error.ts";

// 障害で起動時に見えなかったサーバーは、復旧したときにも呼ばれる
export const keepGuildThreads = async (client: Client, guildId: string) => {
	try {
		const result = await db
			// prettier
			.selectFrom("threads")
			.select("thread_id")
			.where("guild_id", "=", guildId)
			.execute();

		for (const { thread_id: id } of result) {
			try {
				// 接続直後にDiscordが送るアクティブなスレッドの一覧はキャッシュに入っているので、そこにあるものはAPIに問い合わせない。
				// アーカイブ済みのスレッドは一覧に含まれないので、それだけを取りにいく。スレッドが多くてもAPIの回数制限にかかりにくくなる
				const channel = client.channels.cache.get(id) ?? (await client.channels.fetch(id, { force: true }));
				if (channel === null) {
					continue;
				}

				if (!channel.isSendable() || !channel.isThread()) {
					continue;
				}

				// モデレーターがロックしてアーカイブしたスレッドは、意図して閉じたものとみなして解除しない
				if (channel.archived === true && channel.locked === true) {
					continue;
				}

				if (channel.archived === true || channel.autoArchiveDuration !== 10080) {
					await channel.edit({ archived: false, autoArchiveDuration: 10080 });
					console.log(`アーカイブを解除しました: ${channel.id}`);
				}
			} catch (e) {
				// エラーが起きたら登録しているスレッドを削除

				if (
					(e as RESTError).code === RESTJSONErrorCodes.MissingAccess ||
					(e as RESTError).code === RESTJSONErrorCodes.MissingPermissions
				) {
					/* empty */
				} else if ((e as RESTError).code === RESTJSONErrorCodes.UnknownChannel) {
					await deleteThread(guildId, id);
				} else if ((e as RESTError).code === RESTJSONErrorCodes.UnknownGuild) {
					await deleteThread(guildId, id);
				} else {
					logError(e);
				}
			}
		}
	} catch (e) {
		logError(e);
	}
};

// 止まっている間にアーカイブされたスレッドや外されたサーバーはイベントで拾えないので、起動時にまとめて片付ける
export const keepThreads = async (client: Client) => {
	try {
		const result = await db
			// prettier
			.selectFrom("threads")
			.select("guild_id")
			.distinct()
			.execute();

		console.log("見守り中のスレッドを確認します");

		for (const { guild_id: guildId } of result) {
			// guilds.fetch()は1回で200件までしか返さないので、起動時に参加中の全サーバーが入るキャッシュを使う。
			// 障害で見えないサーバーもキャッシュには残るため、キャッシュにないサーバーだけが本当に外されたサーバーになる
			const guild = client.guilds.cache.get(guildId);
			if (guild === undefined) {
				await deleteGuildThreads(guildId);
				console.log(`止まっている間にサーバーから外れていたので、登録を消しました: ${guildId}`);
				continue;
			}

			if (guild.available) {
				await keepGuildThreads(client, guildId);
			}
		}
	} catch (e) {
		logError(e);
	}

	console.log("見守り中のスレッドの確認が終わりました");
};
