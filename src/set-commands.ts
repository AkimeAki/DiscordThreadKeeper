import { REST, Routes } from "discord.js";
import { registerThreadCommand } from "#/commands/register-thread.ts";
import { cancelThreadCommand } from "#/commands/cancel-thread.ts";
import { registeredThreadListCommand } from "#/commands/registered-thread-list.ts";

const token = process.env["DISCORD_BOT_TOKEN"] ?? "";
const applicationId = process.env["DISCORD_BOT_APPLICATION_ID"] ?? "";

const rest = new REST().setToken(token);

// Discordサーバーにコマンドを登録
try {
	console.log("コマンドを登録します");
	await rest.put(Routes.applicationCommands(applicationId), {
		body: [
			registerThreadCommand.data.toJSON(),
			registeredThreadListCommand.data.toJSON(),
			cancelThreadCommand.data.toJSON()
		]
	});
	const commandList = (await rest.get(Routes.applicationCommands(applicationId))) as unknown[];
	console.log("コマンドを登録しました");
	commandList.forEach((command) => {
		console.log(command);
	});
} catch (e) {
	console.error("コマンドの登録中にエラーが発生しました");
	console.error(e);
}
