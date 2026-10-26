import { getMessages } from "#/libs/messages.ts";
import type { CacheType, ChatInputCommandInteraction } from "discord.js";
import {
	ApplicationIntegrationType,
	InteractionContextType,
	Locale,
	MessageFlags,
	SlashCommandBuilder
} from "discord.js";

export const helpCommand = {
	data: new SlashCommandBuilder()
		.setName("help")
		.setDescription(getMessages(Locale.EnglishUS).helpDescription)
		.setDescriptionLocalizations({ [Locale.Japanese]: getMessages(Locale.Japanese).helpDescription })
		// ほかのコマンドと違い、使い方は権限のない人にも見せる
		.setDefaultMemberPermissions(null)
		.setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
		.setNSFW(false)
		.setContexts(InteractionContextType.Guild),
	execute: async (interaction: ChatInputCommandInteraction<CacheType>): Promise<void> => {
		const messages = getMessages(interaction.locale);

		// 各コマンドの説明は、Discordのコマンド一覧に出る説明文と同じものを使う
		const lines = [
			messages.helpUsage,
			"",
			`- \`/keep\` ${messages.registerDescription}`,
			`- \`/cancel\` ${messages.cancelDescription}`,
			`- \`/list\` ${messages.listDescription}`,
			"",
			messages.helpNote
		];

		await interaction.reply({
			embeds: [
				{
					description: lines.join("\n"),
					color: 0xedf8aa,
					author: {
						name: messages.helpTitle,
						icon_url: "https://r2.aki.wtf/check.png"
					}
				}
			],
			flags: MessageFlags.Ephemeral
		});
	}
};
