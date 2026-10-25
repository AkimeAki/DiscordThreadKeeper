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
	console.log(`${client.user.tag}が起動した😼`);
	await client.user.setActivity("😎", { type: ActivityType.Custom, state: "😎スレッドを監視中" });
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
			console.error(`${interaction.commandName}って何...？`);
		}
	} catch (e) {
		if (e instanceof ChannelNotFoundError) {
			await interaction.reply({
				embeds: [
					{
						description: "ここにボクを招待してほしいな",
						color: 0xf44458,
						author: {
							name: "ここ、プライベートチャンネルじゃない？",
							icon_url: "https://r2.aki.wtf/report.png"
						}
					}
				]
			});
		} else if (e instanceof GuildNotFoundError) {
			await interaction.reply({
				embeds: [
					{
						description: "権限設定間違ってないかな",
						color: 0xf44458,
						author: {
							name: "スレッドが見えないな？",
							icon_url: "https://r2.aki.wtf/report.png"
						}
					}
				]
			});
		}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		else if (interaction.commandName === "register" && (e as any).code === "SQLITE_CONSTRAINT_UNIQUE") {
			await interaction.reply({
				embeds: [
					{
						color: 0xf44458,
						author: {
							name: "めっちゃ見てるよ👀",
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
						color: 0xf44458,
						author: {
							name: "「スレッドを管理」権限が足らないかも",
							icon_url: "https://r2.aki.wtf/report.png"
						}
					}
				]
			});
		} else {
			await interaction.reply({
				embeds: [
					{
						color: 0xf44458,
						author: {
							name: "原因不明のエラーが発生だ🙀",
							icon_url: "https://r2.aki.wtf/error.png"
						}
					}
				]
			});
		}
	}
});

client.on(Events.ThreadUpdate, threadUpdate);

client.on(Events.GuildCreate, async (guild) => {
	console.log(`${guild.name}に参加した😼`);
	if (client.user !== null) {
		await client.user.setActivity("😎", { type: ActivityType.Custom, state: "😎スレッドを監視中" });
	}
});

void client.login(token);
