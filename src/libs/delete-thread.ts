import { db } from "#/libs/kysely.ts";

export const deleteThread = async (guildId: string, threadId: string) => {
	return (
		db
			// prettier
			.deleteFrom("threads")
			.where("guild_id", "=", guildId)
			.where("thread_id", "=", threadId)
			.executeTakeFirst()
	);
};

export const deleteGuildThreads = async (guildId: string) => {
	await db
		// prettier
		.deleteFrom("threads")
		.where("guild_id", "=", guildId)
		.execute();
};
