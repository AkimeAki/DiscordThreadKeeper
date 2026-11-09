import {
	ActivityType,
	type APIEmbed,
	Client,
	Events,
	GatewayIntentBits,
	MessageFlags,
	Options,
	type RESTError,
	RESTJSONErrorCodes
} from "discord.js";
import cron from "node-cron";
import { registerThreadCommand } from "#/commands/register-thread.ts";
import { cancelThreadCommand } from "#/commands/cancel-thread.ts";
import { helpCommand } from "#/commands/help.ts";
import { registeredThreadListCommand } from "#/commands/registered-thread-list.ts";
import { ChannelNotFoundError, GuildNotFoundError } from "#/error.ts";
import { guildDelete } from "#/events/guild-delete.ts";
import { keepGuildThreads, keepThreads } from "#/events/keep-threads.ts";
import { threadDelete } from "#/events/thread-delete.ts";
import { threadUpdate } from "#/events/thread-update.ts";
import { sendCommandsToBotList, syncCommands } from "#/libs/commands.ts";
import { errorEmbed } from "#/libs/embed.ts";
import { db } from "#/libs/kysely.ts";
import { logError } from "#/libs/log-error.ts";
import { getMessages } from "#/libs/messages.ts";
import { notify } from "#/libs/notify.ts";

const token = process.env["DISCORD_BOT_TOKEN"] ?? "";

const client = new Client({
	intents: [GatewayIntentBits.Guilds],
	// setActivityの表示はセッションを作り直すと消えるので、接続のたびに送られる初期値として渡す
	presence: { activities: [{ name: "😎", type: ActivityType.Custom, state: "😎スレッドを見守り中" }] },
	// サーバーが増えてもメモリが膨らまないよう、使わないキャッシュは持たない。
	// サーバー・チャンネル・ロール・権限はdiscord.jsが制限を想定しておらず、スレッドは起動時の確認で使うので残す
	makeCache: Options.cacheWithLimits({
		ApplicationCommandManager: 0,
		ApplicationEmojiManager: 0,
		AutoModerationRuleManager: 0,
		BaseGuildEmojiManager: 0,
		DMMessageManager: 0,
		EntitlementManager: 0,
		GuildBanManager: 0,
		GuildEmojiManager: 0,
		GuildInviteManager: 0,
		// discord.jsが権限の計算などで使うBot自身だけは残す
		GuildMemberManager: { maxSize: 0, keepOverLimit: (member) => member.id === member.client.user.id },
		GuildMessageManager: 0,
		GuildScheduledEventManager: 0,
		GuildStickerManager: 0,
		MessageManager: 0,
		PresenceManager: 0,
		ReactionManager: 0,
		ReactionUserManager: 0,
		StageInstanceManager: 0,
		ThreadMemberManager: 0,
		UserManager: { maxSize: 0, keepOverLimit: (user) => user.id === user.client.user.id },
		VoiceStateManager: 0
	})
});

client.once(Events.ClientReady, async (client) => {
	const message = `起動しました: ${client.user.tag}（参加中: ${client.guilds.cache.size}サーバー）`;
	console.log(message);
	await notify(message);
});

client.once(Events.ClientReady, async (client) => {
	await syncCommands(client);
	await sendCommandsToBotList(client);
});

client.once(Events.ClientReady, async (client) => {
	await keepThreads(client);

	// チャンネル一覧から隠れる前に再開し直すため、毎日決まった時刻にも確認する
	cron.schedule(
		"0 4 * * *",
		() => {
			return keepThreads(client);
		},
		{ timezone: "Asia/Tokyo" }
	);
});

client.on(Events.InteractionCreate, async (interaction) => {
	// コマンド以外を無視
	if (!interaction.isChatInputCommand()) {
		return;
	}

	// コマンドの処理
	try {
		if (interaction.commandName === "keep") {
			await registerThreadCommand.execute(interaction);
		} else if (interaction.commandName === "list") {
			await registeredThreadListCommand.execute(interaction);
		} else if (interaction.commandName === "cancel") {
			await cancelThreadCommand.execute(interaction);
		} else if (interaction.commandName === "help") {
			await helpCommand.execute(interaction);
		} else {
			console.error(`不明なコマンドを受け取りました: ${interaction.commandName}`);
		}
	} catch (e) {
		const messages = getMessages(interaction.locale);
		let embed: APIEmbed;

		if (e instanceof ChannelNotFoundError) {
			embed = errorEmbed(messages.channelNotFoundTitle, messages.channelNotFoundDescription);
		} else if (e instanceof GuildNotFoundError) {
			embed = errorEmbed(messages.guildNotFoundTitle, messages.guildNotFoundDescription);
		}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		else if (interaction.commandName === "keep" && (e as any).code === "SQLITE_CONSTRAINT_UNIQUE") {
			embed = errorEmbed(messages.alreadyKeepingTitle);
		} else if (
			(e as RESTError).code === RESTJSONErrorCodes.MissingAccess ||
			(e as RESTError).code === RESTJSONErrorCodes.MissingPermissions
		) {
			embed = errorEmbed(messages.missingPermissionTitle, messages.missingPermissionDescription);
		} else {
			logError(e);
			embed = errorEmbed(messages.unknownErrorTitle, messages.unknownErrorDescription, "error");
		}

		// 応答期限が切れたときなど、エラーの返信も失敗することがある。ここで受け止めないとプロセスごと落ちる
		try {
			if (interaction.replied) {
				// 複数のメッセージに分けた一覧の途中で失敗したときに、表示済みの内容をエラーで上書きしない
				await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
			} else if (interaction.deferred) {
				await interaction.editReply({ embeds: [embed] });
			} else {
				await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
			}
		} catch (replyError) {
			logError(replyError);
		}
	}
});

client.on(Events.ThreadUpdate, threadUpdate);

client.on(Events.ThreadDelete, threadDelete);

client.on(Events.GuildDelete, guildDelete);

client.on(Events.GuildAvailable, async (guild) => {
	// 接続直後は全サーバーでこのイベントが起きる。その分は起動時の確認で見るので、起動後に障害から復旧したサーバーだけを確認する
	if (client.isReady()) {
		await keepGuildThreads(client, guild.id, { useCache: false });
	}
});

client.on(Events.GuildCreate, async (guild) => {
	const message = `サーバーに参加しました: ${guild.id}（参加中: ${client.guilds.cache.size}サーバー）`;
	console.log(message);
	await notify(message);
});

// discord.jsはasyncのリスナーが投げた例外をerrorイベントに送る。受け取るリスナーがないとプロセスごと落ちるので、ログに残して動き続ける
client.on(Events.Error, logError);

// Railwayはデプロイを切り替えるときにSIGTERMで止める。合図のまま落ちるとnpmが失敗扱いにし、異常終了の通知が届くので、自分で接続を閉じて正常に終了する
process.once("SIGTERM", async () => {
	console.log("停止の合図を受けたので終了します");
	await client.destroy();
	process.exit(0);
});

// DBは最初の問い合わせのときに開く。開けないまま何も見守れないBotが動き続けないよう、接続する前に確かめて起動を失敗させる
await db.selectFrom("threads").select("id").limit(1).execute();

void client.login(token);
