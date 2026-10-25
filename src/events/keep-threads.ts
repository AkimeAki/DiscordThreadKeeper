import { type Client, type RESTError, RESTJSONErrorCodes } from "discord.js";
import { db } from "#/libs/kysely.ts";
import { deleteGuildThreads, deleteThread } from "#/libs/delete-thread.ts";
import { logError } from "#/libs/log-error.ts";

// 止まっている間にアーカイブされたスレッドや外されたサーバーはイベントで拾えないので、起動時にまとめて片付ける
export const keepThreads = async (client: Client) => {
	try {
		const result = await db
			// prettier
			.selectFrom("threads")
			.select(["thread_id", "guild_id"])
			.execute();

		const guildIds = result.map((r) => r.guild_id);

		console.log("監視中のスレッドを確認します");

		// guilds.fetch()は1回で200件までしか返さないので、起動時に参加中の全サーバーが入るキャッシュを使う。
		// 障害で見えないサーバーもキャッシュには残るため、キャッシュにないサーバーだけが本当に外されたサーバーになる
		for (const guildId of new Set(guildIds)) {
			if (!client.guilds.cache.has(guildId)) {
				await deleteGuildThreads(guildId);
				console.log(`止まっている間にサーバーから外れていたので、登録を消しました: ${guildId}`);
			}
		}

		for (const guild of client.guilds.cache.values()) {
			if (!guild.available || !guildIds.includes(guild.id)) {
				continue;
			}

			const threadIds = result.filter((r) => r.guild_id === guild.id).map((r) => r.thread_id);

			for (const id of threadIds) {
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

					if ((e as RESTError).code === RESTJSONErrorCodes.MissingAccess) {
						/* empty */
					} else if ((e as RESTError).code === RESTJSONErrorCodes.UnknownChannel) {
						await deleteThread(guild.id, id);
					} else if ((e as RESTError).code === RESTJSONErrorCodes.UnknownGuild) {
						await deleteThread(guild.id, id);
					} else {
						logError(e);
					}
				}
			}
		}
	} catch (e) {
		logError(e);
	}

	console.log("監視中のスレッドの確認が終わりました");
};
