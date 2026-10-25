import { InteractionContextType, MessageFlags, PermissionFlagsBits } from "discord.js";
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
			embeds: [
				expect.objectContaining({ author: expect.objectContaining({ name: "「雑談」の監視をやめました" }) })
			]
		});
	});

	it("登録していないスレッドで実行すると、本人にだけ断りを返す", async () => {
		const interaction = createInteraction({
			channel: createThread({ id: "thread", guildId: "guild" }),
			guild: { id: "guild" }
		});

		await cancelThreadCommand.execute(interaction);

		expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ flags: MessageFlags.Ephemeral }));
	});

	it("英語のDiscordから実行すると、英語で返す", async () => {
		const interaction = createInteraction({
			channel: createThread({ id: "thread", guildId: "guild" }),
			guild: { id: "guild" },
			locale: "en-US"
		});

		await cancelThreadCommand.execute(interaction);

		expect(interaction.reply).toHaveBeenCalledWith(
			expect.objectContaining({
				embeds: [
					expect.objectContaining({
						author: expect.objectContaining({ name: "This thread isn't being watched" })
					})
				]
			})
		);
	});

	it("既定では「スレッドの管理」を持つ人だけが、サーバーの中で使える", () => {
		const data = cancelThreadCommand.data.toJSON();

		expect(data.default_member_permissions).toBe(PermissionFlagsBits.ManageThreads.toString());
		expect(data.contexts).toEqual([InteractionContextType.Guild]);
	});
});
