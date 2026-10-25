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

	it("止まっている間にアーカイブされたスレッドを、APIで取得して解除する", async () => {
		await registerThread("guild", "thread");
		const thread = createThread({ id: "thread", guildId: "guild", archived: true });

		await keepThreads(createClient({ guildIds: ["guild"], fetchedChannels: new Map([["thread", thread]]) }));

		expect(thread.edit).toHaveBeenCalledWith({ archived: false, autoArchiveDuration: 10080 });
	});

	it("アクティブなスレッドとしてキャッシュにあるものは、APIに問い合わせない", async () => {
		await registerThread("guild", "thread");
		const thread = createThread({ id: "thread", guildId: "guild" });
		const client = createClient({ guildIds: ["guild"], cachedChannels: [thread] });

		await keepThreads(client);

		expect(client.channels.fetch).not.toHaveBeenCalled();
		expect(thread.edit).not.toHaveBeenCalled();
	});

	it("キャッシュにあっても期間が1週間でなければ、1週間に戻す", async () => {
		await registerThread("guild", "thread");
		const thread = createThread({ id: "thread", guildId: "guild", autoArchiveDuration: 1440 });
		const client = createClient({ guildIds: ["guild"], cachedChannels: [thread] });

		await keepThreads(client);

		expect(client.channels.fetch).not.toHaveBeenCalled();
		expect(thread.edit).toHaveBeenCalledWith({ archived: false, autoArchiveDuration: 10080 });
	});

	it("ロックされたままアーカイブされたスレッドは、解除しない", async () => {
		await registerThread("guild", "thread");
		const thread = createThread({ id: "thread", guildId: "guild", archived: true, locked: true });

		await keepThreads(createClient({ guildIds: ["guild"], fetchedChannels: new Map([["thread", thread]]) }));

		expect(thread.edit).not.toHaveBeenCalled();
	});

	it("消されたスレッドは、登録から外す", async () => {
		await registerThread("guild", "deleted");
		await registerThread("guild", "thread");
		const fetchedChannels = new Map<string, AnyThreadChannel | Error>([
			["deleted", createDiscordError(RESTJSONErrorCodes.UnknownChannel)]
		]);
		const cachedChannels = [createThread({ id: "thread", guildId: "guild" })];

		await keepThreads(createClient({ guildIds: ["guild"], cachedChannels, fetchedChannels }));

		expect(await findThreadIds()).toEqual(["thread"]);
	});

	it("見る権限がないだけのスレッドは、登録を残す", async () => {
		await registerThread("guild", "thread");
		const fetchedChannels = new Map([["thread", createDiscordError(RESTJSONErrorCodes.MissingAccess)]]);

		await keepThreads(createClient({ guildIds: ["guild"], fetchedChannels }));

		expect(await findThreadIds()).toEqual(["thread"]);
	});

	it("止まっている間に外されたサーバーの登録は、スレッドを取りにいかずに消す", async () => {
		await registerThread("left-guild", "first");
		await registerThread("left-guild", "second");
		await registerThread("guild", "thread");
		const client = createClient({
			guildIds: ["guild"],
			cachedChannels: [createThread({ id: "thread", guildId: "guild" })]
		});

		await keepThreads(client);

		expect(await findThreadIds()).toEqual(["thread"]);
		expect(client.channels.fetch).not.toHaveBeenCalled();
	});

	it("障害で一時的に見えないサーバーの登録は、消さずに残す", async () => {
		await registerThread("unavailable-guild", "thread");
		const client = createClient({ guildIds: [], unavailableGuildIds: ["unavailable-guild"] });

		await keepThreads(client);

		expect(await findThreadIds()).toEqual(["thread"]);
		expect(client.channels.fetch).not.toHaveBeenCalled();
	});

	it("200を超えるサーバーに参加していても、すべてのサーバーのスレッドを確認する", async () => {
		const guildIds = Array.from({ length: 250 }, (_, i) => `guild-${i}`);
		await registerThread("guild-249", "thread");
		const thread = createThread({ id: "thread", guildId: "guild-249", archived: true });

		await keepThreads(createClient({ guildIds, fetchedChannels: new Map([["thread", thread]]) }));

		expect(thread.edit).toHaveBeenCalledWith({ archived: false, autoArchiveDuration: 10080 });
	});
});
