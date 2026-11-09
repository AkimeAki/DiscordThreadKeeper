import { describe, expect, it } from "vitest";
import { threadDelete } from "#/events/thread-delete.ts";
import { db } from "#/libs/kysely.ts";
import { registerThread } from "#/tests/database.ts";
import { createThread } from "#/tests/discord.ts";

describe("threadDelete", () => {
	it("消されたスレッドの登録だけを消す", async () => {
		await registerThread("guild", "deleted");
		await registerThread("guild", "thread");

		await threadDelete(createThread({ id: "deleted", guildId: "guild" }));

		const rows = await db.selectFrom("threads").select("thread_id").execute();
		expect(rows).toEqual([{ thread_id: "thread" }]);
	});

	it("登録していないスレッドが消されても、ほかの登録に影響しない", async () => {
		await registerThread("guild", "thread");

		await threadDelete(createThread({ id: "other", guildId: "guild" }));

		const rows = await db.selectFrom("threads").select("thread_id").execute();
		expect(rows).toEqual([{ thread_id: "thread" }]);
	});
});
