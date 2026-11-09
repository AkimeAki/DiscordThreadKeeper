import { InteractionContextType, MessageFlags, PermissionFlagsBits } from "discord.js";
import { describe, expect, it } from "vitest";
import { registeredThreadListCommand } from "#/commands/registered-thread-list.ts";
import { GuildNotFoundError } from "#/error.ts";
import { registerThread } from "#/tests/database.ts";
import { createInteraction } from "#/tests/discord.ts";

describe("registeredThreadListCommand", () => {
	it("登録がなければ、見守り中のスレッドはないと本人にだけ返す", async () => {
		const interaction = createInteraction({ channel: null, guild: { id: "guild" } });

		await registeredThreadListCommand.execute(interaction);

		expect(interaction.reply).toHaveBeenCalledWith({
			embeds: [
				expect.objectContaining({ author: expect.objectContaining({ name: "見守り中のスレッドはありません" }) })
			],
			flags: MessageFlags.Ephemeral
		});
	});

	it("そのサーバーで登録したスレッドだけをメンションで一覧にし、本人にだけ見せる", async () => {
		await registerThread("guild", "1");
		await registerThread("guild", "2");
		await registerThread("other-guild", "3");
		const interaction = createInteraction({ channel: null, guild: { id: "guild" } });

		await registeredThreadListCommand.execute(interaction);

		expect(interaction.reply).toHaveBeenCalledWith({
			embeds: [expect.objectContaining({ description: "- <#1>\n- <#2>" })],
			flags: MessageFlags.Ephemeral
		});
	});

	it("登録の上限まで並べても、説明文の上限に収まる", async () => {
		for (let i = 0; i < 100; i++) {
			await registerThread("guild", `${i}`.padStart(20, "0"));
		}
		const interaction = createInteraction({ channel: null, guild: { id: "guild" } });

		await registeredThreadListCommand.execute(interaction);

		expect(interaction.reply).toHaveBeenCalledOnce();
		expect(interaction.reply).toHaveBeenCalledWith(
			expect.objectContaining({
				embeds: [expect.objectContaining({ description: expect.stringMatching(/^[\s\S]{1,4096}$/) })]
			})
		);
	});

	it("サーバーの情報がなければ、GuildNotFoundErrorを投げる", async () => {
		const interaction = createInteraction({ channel: null, guild: null });

		await expect(registeredThreadListCommand.execute(interaction)).rejects.toBeInstanceOf(GuildNotFoundError);
	});

	it("既定では「スレッドの管理」を持つ人だけが、サーバーの中で使える", () => {
		const data = registeredThreadListCommand.data.toJSON();

		expect(data.default_member_permissions).toBe(PermissionFlagsBits.ManageThreads.toString());
		expect(data.contexts).toEqual([InteractionContextType.Guild]);
	});
});
