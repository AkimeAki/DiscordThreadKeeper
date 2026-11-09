import { type AnyThreadChannel, MessageFlags } from "discord.js";
import { closingThreadIds } from "#/events/keep-threads.ts";
import { errorEmbed } from "#/libs/embed.ts";
import { db } from "#/libs/kysely.ts";
import { getMessages } from "#/libs/messages.ts";

export const threadUpdate = async (oldThread: AnyThreadChannel, newThread: AnyThreadChannel) => {
	const isArchived = oldThread.archived !== true && newThread.archived === true;
	const isDurationChanged =
		oldThread.autoArchiveDuration !== newThread.autoArchiveDuration && newThread.autoArchiveDuration !== 10080;

	// アーカイブされたか、アーカイブまでの期間が変更されたときだけ処理する
	if (!isArchived && !isDurationChanged) {
		return;
	}

	if (isArchived && closingThreadIds.has(newThread.id)) {
		return;
	}

	const row = await db
		// prettier
		.selectFrom("threads")
		.select("locale")
		.where("thread_id", "=", newThread.id)
		.where("guild_id", "=", newThread.guildId)
		.executeTakeFirst();
	if (row === undefined) {
		return;
	}

	await newThread.edit({ archived: false, autoArchiveDuration: 10080 });

	// 登録したときの言語でスレッドに投稿する
	const messages = getMessages(row.locale);
	let title = messages.durationLockedTitle;
	let description = messages.durationLockedDescription;
	if (isArchived) {
		console.log(`アーカイブを解除しました: ${newThread.id}`);
		title = messages.archiveLockedTitle;
		description = messages.archiveLockedDescription;
	}

	await newThread.send({
		embeds: [errorEmbed(title, description)],
		flags: MessageFlags.SuppressNotifications
	});
};
