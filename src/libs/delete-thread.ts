import { db } from "#/libs/kysely.ts";

export const deleteThread = async (guildId: string, threadId: string) => {
	const result = await db
		// prettier
		.deleteFrom("threads")
		.where("guild_id", "=", guildId)
		.where("thread_id", "=", threadId)
		.executeTakeFirst();

	return result;
};

export const deleteGuildThreads = async (guildId: string) => {
	const result = await db
		// prettier
		.deleteFrom("threads")
		.where("guild_id", "=", guildId)
		.executeTakeFirst();

	return result;
};
