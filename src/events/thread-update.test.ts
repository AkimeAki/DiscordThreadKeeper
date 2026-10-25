import { describe, expect, it, vi } from "vitest";
import { threadUpdate } from "#/events/thread-update.ts";
import { registerThread } from "#/tests/database.ts";
import { createDiscordError, createThread } from "#/tests/discord.ts";

describe("threadUpdate", () => {
	it("登録済みのスレッドがアーカイブされたら、アーカイブを解除する", async () => {
		await registerThread("guild", "thread");
		const oldThread = createThread({ id: "thread", guildId: "guild" });
		const newThread = createThread({ id: "thread", guildId: "guild", archived: true });

		await threadUpdate(oldThread, newThread);

		expect(newThread.edit).toHaveBeenCalledWith({ archived: false, autoArchiveDuration: 10080 });
		expect(newThread.send).not.toHaveBeenCalled();
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
	});

	it("名前の変更など、アーカイブにも期間にも関係ない更新では何もしない", async () => {
		await registerThread("guild", "thread");
		const oldThread = createThread({ id: "thread", guildId: "guild", name: "古い名前" });
		const newThread = createThread({ id: "thread", guildId: "guild", name: "新しい名前" });

		await threadUpdate(oldThread, newThread);

		expect(newThread.edit).not.toHaveBeenCalled();
	});

	it("アーカイブを解除できなかったら、スレッドに投稿せずログだけ残す", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		await registerThread("guild", "thread");
		const oldThread = createThread({ id: "thread", guildId: "guild" });
		const newThread = createThread({ id: "thread", guildId: "guild", archived: true });
		vi.mocked(newThread.edit).mockRejectedValue(createDiscordError(50001));

		await threadUpdate(oldThread, newThread);

		expect(newThread.send).not.toHaveBeenCalled();
		expect(error).toHaveBeenCalledOnce();
	});

	it("期間を戻す権限がなければ、権限が足りないと知らせる", async () => {
		await registerThread("guild", "thread");
		const oldThread = createThread({ id: "thread", guildId: "guild" });
		const newThread = createThread({ id: "thread", guildId: "guild", autoArchiveDuration: 1440 });
		vi.mocked(newThread.edit).mockRejectedValue(createDiscordError(50001));

		await threadUpdate(oldThread, newThread);

		expect(newThread.send).toHaveBeenCalledWith(
			expect.objectContaining({
				embeds: [expect.objectContaining({ description: "「スレッドを管理」権限が足らないかも！" })]
			})
		);
	});
});
