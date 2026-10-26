import type { APIApplicationCommand, Client } from "discord.js";
import { cancelThreadCommand } from "#/commands/cancel-thread.ts";
import { helpCommand } from "#/commands/help.ts";
import { registerThreadCommand } from "#/commands/register-thread.ts";
import { registeredThreadListCommand } from "#/commands/registered-thread-list.ts";
import { logError } from "#/libs/log-error.ts";

export const commands = [
	registerThreadCommand.data.toJSON(),
	registeredThreadListCommand.data.toJSON(),
	cancelThreadCommand.data.toJSON(),
	helpCommand.data.toJSON()
];

// 動いているコードとDiscordに登録したコマンドがずれないよう、起動時に登録し直す。
// Discordはコマンドの登録に回数制限があるので、登録済みの内容と同じなら何もしない
export const syncCommands = async (client: Client<true>) => {
	try {
		// 指定しないとDiscordは言語ごとの訳を返さず、日本語の説明文がないものとして比べてしまう
		const registered = await client.application.commands.fetch({ withLocalizations: true });
		// equalsは登録するときのJSONもそのまま比べられるが、型定義がexactOptionalPropertyTypesを想定していないので型だけ合わせる。
		// equalsは値がundefinedでもキーがあれば比べるので、コマンドの定義ではsetNSFW(false)のように既定値も明示しておく。省くと毎回違うと判断される
		const isSame =
			registered.size === commands.length &&
			commands.every((command) =>
				registered.some((registeredCommand) =>
					registeredCommand.equals(command as unknown as APIApplicationCommand)
				)
			);

		if (isSame) {
			console.log("コマンドは登録済みの内容と同じです");
			return;
		}

		await client.application.commands.set(commands);
		console.log("コマンドを登録し直しました");
	} catch (e) {
		logError(e);
	}
};
