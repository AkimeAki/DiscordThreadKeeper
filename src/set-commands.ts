import { REST, Routes } from "discord.js";
import { commands } from "#/libs/commands.ts";

const token = process.env["DISCORD_BOT_TOKEN"] ?? "";
const applicationId = process.env["DISCORD_BOT_APPLICATION_ID"] ?? "";

const rest = new REST().setToken(token);

// Botは起動時にコマンドを登録し直すので、ふだんは使わない。Botを起動せずに登録だけ試したいときに使う
try {
	console.log("コマンドを登録します");
	await rest.put(Routes.applicationCommands(applicationId), { body: commands });
	const commandList = (await rest.get(Routes.applicationCommands(applicationId))) as unknown[];
	console.log("コマンドを登録しました");
	commandList.forEach((command) => {
		console.log(command);
	});
} catch (e) {
	console.error("コマンドの登録中にエラーが発生しました");
	console.error(e);
}
