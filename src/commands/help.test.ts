import { MessageFlags } from "discord.js";
import { describe, expect, it } from "vitest";
import { helpCommand } from "#/commands/help.ts";
import { createInteraction } from "#/tests/discord.ts";

describe("helpCommand", () => {
	it("日本語の利用者には、コマンドの一覧を日本語で返す", async () => {
		const interaction = createInteraction({ channel: null, guild: null });

		await helpCommand.execute(interaction);

		expect(interaction.reply).toHaveBeenCalledWith({
			embeds: [
				expect.objectContaining({
					description: expect.stringContaining(
						"- `/keep` このスレッドが自動でアーカイブされないようにします\n- `/cancel` このスレッドの見守りをやめます\n- `/list` 見守り中のスレッドを一覧で表示します"
					),
					author: expect.objectContaining({ name: "ThreadKeeperの使い方" })
				})
			],
			flags: MessageFlags.Ephemeral
		});
	});

	it("日本語以外の利用者には、英語で返す", async () => {
		const interaction = createInteraction({ channel: null, guild: null, locale: "en-US" });

		await helpCommand.execute(interaction);

		expect(interaction.reply).toHaveBeenCalledWith(
			expect.objectContaining({
				embeds: [
					expect.objectContaining({ author: expect.objectContaining({ name: "How to use ThreadKeeper" }) })
				]
			})
		);
	});

	it("既定で、権限を持たない人も使える", () => {
		const data = helpCommand.data.toJSON();

		expect(data.default_member_permissions).toBeNull();
	});
});
