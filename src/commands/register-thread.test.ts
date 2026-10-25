import { describe, expect, it } from "vitest";
import { registerThreadCommand } from "#/commands/register-thread.ts";
import { ChannelNotFoundError } from "#/error.ts";
import { db } from "#/libs/kysely.ts";
import { createInteraction, createThread } from "#/tests/discord.ts";

describe("registerThreadCommand", () => {
	it("スレッドで実行すると登録し、アーカイブまでの期間を1週間にする", async () => {
		const thread = createThread({ id: "thread", guildId: "guild" });
		const interaction = createInteraction({ channel: thread, guild: { id: "guild" } });

		await registerThreadCommand.execute(interaction);

		const rows = await db.selectFrom("threads").select(["guild_id", "thread_id"]).execute();
		expect(rows).toEqual([{ guild_id: "guild", thread_id: "thread" }]);
		expect(thread.setAutoArchiveDuration).toHaveBeenCalledWith(10080);
		expect(interaction.reply).toHaveBeenCalledOnce();
	});

	it("スレッド以外で実行すると、登録せず本人にだけ断りを返す", async () => {
		const interaction = createInteraction({ channel: { isThread: () => false }, guild: { id: "guild" } });

		await registerThreadCommand.execute(interaction);

		expect(await db.selectFrom("threads").selectAll().execute()).toEqual([]);
		expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true }));
	});

	it("同じスレッドを2回登録すると、一意制約のエラーになる", async () => {
		const interaction = createInteraction({
			channel: createThread({ id: "thread", guildId: "guild" }),
			guild: { id: "guild" }
		});
		await registerThreadCommand.execute(interaction);

		// main.tsはこのcodeを見て「めっちゃ見てるよ」と返す
		await expect(registerThreadCommand.execute(interaction)).rejects.toMatchObject({
			code: "SQLITE_CONSTRAINT_UNIQUE"
		});
	});

	it("チャンネルが見えないと、ChannelNotFoundErrorを投げる", async () => {
		const interaction = createInteraction({ channel: null, guild: { id: "guild" } });

		await expect(registerThreadCommand.execute(interaction)).rejects.toBeInstanceOf(ChannelNotFoundError);
	});
});
