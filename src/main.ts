import {
	ActivityType,
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
import { keepThreads } from "#/events/keep-threads.ts";
import { threadUpdate } from "#/events/thread-update.ts";
import { syncCommands } from "#/libs/commands.ts";
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

		if (e instanceof ChannelNotFoundError) {
			await interaction.reply({
				embeds: [
					{
						description: messages.channelNotFoundDescription,
						color: 0xf44458,
						author: {
							name: messages.channelNotFoundTitle,
							icon_url: "https://r2.aki.wtf/report.png"
						}
					}
				],
				flags: MessageFlags.Ephemeral
			});
		} else if (e instanceof GuildNotFoundError) {
			await interaction.reply({
				embeds: [
					{
						description: messages.guildNotFoundDescription,
						color: 0xf44458,
						author: {
							name: messages.guildNotFoundTitle,
							icon_url: "https://r2.aki.wtf/report.png"
						}
					}
				],
				flags: MessageFlags.Ephemeral
			});
		}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		else if (interaction.commandName === "keep" && (e as any).code === "SQLITE_CONSTRAINT_UNIQUE") {
			await interaction.reply({
				embeds: [
					{
						color: 0xf44458,
						author: {
							name: messages.alreadyKeepingTitle,
							icon_url: "https://r2.aki.wtf/report.png"
						}
					}
				],
				flags: MessageFlags.Ephemeral
			});
		} else if ((e as RESTError).code === RESTJSONErrorCodes.MissingAccess) {
			await interaction.reply({
				embeds: [
					{
						description: messages.missingPermissionDescription,
						color: 0xf44458,
						author: {
							name: messages.missingPermissionTitle,
							icon_url: "https://r2.aki.wtf/report.png"
						}
					}
				],
				flags: MessageFlags.Ephemeral
			});
		} else {
			logError(e);
			await interaction.reply({
				embeds: [
					{
						description: messages.unknownErrorDescription,
						color: 0xf44458,
						author: {
							name: messages.unknownErrorTitle,
							icon_url: "https://r2.aki.wtf/error.png"
						}
					}
				],
				flags: MessageFlags.Ephemeral
			});
		}
	}
});

client.on(Events.ThreadUpdate, threadUpdate);

client.on(Events.GuildDelete, guildDelete);

client.on(Events.GuildCreate, async (guild) => {
	const message = `サーバーに参加しました: ${guild.id}（参加中: ${client.guilds.cache.size}サーバー）`;
	console.log(message);
	await notify(message);
	if (client.user !== null) {
		await client.user.setActivity("😎", { type: ActivityType.Custom, state: "😎スレッドを見守り中" });
	}
});

// Railwayはデプロイを切り替えるときにSIGTERMで止める。合図のまま落ちるとnpmが失敗扱いにし、異常終了の通知が届くので、自分で接続を閉じて正常に終了する
process.once("SIGTERM", async () => {
	console.log("停止の合図を受けたので終了します");
	await client.destroy();
	process.exit(0);
});

void client.login(token);
