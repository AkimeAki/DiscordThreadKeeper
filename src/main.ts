import { ActivityType, Client, Events, GatewayIntentBits, type RESTError, RESTJSONErrorCodes } from "discord.js";
import { registerThreadCommand } from "#/commands/register-thread.ts";
import { cancelThreadCommand } from "#/commands/cancel-thread.ts";
import { registeredThreadListCommand } from "#/commands/registered-thread-list.ts";
import { ChannelNotFoundError, GuildNotFoundError } from "#/error.ts";
import { keepThreads } from "#/events/keep-threads.ts";
import { threadUpdate } from "#/events/thread-update.ts";

const token = process.env["DISCORD_BOT_TOKEN"] ?? "";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async (client) => {
	console.log(`起動しました: ${client.user.tag}`);
	await client.user.setActivity("スレッドを監視中", { type: ActivityType.Custom, state: "スレッドを監視中" });
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
		if (interaction.commandName === "register") {
			await registerThreadCommand.execute(interaction);
		} else if (interaction.commandName === "list") {
			await registeredThreadListCommand.execute(interaction);
		} else if (interaction.commandName === "cancel") {
			await cancelThreadCommand.execute(interaction);
		} else {
			console.error(`不明なコマンドを受け取りました: ${interaction.commandName}`);
		}
	} catch (e) {
		if (e instanceof ChannelNotFoundError) {
			await interaction.reply({
				embeds: [
					{
						description: "Botがこのチャンネルを閲覧できるか、権限を確認してください。",
						color: 0xf44458,
						author: {
							name: "チャンネルを確認できませんでした",
							icon_url: "https://r2.aki.wtf/report.png"
						}
					}
				],
				ephemeral: true
			});
		} else if (e instanceof GuildNotFoundError) {
			await interaction.reply({
				embeds: [
					{
						description: "このコマンドは、Botが参加しているサーバーでのみ使うことができます。",
						color: 0xf44458,
						author: {
							name: "サーバーの中で実行してください",
							icon_url: "https://r2.aki.wtf/report.png"
						}
					}
				],
				ephemeral: true
			});
		}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		else if (interaction.commandName === "register" && (e as any).code === "SQLITE_CONSTRAINT_UNIQUE") {
			await interaction.reply({
				embeds: [
					{
						color: 0xf44458,
						author: {
							name: "このスレッドはすでに監視しています",
							icon_url: "https://r2.aki.wtf/report.png"
						}
					}
				],
				ephemeral: true
			});
		} else if ((e as RESTError).code === RESTJSONErrorCodes.MissingAccess) {
			await interaction.reply({
				embeds: [
					{
						description: "Botに「スレッドの管理」権限があるか確認してください。",
						color: 0xf44458,
						author: {
							name: "Botの権限が足りません",
							icon_url: "https://r2.aki.wtf/report.png"
						}
					}
				],
				ephemeral: true
			});
		} else {
			console.error(e);
			await interaction.reply({
				embeds: [
					{
						description: "時間をおいて、もう一度お試しください。",
						color: 0xf44458,
						author: {
							name: "エラーが発生しました",
							icon_url: "https://r2.aki.wtf/error.png"
						}
					}
				],
				ephemeral: true
			});
		}
	}
});

client.on(Events.ThreadUpdate, threadUpdate);

client.on(Events.GuildCreate, async (guild) => {
	console.log(`サーバーに参加しました: ${guild.id}`);
	if (client.user !== null) {
		await client.user.setActivity("スレッドを監視中", { type: ActivityType.Custom, state: "スレッドを監視中" });
	}
});

void client.login(token);
