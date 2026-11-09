import { InteractionContextType, Locale, MessageFlags, PermissionFlagsBits } from "discord.js";
import { describe, expect, it, vi } from "vitest";
import { registerThreadCommand } from "#/commands/register-thread.ts";
import { ChannelNotFoundError } from "#/error.ts";
import { db } from "#/libs/kysely.ts";
import { registerThread } from "#/tests/database.ts";
import { createDiscordError, createInteraction, createThread } from "#/tests/discord.ts";

describe("registerThreadCommand", () => {
	it("スレッドで実行すると登録し、アーカイブまでの期間を1週間にする", async () => {
		const thread = createThread({ id: "thread", guildId: "guild" });
		const interaction = createInteraction({ channel: thread, guild: { id: "guild" } });

		await registerThreadCommand.execute(interaction);

		const rows = await db.selectFrom("threads").select(["guild_id", "thread_id"]).execute();
		expect(rows).toEqual([{ guild_id: "guild", thread_id: "thread" }]);
		expect(thread.setAutoArchiveDuration).toHaveBeenCalledWith(10080);
		expect(interaction.deferReply).toHaveBeenCalledOnce();
		expect(interaction.editReply).toHaveBeenCalledOnce();
	});

	it("スレッド以外で実行すると、登録せず本人にだけ断りを返す", async () => {
		const interaction = createInteraction({ channel: { isThread: () => false }, guild: { id: "guild" } });

		await registerThreadCommand.execute(interaction);

		expect(await db.selectFrom("threads").selectAll().execute()).toEqual([]);
		expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ flags: MessageFlags.Ephemeral }));
	});

	it("同じスレッドを2回登録すると、一意制約のエラーになる", async () => {
		const interaction = createInteraction({
			channel: createThread({ id: "thread", guildId: "guild" }),
			guild: { id: "guild" }
		});
		await registerThreadCommand.execute(interaction);

		// main.tsはこのcodeを見て「すでに見守っています」と返す
		await expect(registerThreadCommand.execute(interaction)).rejects.toMatchObject({
			code: "SQLITE_CONSTRAINT_UNIQUE"
		});
	});

	it("Discord側の更新に失敗したら登録を戻し、権限を直せば登録し直せる", async () => {
		const thread = createThread({ id: "thread", guildId: "guild" });
		const interaction = createInteraction({ channel: thread, guild: { id: "guild" } });
		vi.mocked(thread.setAutoArchiveDuration).mockRejectedValueOnce(createDiscordError(50013));

		await expect(registerThreadCommand.execute(interaction)).rejects.toMatchObject({ code: 50013 });
		expect(await db.selectFrom("threads").selectAll().execute()).toEqual([]);

		await registerThreadCommand.execute(interaction);

		const rows = await db.selectFrom("threads").select("thread_id").execute();
		expect(rows).toEqual([{ thread_id: "thread" }]);
	});

	it("待っている間に別の実行が登録し直していたら、失敗してもその登録は消さない", async () => {
		const thread = createThread({ id: "thread", guildId: "guild" });
		const interaction = createInteraction({ channel: thread, guild: { id: "guild" } });
		vi.mocked(thread.setAutoArchiveDuration).mockImplementationOnce(async () => {
			await db.deleteFrom("threads").execute();
			await registerThread("guild", "thread");
			throw createDiscordError(50013);
		});

		await expect(registerThreadCommand.execute(interaction)).rejects.toMatchObject({ code: 50013 });

		const rows = await db.selectFrom("threads").select("thread_id").execute();
		expect(rows).toEqual([{ thread_id: "thread" }]);
	});

	it("チャンネルが見えないと、ChannelNotFoundErrorを投げる", async () => {
		const interaction = createInteraction({ channel: null, guild: { id: "guild" } });

		await expect(registerThreadCommand.execute(interaction)).rejects.toBeInstanceOf(ChannelNotFoundError);
	});

	it("1つのサーバーで100件登録済みなら、それ以上は登録しない", async () => {
		for (let i = 0; i < 100; i++) {
			await registerThread("guild", `thread-${i}`);
		}
		const thread = createThread({ id: "new-thread", guildId: "guild" });
		const interaction = createInteraction({ channel: thread, guild: { id: "guild" } });

		await registerThreadCommand.execute(interaction);

		const rows = await db.selectFrom("threads").select("thread_id").execute();
		expect(rows).toHaveLength(100);
		expect(thread.setAutoArchiveDuration).not.toHaveBeenCalled();
		expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ flags: MessageFlags.Ephemeral }));
	});

	it("別のサーバーの登録は、上限の件数に数えない", async () => {
		for (let i = 0; i < 100; i++) {
			await registerThread("other-guild", `thread-${i}`);
		}
		const interaction = createInteraction({
			channel: createThread({ id: "thread", guildId: "guild" }),
			guild: { id: "guild" }
		});

		await registerThreadCommand.execute(interaction);

		const rows = await db.selectFrom("threads").select("thread_id").where("guild_id", "=", "guild").execute();
		expect(rows).toEqual([{ thread_id: "thread" }]);
	});

	it("既定では「スレッドの管理」を持つ人だけが、サーバーの中で使える", () => {
		const data = registerThreadCommand.data.toJSON();

		expect(data.default_member_permissions).toBe(PermissionFlagsBits.ManageThreads.toString());
		expect(data.contexts).toEqual([InteractionContextType.Guild]);
	});

	it("英語のDiscordから実行すると英語で返し、登録に言語を残す", async () => {
		const interaction = createInteraction({
			channel: createThread({ id: "thread", guildId: "guild", name: "general" }),
			guild: { id: "guild" },
			locale: Locale.EnglishUS
		});

		await registerThreadCommand.execute(interaction);

		const rows = await db.selectFrom("threads").select("locale").execute();
		expect(rows).toEqual([{ locale: Locale.EnglishUS }]);
		expect(interaction.editReply).toHaveBeenCalledWith({
			embeds: [expect.objectContaining({ author: expect.objectContaining({ name: 'Now keeping "general"' }) })]
		});
	});

	it("コマンドの説明文は英語を基本にし、日本語の訳も持つ", () => {
		const data = registerThreadCommand.data.toJSON();

		expect(data.description).toBe("Keep this thread from being auto-archived");
		expect(data.description_localizations).toEqual({
			[Locale.Japanese]: "このスレッドが自動でアーカイブされないようにします"
		});
	});
});
