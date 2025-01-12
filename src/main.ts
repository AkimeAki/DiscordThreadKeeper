import {
	ActivityType,
	Client,
	Events,
	GatewayIntentBits,
	MessageFlags,
	RESTError,
	RESTJSONErrorCodes
} from "discord.js";
import * as dotenv from "dotenv";
import { registerThreadCommand } from "@/commands/register-thread.js";
import { cancelThreadCommand } from "@/commands/cancel-thread.js";
import { registeredThreadListCommand } from "@/commands/registered-thread-list.js";
import { db } from "@/libs/kysely.js";
import * as cron from "node-cron";
import { ChannelNotFoundError, GuildNotFoundError } from "@/error.js";
import { deleteThread } from "@/libs/delete-thread.js";

dotenv.config();
const token = process.env.DISCORD_BOT_TOKEN ?? "";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async (client) => {
	console.log(`${client.user.tag}が起動した😼`);
	await client.user.setActivity("😎", { type: ActivityType.Custom, state: "😎スレッドを監視中" });
});

const keep = async (client: Client) => {
	try {
		const guilds = await client.guilds.fetch();
		const result = await db()
			// prettier
			.selectFrom("threads")
			.select(["thread_id", "guild_id"])
			.execute();

		const guildIds = result.map((r) => r.guild_id);

		console.log("update start");

		for (const guild of Array.from(guilds.values())) {
			if (!guildIds.includes(guild.id)) {
				continue;
			}

			const threadIds = result.filter((r) => r.guild_id === guild.id).map((r) => r.thread_id);

			for (const id of threadIds) {
				try {
					const channel = await client.channels.fetch(id);
					if (channel === null) {
						continue;
					}

					if (!channel.isSendable() || !channel.isThread()) {
						continue;
					}

					await new Promise((resolve) => setTimeout(resolve, 500));
					await channel.setArchived(true);
					await new Promise((resolve) => setTimeout(resolve, 1000));
					await channel.setArchived(false);
					await new Promise((resolve) => setTimeout(resolve, 1000));
					await channel.setAutoArchiveDuration(10080);
					console.log("生き延びて、" + channel.name + ":" + channel.id);
				} catch (e) {
					// エラーが起きたら登録しているスレッドを削除

					if ((e as RESTError).code === RESTJSONErrorCodes.MissingAccess) {
						/* empty */
					} else if ((e as RESTError).code === RESTJSONErrorCodes.UnknownChannel) {
						await deleteThread(guild.id, id);
					} else if ((e as RESTError).code === RESTJSONErrorCodes.UnknownGuild) {
						await deleteThread(guild.id, id);
					} else {
						console.error(e);
					}
				}
			}
		}
	} catch (e) {
		console.error(e);
	}

	console.log("update end");
};

client.once(Events.ClientReady, async (client) => {
	await keep(client);

	cron.schedule("0 0 */5 * *", async () => {
		await keep(client);
	});
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
		else if (interaction.commandName === "register" && (e as any).code === "ER_DUP_ENTRY") {
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
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

client.on(Events.ThreadUpdate, async (oldThread, newThread) => {
	// スレッドのアーカイブまでの期間が変更されていなければ何もしない
	if (oldThread.autoArchiveDuration === newThread.autoArchiveDuration || newThread.autoArchiveDuration === 10080) {
		return;
	}

	// コマンドの処理
	try {
		const result = await db()
			// prettier
			.selectFrom("threads")
			.select("id")
			.where("thread_id", "=", newThread.id)
			.where("guild_id", "=", newThread.guildId)
			.execute();

		if (result.length !== 0) {
			await newThread.setAutoArchiveDuration(10080);
			await newThread.send({
				embeds: [
					{
						description: "監視中のスレッドの時間はいじらせないよ！",
						color: 0xf44458,
						author: {
							name: `アーカイブされるまでの時間はずっと1週間だよ～ん`,
							icon_url: "https://r2.aki.wtf/report.png"
						}
					}
				],
				flags: MessageFlags.SuppressNotifications
			});
		}
	} catch (e) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		if ((e as any).code === 50001) {
			await newThread.send({
				embeds: [
					{
						description: "「スレッドを管理」権限が足らないかも！",
						color: 0xf44458,
						author: {
							name: "スレッドがいじれないな...🤔",
							icon_url: "https://r2.aki.wtf/report.png"
						}
					}
				]
			});
		} else {
			console.error(e);
			await newThread.send({
				embeds: [
					{
						color: 0xf44458,
						author: {
							name: "エラーだ！エラーだぞ！🙀",
							icon_url: "https://r2.aki.wtf/error.png"
						}
					}
				]
			});
		}
	}
});

client.on(Events.GuildCreate, async (guild) => {
	console.log(`${guild.name}に参加した😼`);
	if (client.user !== null) {
		await client.user.setActivity("😎", { type: ActivityType.Custom, state: "😎スレッドを監視中" });
	}
});

void client.login(token);
