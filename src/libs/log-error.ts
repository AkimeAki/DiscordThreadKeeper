import { DiscordAPIError, HTTPError } from "discord.js";

// DiscordのAPIのエラーはrequestBodyに送ろうとした返信の中身を持ち、そのまま出すとスレッド名などがログに残るので、中身を除いて出す
export const logError = (e: unknown) => {
	if (e instanceof DiscordAPIError || e instanceof HTTPError) {
		console.error(`${e.method} ${e.url}（${e.status}）`, e.stack);
		return;
	}

	console.error(e);
};
