import { REST, Routes } from "discord.js";
import * as dotenv from "dotenv";

dotenv.config();
const token = process.env.DISCORD_BOT_TOKEN ?? "";
const applicationId = process.env.DISCORD_BOT_APPLICATION_ID ?? "";

const rest = new REST().setToken(token);

// Discordサーバーからコマンドを削除
try {
	console.log("コマンドを削除します😺");
	await rest.put(Routes.applicationCommands(applicationId), {
		body: []
	});
	const commandList = (await rest.get(Routes.applicationCommands(applicationId))) as unknown[];
	console.log("コマンドを削除しました😼");
	commandList.forEach((command) => {
		console.log(command);
	});
} catch (e) {
	console.error("コマンドの削除中にエラーが発生しました🙀");
	console.error(e);
}
