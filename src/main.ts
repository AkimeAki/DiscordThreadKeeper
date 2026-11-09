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
import { registerThreadCommand } from "#/commands/register-thread.ts";
import { cancelThreadCommand } from "#/commands/cancel-thread.ts";
import { helpCommand } from "#/commands/help.ts";
import { registeredThreadListCommand } from "#/commands/registered-thread-list.ts";
import { ChannelNotFoundError, GuildNotFoundError } from "#/error.ts";
import { guildDelete } from "#/events/guild-delete.ts";
import { keepGuildThreads, keepThreads } from "#/events/keep-threads.ts";
import { threadUpdate } from "#/events/thread-update.ts";
import { sendCommandsToBotList, syncCommands } from "#/libs/commands.ts";
import { logError } from "#/libs/log-error.ts";
import { getMessages } from "#/libs/messages.ts";
import { notify } from "#/libs/notify.ts";

const token = process.env["DISCORD_BOT_TOKEN"] ?? "";

const client = new Client({
	intents: [GatewayIntentBits.Guilds],
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
	await client.user.setActivity("😎", { type: ActivityType.Custom, state: "😎スレッドを見守り中" });
});

client.once(Events.ClientReady, async (client) => {
	await syncCommands(client);
	await sendCommandsToBotList(client);
});

client.once(Events.ClientReady, async (client) => {
	await keepThreads(client);
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
			embed = {
				description: messages.channelNotFoundDescription,
				color: 0xf44458,
				author: {
					name: messages.channelNotFoundTitle,
					icon_url: "https://r2.aki.wtf/report.png"
				}
			};
		} else if (e instanceof GuildNotFoundError) {
			embed = {
				description: messages.guildNotFoundDescription,
				color: 0xf44458,
				author: {
					name: messages.guildNotFoundTitle,
					icon_url: "https://r2.aki.wtf/report.png"
				}
			};
		}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		else if (interaction.commandName === "keep" && (e as any).code === "SQLITE_CONSTRAINT_UNIQUE") {
			embed = {
				color: 0xf44458,
				author: {
					name: messages.alreadyKeepingTitle,
					icon_url: "https://r2.aki.wtf/report.png"
				}
			};
		} else if (
			(e as RESTError).code === RESTJSONErrorCodes.MissingAccess ||
			(e as RESTError).code === RESTJSONErrorCodes.MissingPermissions
		) {
			embed = {
				description: messages.missingPermissionDescription,
				color: 0xf44458,
				author: {
					name: messages.missingPermissionTitle,
					icon_url: "https://r2.aki.wtf/report.png"
				}
			};
		} else {
			logError(e);
			embed = {
				description: messages.unknownErrorDescription,
				color: 0xf44458,
				author: {
					name: messages.unknownErrorTitle,
					icon_url: "https://r2.aki.wtf/error.png"
				}
			};
		}

		// 応答期限が切れたときなど、エラーの返信も失敗することがある。ここで受け止めないとプロセスごと落ちる
		try {
			if (interaction.deferred) {
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

client.on(Events.GuildDelete, guildDelete);

client.on(Events.GuildAvailable, async (guild) => {
	// 接続直後は全サーバーでこのイベントが起きる。その分は起動時の確認で見るので、起動後に障害から復旧したサーバーだけを確認する
	if (client.isReady()) {
		await keepGuildThreads(client, guild.id);
	}
});

client.on(Events.GuildCreate, async (guild) => {
	const message = `サーバーに参加しました: ${guild.id}（参加中: ${client.guilds.cache.size}サーバー）`;
	console.log(message);
	await notify(message);
	if (client.user !== null) {
		await client.user.setActivity("😎", { type: ActivityType.Custom, state: "😎スレッドを見守り中" });
	}
});

// discord.jsはasyncのリスナーが投げた例外をerrorイベントに送る。受け取るリスナーがないとプロセスごと落ちるので、ログに残して動き続ける
client.on(Events.Error, logError);

// Railwayはデプロイを切り替えるときにSIGTERMで止める。合図のまま落ちるとnpmが失敗扱いにし、異常終了の通知が届くので、自分で接続を閉じて正常に終了する
process.once("SIGTERM", async () => {
	console.log("停止の合図を受けたので終了します");
	await client.destroy();
	process.exit(0);
});

void client.login(token);
