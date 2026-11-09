import { type AnyThreadChannel, type APIEmbed, MessageFlags, type RESTError, RESTJSONErrorCodes } from "discord.js";
import { closingThreadIds } from "#/events/keep-threads.ts";
import { errorEmbed } from "#/libs/embed.ts";
import { db } from "#/libs/kysely.ts";
import { logError } from "#/libs/log-error.ts";
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

	// 登録したときの言語でスレッドに投稿する。登録を読む前に失敗したときは、サーバーの言語で知らせる
	let messages = getMessages(newThread.guild.preferredLocale);

	try {
		const result = await db
			// prettier
			.selectFrom("threads")
			.select("locale")
			.where("thread_id", "=", newThread.id)
			.where("guild_id", "=", newThread.guildId)
			.execute();

		const [row] = result;
		if (row === undefined) {
			return;
		}

		messages = getMessages(row.locale);

		await newThread.edit({ archived: false, autoArchiveDuration: 10080 });

		let title = messages.durationLockedTitle;
		let description = messages.durationLockedDescription;
		if (isArchived) {
			console.log(`アーカイブを解除しました: ${newThread.id}`);
			title = messages.archiveLockedTitle;
			description = messages.archiveLockedDescription;
		}

		// スレッドは元に戻せているので、ここで失敗しても外側のcatchに渡して「戻せなかった」と知らせない
		try {
			await newThread.send({
				embeds: [errorEmbed(title, description)],
				flags: MessageFlags.SuppressNotifications
			});
		} catch (sendError) {
			logError(sendError);
		}
	} catch (e) {
		// 戻せなかったアーカイブ済みのスレッドには投稿も失敗しやすく、処理されない例外でBotが落ちるので、ログだけ残す
		if (isArchived) {
			logError(e);
			return;
		}

		let embed: APIEmbed;

		if (
			(e as RESTError).code === RESTJSONErrorCodes.MissingAccess ||
			(e as RESTError).code === RESTJSONErrorCodes.MissingPermissions
		) {
			embed = errorEmbed(messages.missingPermissionTitle, messages.missingPermissionDescription);
		} else {
			logError(e);
			embed = errorEmbed(messages.unknownErrorTitle, messages.durationResetFailedDescription, "error");
		}

		// スレッドに投稿する権限がないと、このお知らせも失敗する
		try {
			await newThread.send({ embeds: [embed] });
		} catch (sendError) {
			logError(sendError);
		}
	}
};
