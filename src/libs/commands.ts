import type { Client } from "discord.js";
import { cancelThreadCommand } from "#/commands/cancel-thread.ts";
import { helpCommand } from "#/commands/help.ts";
import { registerThreadCommand } from "#/commands/register-thread.ts";
import { registeredThreadListCommand } from "#/commands/registered-thread-list.ts";
import { logError } from "#/libs/log-error.ts";

export const commands = [registerThreadCommand, registeredThreadListCommand, cancelThreadCommand, helpCommand];

const commandData = commands.map((command) => {
	return command.data.toJSON();
});

// 動いているコードとDiscordに登録したコマンドがずれないよう、起動時に登録し直す。
// 一括の上書きで作成の日次上限に数えられるのは新しいコマンドだけなので、同じ内容なら毎回送ってもよい
export const syncCommands = async (client: Client<true>) => {
	try {
		await client.application.commands.set(commandData);
		console.log("コマンドを登録し直しました");
	} catch (e) {
		logError(e);
	}
};

// discordbotlist.comのBotのページにコマンドの一覧を出すため、Discordに登録するものと同じ一覧を送る。トークンを設定していなければ送らない
export const sendCommandsToBotList = async (client: Client<true>) => {
	const token = process.env["DISCORDBOTLIST_TOKEN"];
	if (token === undefined || token === "") {
		return;
	}

	// 一覧が届かなくてもBotの動作は続けたいので、失敗はログに残すだけにする
	try {
		const response = await fetch(`https://discordbotlist.com/api/v1/bots/${client.application.id}/commands`, {
			method: "POST",
			headers: { "Content-Type": "application/json", Authorization: `Bot ${token}` },
			body: JSON.stringify(commandData)
		});
		if (!response.ok) {
			console.error(`discordbotlist.comへのコマンドの送信に失敗しました: ${response.status}`);
			return;
		}

		console.log("discordbotlist.comにコマンドを送りました");
	} catch (e) {
		logError(e);
	}
};
