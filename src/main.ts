import { ActivityType, Client, Events, GatewayIntentBits, MessageFlags } from "discord.js";
import * as dotenv from "dotenv";
import { registerThreadCommand } from "@/commands/register-thread.js";
import { cancelThreadCommand } from "@/commands/cancel-thread.js";
import { registeredThreadListCommand } from "@/commands/registered-thread-list.js";
import { db } from "@/libs/kysely.js";

dotenv.config();
const token = process.env.DISCORD_BOT_TOKEN ?? "";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async (client) => {
	console.log(`${client.user.tag}が起動した😼`);
	await client.user.setActivity("😎", { type: ActivityType.Custom, state: "😎スレッドを監視中" });
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
			console.error(`${interaction.commandName}というコマンドには対応していません`);
		}
	} catch (e) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		if (interaction.commandName === "register" && (e as any).code === "ER_DUP_ENTRY") {
			await interaction.reply({
				embeds: [
					{
						color: 0xf44458,
						author: {
							name: "このスレッドの寿命は既に伸ばされている",
							icon_url: "https://r2.aki.wtf/report.png"
						}
					}
				],
				ephemeral: true
			});
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} else if (interaction.commandName === "register" && (e as any).code === 50001) {
			await interaction.reply({
				embeds: [
					{
						color: 0xf44458,
						author: {
							name: "「スレッドを管理」権限が足らない",
							icon_url: "https://r2.aki.wtf/report.png"
						}
					}
				]
			});
		} else {
			console.error(e);
			await interaction.reply({
				embeds: [
					{
						color: 0xf44458,
						author: {
							name: "エラー発生🙀",
							icon_url: "https://r2.aki.wtf/error.png"
						}
					}
				],
				ephemeral: true
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
						description:
							"このスレッドの寿命は無期限に設定されています。アーカイブまでの時間を「1週間」以外に設定することはできません。",
						color: 0xf44458,
						author: {
							name: `このスレッドの「アーカイブされるまでの時間」は変更できない`,
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
						color: 0xf44458,
						author: {
							name: "「スレッドを管理」権限が足らない",
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
							name: "エラー発生😿",
							icon_url: "https://r2.aki.wtf/error.png"
						}
					}
				]
			});
		}
	}
});

client.on(Events.ThreadUpdate, async (_, newThread) => {
	// スレッドがアーカイブされた時だけ実行
	if (!newThread.archived) {
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
			await newThread.setArchived(false);
			console.log("生き延びよ、" + newThread.name + ":" + newThread.id);
		}
	} catch (e) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		if ((e as any).code === 50001) {
			await newThread.send({
				embeds: [
					{
						color: 0xf44458,
						author: {
							name: "「スレッドを管理」権限が足らない",
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
							name: "エラー発生😿",
							icon_url: "https://r2.aki.wtf/error.png"
						}
					}
				]
			});
		}
	}
});

void client.login(token);
