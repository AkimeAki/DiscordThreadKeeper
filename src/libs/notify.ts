// 導入状況を運営者が把握できるよう、運営者のDiscordサーバーのWebhookにも送る。URLを設定していなければ送らない
export const notify = async (content: string) => {
	const url = process.env["DISCORD_LOG_WEBHOOK_URL"];
	if (url === undefined || url === "") {
		return;
	}

	// 通知が届かなくてもBotの動作は続けたいので、失敗はログに残すだけにする
	try {
		const response = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ content, allowed_mentions: { parse: [] } })
		});
		if (!response.ok) {
			console.error(`Webhookへの送信に失敗しました: ${response.status}`);
		}
	} catch (e) {
		console.error(e);
	}
};
