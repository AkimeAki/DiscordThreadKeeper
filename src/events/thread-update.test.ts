import { MessageFlags } from "discord.js";
import { describe, expect, it, vi } from "vitest";
import { closingThreadIds } from "#/events/keep-threads.ts";
import { threadUpdate } from "#/events/thread-update.ts";
import { registerThread } from "#/tests/database.ts";
import { createDiscordError, createThread } from "#/tests/discord.ts";

describe("threadUpdate", () => {
	it("登録済みのスレッドがアーカイブされたら、解除してアーカイブできないと知らせる", async () => {
		await registerThread("guild", "thread");
		const oldThread = createThread({ id: "thread", guildId: "guild" });
		const newThread = createThread({ id: "thread", guildId: "guild", archived: true });

		await threadUpdate(oldThread, newThread);

		expect(newThread.edit).toHaveBeenCalledWith({ archived: false, autoArchiveDuration: 10080 });
		expect(newThread.send).toHaveBeenCalledWith({
			embeds: [
				expect.objectContaining({
					author: expect.objectContaining({ name: "見守り中のスレッドはアーカイブできません" })
				})
			],
			flags: MessageFlags.SuppressNotifications
		});
	});

	it("ロックされたままアーカイブされても、ロックには触らずアーカイブだけを解除する", async () => {
		await registerThread("guild", "thread");
		const oldThread = createThread({ id: "thread", guildId: "guild" });
		const newThread = createThread({ id: "thread", guildId: "guild", archived: true, locked: true });

		await threadUpdate(oldThread, newThread);

		expect(newThread.edit).toHaveBeenCalledWith({ archived: false, autoArchiveDuration: 10080 });
		expect(newThread.send).toHaveBeenCalledOnce();
	});

	it("ロックされただけのスレッドには、何もしない", async () => {
		await registerThread("guild", "thread");
		const oldThread = createThread({ id: "thread", guildId: "guild" });
		const newThread = createThread({ id: "thread", guildId: "guild", locked: true });

		await threadUpdate(oldThread, newThread);

		expect(newThread.edit).not.toHaveBeenCalled();
		expect(newThread.send).not.toHaveBeenCalled();
	});

	it("更新のためにBot自身がクローズしたスレッドには、何もしない", async () => {
		await registerThread("guild", "thread");
		closingThreadIds.add("thread");
		const oldThread = createThread({ id: "thread", guildId: "guild" });
		const newThread = createThread({ id: "thread", guildId: "guild", archived: true });

		await threadUpdate(oldThread, newThread);
		closingThreadIds.delete("thread");

		expect(newThread.edit).not.toHaveBeenCalled();
		expect(newThread.send).not.toHaveBeenCalled();
	});

	it("英語のDiscordから登録したスレッドがアーカイブされたら、英語で知らせる", async () => {
		await registerThread("guild", "thread", "en-US");
		const oldThread = createThread({ id: "thread", guildId: "guild" });
		const newThread = createThread({ id: "thread", guildId: "guild", archived: true });

		await threadUpdate(oldThread, newThread);

		expect(newThread.send).toHaveBeenCalledWith(
			expect.objectContaining({
				embeds: [
					expect.objectContaining({
						author: expect.objectContaining({ name: "Threads being kept can't be archived" })
					})
				]
			})
		);
	});

	it("登録していないスレッドがアーカイブされても、何もしない", async () => {
		const oldThread = createThread({ id: "thread", guildId: "guild" });
		const newThread = createThread({ id: "thread", guildId: "guild", archived: true });

		await threadUpdate(oldThread, newThread);

		expect(newThread.edit).not.toHaveBeenCalled();
	});

	it("別のサーバーで同じIDのスレッドが登録されていても、反応しない", async () => {
		await registerThread("other-guild", "thread");
		const oldThread = createThread({ id: "thread", guildId: "guild" });
		const newThread = createThread({ id: "thread", guildId: "guild", archived: true });

		await threadUpdate(oldThread, newThread);

		expect(newThread.edit).not.toHaveBeenCalled();
	});

	it("アーカイブまでの期間を変えられたら、1週間に戻して知らせる", async () => {
		await registerThread("guild", "thread");
		const oldThread = createThread({ id: "thread", guildId: "guild" });
		const newThread = createThread({ id: "thread", guildId: "guild", autoArchiveDuration: 1440 });

		await threadUpdate(oldThread, newThread);

		expect(newThread.edit).toHaveBeenCalledWith({ archived: false, autoArchiveDuration: 10080 });
		expect(newThread.send).toHaveBeenCalledOnce();
		expect(newThread.send).toHaveBeenCalledWith({
			embeds: [
				expect.objectContaining({
					author: expect.objectContaining({ name: "自動アーカイブまでの期間は変更できません" })
				})
			],
			flags: MessageFlags.SuppressNotifications
		});
	});

	it("英語のDiscordから登録したスレッドには、英語で知らせる", async () => {
		await registerThread("guild", "thread", "en-US");
		const oldThread = createThread({ id: "thread", guildId: "guild" });
		const newThread = createThread({ id: "thread", guildId: "guild", autoArchiveDuration: 1440 });

		await threadUpdate(oldThread, newThread);

		expect(newThread.send).toHaveBeenCalledWith(
			expect.objectContaining({
				embeds: [
					expect.objectContaining({
						author: expect.objectContaining({ name: "The auto-archive duration can't be changed" })
					})
				]
			})
		);
	});

	it("名前の変更など、アーカイブにも期間にも関係ない更新では何もしない", async () => {
		await registerThread("guild", "thread");
		const oldThread = createThread({ id: "thread", guildId: "guild", name: "古い名前" });
		const newThread = createThread({ id: "thread", guildId: "guild", name: "新しい名前" });

		await threadUpdate(oldThread, newThread);

		expect(newThread.edit).not.toHaveBeenCalled();
	});

	// 投げた例外はdiscord.jsがerrorイベントに送り、main.tsのリスナーがログに残す
	it("アーカイブを解除できなかったら、スレッドに投稿せず例外を投げる", async () => {
		await registerThread("guild", "thread");
		const oldThread = createThread({ id: "thread", guildId: "guild" });
		const newThread = createThread({ id: "thread", guildId: "guild", archived: true });
		vi.mocked(newThread.edit).mockRejectedValue(createDiscordError(50001));

		await expect(threadUpdate(oldThread, newThread)).rejects.toMatchObject({ code: 50001 });

		expect(newThread.send).not.toHaveBeenCalled();
	});

	it("期間を戻せなかったら、スレッドに投稿せず例外を投げる", async () => {
		await registerThread("guild", "thread");
		const oldThread = createThread({ id: "thread", guildId: "guild" });
		const newThread = createThread({ id: "thread", guildId: "guild", autoArchiveDuration: 1440 });
		vi.mocked(newThread.edit).mockRejectedValue(createDiscordError(50013));

		await expect(threadUpdate(oldThread, newThread)).rejects.toMatchObject({ code: 50013 });

		expect(newThread.send).not.toHaveBeenCalled();
	});

	it("期間を戻せた後の案内を投稿できなければ、例外を投げる", async () => {
		await registerThread("guild", "thread");
		const oldThread = createThread({ id: "thread", guildId: "guild" });
		const newThread = createThread({ id: "thread", guildId: "guild", autoArchiveDuration: 1440 });
		vi.mocked(newThread.send).mockRejectedValueOnce(createDiscordError(500));

		await expect(threadUpdate(oldThread, newThread)).rejects.toMatchObject({ code: 500 });

		expect(newThread.edit).toHaveBeenCalledOnce();
	});
});
