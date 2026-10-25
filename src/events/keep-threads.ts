import { type Client, type RESTError, RESTJSONErrorCodes } from "discord.js";
import { db } from "#/libs/kysely.ts";
import { deleteThread } from "#/libs/delete-thread.ts";

// 止まっている間にアーカイブされたスレッドはThreadUpdateで拾えないので、起動時にまとめて戻す
export const keepThreads = async (client: Client) => {
	try {
		const guilds = await client.guilds.fetch();
		const result = await db
			// prettier
			.selectFrom("threads")
			.select(["thread_id", "guild_id"])
			.execute();

		const guildIds = result.map((r) => r.guild_id);

		console.log("update start");

		for (const guild of Array.from(guilds.values())) {
			if (!guildIds.includes(guild.id)) {
				continue;
			}

			const threadIds = result.filter((r) => r.guild_id === guild.id).map((r) => r.thread_id);

			for (const id of threadIds) {
				try {
					const channel = await client.channels.fetch(id, { force: true });
					if (channel === null) {
						continue;
					}

					if (!channel.isSendable() || !channel.isThread()) {
						continue;
					}

					if (channel.archived === true || channel.autoArchiveDuration !== 10080) {
						await channel.edit({ archived: false, autoArchiveDuration: 10080 });
						console.log("生き延びて、" + channel.name + ":" + channel.id);
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
						console.error(e);
					}
				}
			}
		}
	} catch (e) {
		console.error(e);
	}

	console.log("update end");
};
