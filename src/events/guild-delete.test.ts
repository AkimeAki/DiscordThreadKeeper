import type { Guild } from "discord.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { guildDelete } from "#/events/guild-delete.ts";
import { db } from "#/libs/kysely.ts";
import { registerThread } from "#/tests/database.ts";

describe("guildDelete", () => {
	beforeEach(() => {
		vi.spyOn(console, "log").mockImplementation(() => {});
	});

	it("Botが外されたサーバーの登録だけを消す", async () => {
		await registerThread("left-guild", "first");
		await registerThread("left-guild", "second");
		await registerThread("other-guild", "other");

		await guildDelete({ id: "left-guild" } as Guild);

		const rows = await db.selectFrom("threads").select(["guild_id", "thread_id"]).execute();
		expect(rows).toEqual([{ guild_id: "other-guild", thread_id: "other" }]);
	});
});
