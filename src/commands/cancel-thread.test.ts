import { describe, expect, it } from "vitest";
import { cancelThreadCommand } from "#/commands/cancel-thread.ts";
import { db } from "#/libs/kysely.ts";
import { registerThread } from "#/tests/database.ts";
import { createInteraction, createThread } from "#/tests/discord.ts";

describe("cancelThreadCommand", () => {
	it("登録済みのスレッドで実行すると、登録を外す", async () => {
		await registerThread("guild", "thread");
		const interaction = createInteraction({
			channel: createThread({ id: "thread", guildId: "guild", name: "雑談" }),
			guild: { id: "guild" }
		});

		await cancelThreadCommand.execute(interaction);

		expect(await db.selectFrom("threads").selectAll().execute()).toEqual([]);
		expect(interaction.reply).toHaveBeenCalledWith({
			embeds: [expect.objectContaining({ author: expect.objectContaining({ name: "「雑談」はもう見ないよ！" }) })]
		});
	});

	it("登録していないスレッドで実行すると、本人にだけ断りを返す", async () => {
		const interaction = createInteraction({
			channel: createThread({ id: "thread", guildId: "guild" }),
			guild: { id: "guild" }
		});

		await cancelThreadCommand.execute(interaction);

		expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true }));
	});
});
