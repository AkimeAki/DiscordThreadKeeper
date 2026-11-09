import { errorEmbed, successEmbed } from "#/libs/embed.ts";
import { getThread } from "#/libs/get-thread.ts";
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

		const { guildId, thread } = await getThread(interaction);

		const id = crypto.randomUUID();

		// 件数の確認と登録の間に別の/keepが挟まると上限を超えるので、1つのトランザクションにする
		const isFull = await db.transaction().execute(async (transaction) => {
			const { count } = await transaction
				.selectFrom("threads")
				.select((eb) => eb.fn.countAll().as("count"))
				.where("guild_id", "=", guildId)
				.executeTakeFirstOrThrow();

			if (Number(count) >= maxThreadsPerGuild) {
				return true;
			}

			await transaction
				// prettier
				.insertInto("threads")
				.values({
					id,
					thread_id: thread.id,
					guild_id: guildId,
					locale: interaction.locale
				})
				.execute();

			return false;
		});

		if (isFull) {
			await interaction.reply({
				embeds: [errorEmbed(messages.limitTitle, messages.limitDescription(maxThreadsPerGuild))],
				flags: MessageFlags.Ephemeral
			});

			return;
		}

		try {
			// スレッドの更新はAPIの回数制限で待たされると3秒の応答期限を過ぎる。登録済みの断りは本人にだけ見せたいので、登録の後で保留にする
			await interaction.deferReply();

			// アーカイブ済みのスレッドは、解除を同時に指定しないとDiscordが編集を拒否する
			await thread.edit({ archived: false, autoArchiveDuration: 10080 });
		} catch (e) {
			// 登録を残すと、権限を直して実行し直しても「すでに見守っています」と断られる。
			// 待っている間に/cancelと別の/keepが挟まることがあるので、スレッドではなく自分が入れた行を消す
			await db.deleteFrom("threads").where("id", "=", id).execute();
			throw e;
		}

		await interaction.editReply({
			embeds: [successEmbed(messages.registeredTitle(thread.name), messages.registeredDescription)]
		});
	}
};
