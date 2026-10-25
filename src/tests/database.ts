import { db } from "#/libs/kysely.ts";

// localeは、/keepを実行した人のDiscordの言語
export const registerThread = async (guildId: string, threadId: string, locale = "ja") => {
	await db
		.insertInto("threads")
		.values({ id: crypto.randomUUID(), guild_id: guildId, thread_id: threadId, locale })
		.execute();
};
