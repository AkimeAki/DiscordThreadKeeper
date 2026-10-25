import { db } from "#/libs/kysely.ts";

export const registerThread = async (guildId: string, threadId: string) => {
	await db
		.insertInto("threads")
		.values({ id: crypto.randomUUID(), guild_id: guildId, thread_id: threadId })
		.execute();
};
