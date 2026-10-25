import { type AnyThreadChannel, RESTJSONErrorCodes } from "discord.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { keepThreads } from "#/events/keep-threads.ts";
import { db } from "#/libs/kysely.ts";
import { registerThread } from "#/tests/database.ts";
import { createClient, createDiscordError, createThread } from "#/tests/discord.ts";

const findThreadIds = async () => {
	const rows = await db.selectFrom("threads").select("thread_id").execute();
	return rows.map((row) => row.thread_id);
};

describe("keepThreads", () => {
	beforeEach(() => {
		vi.spyOn(console, "log").mockImplementation(() => {});
	});

	it("止まっている間にアーカイブされたスレッドを、起動時に解除する", async () => {
		await registerThread("guild", "thread");
		const thread = createThread({ id: "thread", guildId: "guild", archived: true });

		await keepThreads(createClient(["guild"], new Map([["thread", thread]])));

		expect(thread.edit).toHaveBeenCalledWith({ archived: false, autoArchiveDuration: 10080 });
	});

	it("ロックされたままアーカイブされたスレッドは、解除しない", async () => {
		await registerThread("guild", "thread");
		const thread = createThread({ id: "thread", guildId: "guild", archived: true, locked: true });

		await keepThreads(createClient(["guild"], new Map([["thread", thread]])));

		expect(thread.edit).not.toHaveBeenCalled();
	});

	it("アーカイブされておらず期間も1週間のままなら、スレッドを触らない", async () => {
		await registerThread("guild", "thread");
		const thread = createThread({ id: "thread", guildId: "guild" });

		await keepThreads(createClient(["guild"], new Map([["thread", thread]])));

		expect(thread.edit).not.toHaveBeenCalled();
	});

	it("消されたスレッドは、登録から外す", async () => {
		await registerThread("guild", "deleted");
		await registerThread("guild", "thread");
		const channels = new Map<string, AnyThreadChannel | Error>([
			["deleted", createDiscordError(RESTJSONErrorCodes.UnknownChannel)],
			["thread", createThread({ id: "thread", guildId: "guild" })]
		]);

		await keepThreads(createClient(["guild"], channels));

		expect(await findThreadIds()).toEqual(["thread"]);
	});

	it("見る権限がないだけのスレッドは、登録を残す", async () => {
		await registerThread("guild", "thread");
		const channels = new Map([["thread", createDiscordError(RESTJSONErrorCodes.MissingAccess)]]);

		await keepThreads(createClient(["guild"], channels));

		expect(await findThreadIds()).toEqual(["thread"]);
	});

	it("Botが参加していないサーバーの登録は、スレッドを取りにいかない", async () => {
		await registerThread("left-guild", "thread");
		const client = createClient([], new Map());

		await keepThreads(client);

		expect(client.channels.fetch).not.toHaveBeenCalled();
	});
});
