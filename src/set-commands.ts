import { REST, Routes } from "discord.js";
import * as dotenv from "dotenv";
import { registerThreadCommand } from "@/commands/register-thread.js";
import { cancelThreadCommand } from "@/commands/cancel-thread.js";
import { registeredThreadListCommand } from "@/commands/registered-thread-list.js";

dotenv.config();
const token = process.env.DISCORD_BOT_TOKEN ?? "";
const applicationId = process.env.DISCORD_BOT_APPLICATION_ID ?? "";

const rest = new REST().setToken(token);

// Discordサーバーにコマンドを登録
try {
	console.log("コマンドを登録します😺");
	await rest.put(Routes.applicationCommands(applicationId), {
		body: [
			registerThreadCommand.data.toJSON(),
			registeredThreadListCommand.data.toJSON(),
			cancelThreadCommand.data.toJSON()
		]
	});
	await rest.put(Routes.applicationGuildCommands(applicationId, "842465745697898517"), {
		body: [
			registerThreadCommand.data.toJSON(),
			registeredThreadListCommand.data.toJSON(),
			cancelThreadCommand.data.toJSON()
		]
	});
	const commandList = (await rest.get(Routes.applicationCommands(applicationId))) as unknown[];
	console.log("コマンドを登録しました😼");
	commandList.forEach((command) => {
		console.log(command);
	});
} catch (e) {
	console.error("コマンドの登録中にエラーが発生しました🙀");
	console.error(e);
}
