import { type AnyThreadChannel, RESTJSONErrorCodes } from "discord.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { keepGuildThreads, keepThreads } from "#/events/keep-threads.ts";
import { deleteThread } from "#/libs/delete-thread.ts";
import { db } from "#/libs/kysely.ts";
import { registerThread } from "#/tests/database.ts";
import { createClient, createDiscordError, createThread } from "#/tests/discord.ts";

const day = 24 * 60 * 60 * 1000;

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

	it("権限が足りず解除できないスレッドは、登録を残してエラーのログも出さない", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		await registerThread("guild", "thread");
		const thread = createThread({ id: "thread", guildId: "guild", archived: true });
		vi.mocked(thread.edit).mockRejectedValue(createDiscordError(RESTJSONErrorCodes.MissingPermissions));

		await keepThreads(createClient({ guildIds: ["guild"], fetchedChannels: new Map([["thread", thread]]) }));

		expect(await findThreadIds()).toEqual(["thread"]);
		expect(error).not.toHaveBeenCalled();
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

	it("障害から復旧したサーバーを確認すると、そのサーバーのスレッドだけを解除する", async () => {
		await registerThread("guild", "thread");
		await registerThread("other-guild", "other");
		const thread = createThread({ id: "thread", guildId: "guild", archived: true });
		const other = createThread({ id: "other", guildId: "other-guild", archived: true });
		const fetchedChannels = new Map([
			["thread", thread],
			["other", other]
		]);

		await keepGuildThreads(createClient({ guildIds: ["guild", "other-guild"], fetchedChannels }), "guild", {
			useCache: false
		});

		expect(thread.edit).toHaveBeenCalledWith({ archived: false, autoArchiveDuration: 10080 });
		expect(other.edit).not.toHaveBeenCalled();
	});

	it("障害から復旧したときは、古いキャッシュを信用せずAPIから取り直す", async () => {
		await registerThread("guild", "thread");
		const stale = createThread({ id: "thread", guildId: "guild" });
		const latest = createThread({ id: "thread", guildId: "guild", archived: true });
		const client = createClient({
			guildIds: ["guild"],
			cachedChannels: [stale],
			fetchedChannels: new Map([["thread", latest]])
		});

		await keepGuildThreads(client, "guild", { useCache: false });

		expect(latest.edit).toHaveBeenCalledWith({ archived: false, autoArchiveDuration: 10080 });
	});

	it("確認の途中で見守りをやめたスレッドは、解除しない", async () => {
		await registerThread("guild", "thread");
		const thread = createThread({ id: "thread", guildId: "guild", archived: true });
		const client = createClient({ guildIds: ["guild"] });
		vi.mocked(client.channels.fetch).mockImplementationOnce(async () => {
			await deleteThread("guild", "thread");
			return thread;
		});

		await keepThreads(client);

		expect(thread.edit).not.toHaveBeenCalled();
	});

	it("前回の再開から5日たったスレッドは、クローズしてから再開する", async () => {
		await registerThread("guild", "thread");
		const thread = createThread({ id: "thread", guildId: "guild", archiveTimestamp: Date.now() - 5 * day });

		await keepThreads(createClient({ guildIds: ["guild"], cachedChannels: [thread] }));

		expect(thread.edit).toHaveBeenCalledTimes(2);
		expect(thread.edit).toHaveBeenNthCalledWith(1, { archived: true });
		expect(thread.edit).toHaveBeenNthCalledWith(2, { archived: false, autoArchiveDuration: 10080 });
	});

	it("前回の再開から5日たっていないスレッドは、何もしない", async () => {
		await registerThread("guild", "thread");
		const thread = createThread({ id: "thread", guildId: "guild", archiveTimestamp: Date.now() - 4 * day });

		await keepThreads(createClient({ guildIds: ["guild"], cachedChannels: [thread] }));

		expect(thread.edit).not.toHaveBeenCalled();
	});

	it("ロック中のスレッドは、5日たってもクローズしない", async () => {
		await registerThread("guild", "thread");
		const thread = createThread({
			id: "thread",
			guildId: "guild",
			locked: true,
			archiveTimestamp: Date.now() - 5 * day
		});

		await keepThreads(createClient({ guildIds: ["guild"], cachedChannels: [thread] }));

		expect(thread.edit).not.toHaveBeenCalled();
	});

	it("すでにアーカイブされているスレッドは、クローズせず再開だけする", async () => {
		await registerThread("guild", "thread");
		const thread = createThread({
			id: "thread",
			guildId: "guild",
			archived: true,
			archiveTimestamp: Date.now() - 5 * day
		});

		await keepThreads(createClient({ guildIds: ["guild"], cachedChannels: [thread] }));

		expect(thread.edit).toHaveBeenCalledOnce();
		expect(thread.edit).toHaveBeenCalledWith({ archived: false, autoArchiveDuration: 10080 });
	});

	it("200を超えるサーバーに参加していても、すべてのサーバーのスレッドを確認する", async () => {
		const guildIds = Array.from({ length: 250 }, (_, i) => `guild-${i}`);
		await registerThread("guild-249", "thread");
		const thread = createThread({ id: "thread", guildId: "guild-249", archived: true });

		await keepThreads(createClient({ guildIds, fetchedChannels: new Map([["thread", thread]]) }));

		expect(thread.edit).toHaveBeenCalledWith({ archived: false, autoArchiveDuration: 10080 });
	});
});
