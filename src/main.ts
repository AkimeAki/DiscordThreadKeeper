import {
	ActivityType,
	Client,
	Events,
	GatewayIntentBits,
	MessageFlags,
	type RESTError,
	RESTJSONErrorCodes
} from "discord.js";
import { registerThreadCommand } from "#/commands/register-thread.ts";
import { cancelThreadCommand } from "#/commands/cancel-thread.ts";
import { registeredThreadListCommand } from "#/commands/registered-thread-list.ts";
import { db } from "#/libs/kysely.ts";
import { ChannelNotFoundError, GuildNotFoundError } from "#/error.ts";
import { deleteThread } from "#/libs/delete-thread.ts";

const token = process.env["DISCORD_BOT_TOKEN"] ?? "";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async (client) => {
	console.log(`${client.user.tag}が起動した😼`);
	await client.user.setActivity("😎", { type: ActivityType.Custom, state: "😎スレッドを監視中" });
});

// 止まっている間にアーカイブされたスレッドはThreadUpdateで拾えないので、起動時にまとめて戻す
const keep = async (client: Client) => {
	try {
		const guilds = await client.guilds.fetch();
		const result = await db
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
					const channel = await client.channels.fetch(id, { force: true });
					if (channel === null) {
						continue;
					}

					if (!channel.isSendable() || !channel.isThread()) {
						continue;
					}

					if (channel.archived === true || channel.autoArchiveDuration !== 10080) {
						await channel.edit({ archived: false, autoArchiveDuration: 10080 });
						console.log("生き延びて、" + channel.name + ":" + channel.id);
					}
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

client.on(Events.ThreadUpdate, async (oldThread, newThread) => {
	const isArchived = oldThread.archived !== true && newThread.archived === true;
	const isDurationChanged =
		oldThread.autoArchiveDuration !== newThread.autoArchiveDuration && newThread.autoArchiveDuration !== 10080;

	// アーカイブされたか、アーカイブまでの期間が変更されたときだけ処理する
	if (!isArchived && !isDurationChanged) {
		return;
	}

	// コマンドの処理
	try {
		const result = await db
			// prettier
			.selectFrom("threads")
			.select("id")
			.where("thread_id", "=", newThread.id)
			.where("guild_id", "=", newThread.guildId)
			.execute();

		if (result.length === 0) {
			return;
		}

		await newThread.edit({ archived: false, autoArchiveDuration: 10080 });

		if (isArchived) {
			console.log("生き延びて、" + newThread.name + ":" + newThread.id);
		} else {
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
		// 戻せなかったアーカイブ済みのスレッドには投稿も失敗しやすく、処理されない例外でBotが落ちるので、ログだけ残す
		if (isArchived) {
			console.error(e);
			return;
		}

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
