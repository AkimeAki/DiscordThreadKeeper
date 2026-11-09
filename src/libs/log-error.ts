import { DiscordAPIError, HTTPError } from "discord.js";

// DiscordのAPIのエラーはrequestBodyに送ろうとした返信の中身を持ち、そのまま出すとスレッド名などがログに残るので、中身を除いて出す
export const logError = (e: unknown) => {
	if (e instanceof DiscordAPIError || e instanceof HTTPError) {
		// 返信に使うURLにはInteractionのtokenが入り、有効な間はログを見た人がその返信を操作できるので隠す
		const url = e.url.replace(/\/(interactions|webhooks)\/(\d+)\/[^/?]+/, "/$1/$2/***");
		console.error(`${e.method} ${url}（${e.status}）`, e.stack);
		return;
	}

	console.error(e);
};
