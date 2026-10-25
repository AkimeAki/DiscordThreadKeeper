import { Locale } from "discord.js";

const ja = {
	registerDescription: "このスレッドが自動でアーカイブされないようにします",
	cancelDescription: "このスレッドの見守りをやめます",
	listDescription: "見守り中のスレッドを一覧で表示します",

	notThreadTitle: "スレッドの中で実行してください",
	notThreadDescription: "このコマンドはスレッドでのみ使うことができます。",

	limitTitle: "これ以上スレッドを見守ることができません",
	limitDescription: (max: number) =>
		`1つのサーバーで見守ることができるスレッドは${max}件までです。不要な見守りを \`/cancel\` でやめてから、もう一度お試しください。`,
	registeredTitle: (name: string) => `「${name}」の見守りを始めました`,
	registeredDescription:
		"このスレッドは自動でアーカイブされなくなります。見守りをやめるときは `/cancel` を実行してください。",
	alreadyKeepingTitle: "このスレッドはすでに見守っています",

	notKeepingTitle: "このスレッドは見守っていません",
	notKeepingDescription: "見守りを始めるときは `/keep` を実行してください。",
	cancelledTitle: (name: string) => `「${name}」の見守りをやめました`,
	cancelledDescription: "このスレッドは、通常どおり自動でアーカイブされます。",

	emptyListTitle: "見守り中のスレッドはありません",
	listTitle: "見守り中のスレッド",
	removedDeletedThreads: "削除されたスレッドは、見守りの対象から外しました。",

	channelNotFoundTitle: "チャンネルを確認できませんでした",
	channelNotFoundDescription: "Botがこのチャンネルを閲覧できるか、権限を確認してください。",
	guildNotFoundTitle: "サーバーの中で実行してください",
	guildNotFoundDescription: "このコマンドは、Botが参加しているサーバーでのみ使うことができます。",
	missingPermissionTitle: "Botの権限が足りません",
	missingPermissionDescription: "Botに「スレッドの管理」権限があるか確認してください。",
	unknownErrorTitle: "エラーが発生しました",
	unknownErrorDescription: "時間をおいて、もう一度お試しください。",

	durationLockedTitle: "自動アーカイブまでの期間は変更できません",
	durationLockedDescription:
		"見守り中のスレッドのため、期間を1週間に戻しました。変えるときは、先に `/cancel` で見守りをやめてください。",
	durationResetFailedDescription: "自動アーカイブまでの期間を1週間に戻すことができませんでした。"
};

// 権限の名前は、英語のDiscordの画面と同じ表記にそろえる
const en: typeof ja = {
	registerDescription: "Keep this thread from being auto-archived",
	cancelDescription: "Stop keeping this thread",
	listDescription: "List the threads being kept",

	notThreadTitle: "Run this command in a thread",
	notThreadDescription: "This command can only be used in threads.",

	limitTitle: "Can't keep any more threads",
	limitDescription: (max: number) =>
		`A server can keep up to ${max} threads. Stop keeping threads you no longer need with \`/cancel\`, then try again.`,
	registeredTitle: (name: string) => `Now keeping "${name}"`,
	registeredDescription: "This thread will no longer be auto-archived. To stop keeping it, run `/cancel`.",
	alreadyKeepingTitle: "This thread is already being kept",

	notKeepingTitle: "This thread isn't being kept",
	notKeepingDescription: "To start keeping it, run `/keep`.",
	cancelledTitle: (name: string) => `Stopped keeping "${name}"`,
	cancelledDescription: "This thread will be auto-archived as usual.",

	emptyListTitle: "No threads are being kept",
	listTitle: "Kept threads",
	removedDeletedThreads: "Deleted threads have been removed from the list.",

	channelNotFoundTitle: "Couldn't access this channel",
	channelNotFoundDescription: "Check that the bot has permission to view this channel.",
	guildNotFoundTitle: "Run this command in a server",
	guildNotFoundDescription: "This command can only be used in servers the bot has joined.",
	missingPermissionTitle: "The bot is missing permissions",
	missingPermissionDescription: "Check that the bot has the Manage Threads permission.",
	unknownErrorTitle: "Something went wrong",
	unknownErrorDescription: "Please try again later.",

	durationLockedTitle: "The auto-archive duration can't be changed",
	durationLockedDescription:
		"This thread is being kept, so the duration was set back to 1 week. To change it, stop keeping it first with `/cancel`.",
	durationResetFailedDescription: "Couldn't set the auto-archive duration back to 1 week."
};

// 日本語の利用者には日本語を、それ以外の言語の利用者には英語を返す
export const getMessages = (locale: string) => (locale === Locale.Japanese ? ja : en);
