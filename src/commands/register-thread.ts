import { ChannelNotFoundError, GuildNotFoundError } from "#/error.ts";
import { db } from "#/libs/kysely.ts";
import { getMessages } from "#/libs/messages.ts";
import type { CacheType, ChatInputCommandInteraction } from "discord.js";
import {
	ApplicationIntegrationType,
	InteractionContextType,
	Locale,
	MessageFlags,
	PermissionFlagsBits,
	SlashCommandBuilder
} from "discord.js";

// 荒らしに大量のスレッドを登録されても、起動時の確認やDBが膨らみすぎないようにする
const maxThreadsPerGuild = 100;

export const registerThreadCommand = {
	data: new SlashCommandBuilder()
		.setName("keep")
		.setDescription(getMessages(Locale.EnglishUS).registerDescription)
		.setDescriptionLocalizations({ [Locale.Japanese]: getMessages(Locale.Japanese).registerDescription })
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageThreads)
		.setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
		.setNSFW(false)
		.setContexts(InteractionContextType.Guild),
	execute: async (interaction: ChatInputCommandInteraction<CacheType>): Promise<void> => {
		const messages = getMessages(interaction.locale);

		if (interaction.guild === null) {
			throw new GuildNotFoundError();
		}

		// アーカイブ済みのスレッドは接続直後の一覧に含まれず、キャッシュにないとinteraction.channelがnullになる
		const channel = interaction.channel ?? (await interaction.client.channels.fetch(interaction.channelId));
		if (channel === null) {
			throw new ChannelNotFoundError();
		}

		if (!channel.isThread()) {
			await interaction.reply({
				embeds: [
					{
						description: messages.notThreadDescription,
						color: 0xf44458,
						author: {
							name: messages.notThreadTitle,
							icon_url: "https://r2.aki.wtf/report.png"
						}
					}
				],
				flags: MessageFlags.Ephemeral
			});

			return;
		}

		const { count } = await db
			.selectFrom("threads")
			.select((eb) => eb.fn.countAll().as("count"))
			.where("guild_id", "=", interaction.guild.id)
			.executeTakeFirstOrThrow();

		if (Number(count) >= maxThreadsPerGuild) {
			await interaction.reply({
				embeds: [
					{
						description: messages.limitDescription(maxThreadsPerGuild),
						color: 0xf44458,
						author: {
							name: messages.limitTitle,
							icon_url: "https://r2.aki.wtf/report.png"
						}
					}
				],
				flags: MessageFlags.Ephemeral
			});

			return;
		}

		const id = crypto.randomUUID();

		await db
			// prettier
			.insertInto("threads")
			.values({
				id,
				thread_id: channel.id,
				guild_id: interaction.guild.id,
				locale: interaction.locale
			})
			.execute();

		try {
			// スレッドの更新はAPIの回数制限で待たされると3秒の応答期限を過ぎる。登録済みの断りは本人にだけ見せたいので、登録の後で保留にする
			await interaction.deferReply();

			// アーカイブ済みのスレッドは、解除を同時に指定しないとDiscordが編集を拒否する
			await channel.edit({ archived: false, autoArchiveDuration: 10080 });
		} catch (e) {
			// 登録を残すと、権限を直して実行し直しても「すでに見守っています」と断られる。
			// 待っている間に/cancelと別の/keepが挟まることがあるので、スレッドではなく自分が入れた行を消す
			await db.deleteFrom("threads").where("id", "=", id).execute();
			throw e;
		}

		await interaction.editReply({
			embeds: [
				{
					description: messages.registeredDescription,
					color: 0xedf8aa,
					author: {
						name: messages.registeredTitle(channel.name),
						icon_url: "https://r2.aki.wtf/check.png"
					}
				}
			]
		});

		return;
	}
};
