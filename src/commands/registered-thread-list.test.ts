import { type AnyThreadChannel, RESTJSONErrorCodes } from "discord.js";
import { describe, expect, it } from "vitest";
import { registeredThreadListCommand } from "#/commands/registered-thread-list.ts";
import { db } from "#/libs/kysely.ts";
import { registerThread } from "#/tests/database.ts";
import { createDiscordError, createGuild, createInteraction, createThread } from "#/tests/discord.ts";

describe("registeredThreadListCommand", () => {
	it("登録がなければ、監視中のスレッドはないと返す", async () => {
		const interaction = createInteraction({ channel: null, guild: createGuild("guild", new Map()) });

		await registeredThreadListCommand.execute(interaction);

		expect(interaction.reply).toHaveBeenCalledWith({
			embeds: [
				expect.objectContaining({ author: expect.objectContaining({ name: "監視中のスレッドはなかったよ！" }) })
			],
			ephemeral: true
		});
	});

	it("そのサーバーで登録したスレッドの名前だけを一覧にする", async () => {
		await registerThread("guild", "first");
		await registerThread("guild", "second");
		await registerThread("other-guild", "other");
		const channels = new Map([
			["first", createThread({ id: "first", guildId: "guild", name: "雑談" })],
			["second", createThread({ id: "second", guildId: "guild", name: "告知" })]
		]);
		const interaction = createInteraction({ channel: null, guild: createGuild("guild", channels) });

		await registeredThreadListCommand.execute(interaction);

		expect(interaction.reply).toHaveBeenCalledWith(
			expect.objectContaining({ embeds: [expect.objectContaining({ description: "- 雑談\n- 告知" })] })
		);
	});

	it("消されたスレッドは、一覧から除いて登録も外す", async () => {
		await registerThread("guild", "deleted");
		await registerThread("guild", "thread");
		const channels = new Map<string, AnyThreadChannel | Error>([
			["deleted", createDiscordError(RESTJSONErrorCodes.UnknownChannel)],
			["thread", createThread({ id: "thread", guildId: "guild", name: "雑談" })]
		]);
		const interaction = createInteraction({ channel: null, guild: createGuild("guild", channels) });

		await registeredThreadListCommand.execute(interaction);

		const rows = await db.selectFrom("threads").select("thread_id").execute();
		expect(rows).toEqual([{ thread_id: "thread" }]);
		expect(interaction.reply).toHaveBeenCalledWith(
			expect.objectContaining({
				embeds: [expect.objectContaining({ description: "- 雑談\n消したスレッドはもう見てないよ😎" })]
			})
		);
	});
});
