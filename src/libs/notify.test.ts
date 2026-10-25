import { afterEach, describe, expect, it, vi } from "vitest";
import { notify } from "#/libs/notify.ts";

describe("notify", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
	});

	it("WebhookのURLを設定していなければ、何も送らない", async () => {
		vi.stubEnv("DISCORD_LOG_WEBHOOK_URL", "");
		const fetch = vi.fn();
		vi.stubGlobal("fetch", fetch);

		await notify("起動しました");

		expect(fetch).not.toHaveBeenCalled();
	});

	it("設定したWebhookに、メンションを無効にして送る", async () => {
		vi.stubEnv("DISCORD_LOG_WEBHOOK_URL", "https://discord.com/api/webhooks/test");
		const fetch = vi.fn(async () => new Response(null, { status: 204 }));
		vi.stubGlobal("fetch", fetch);

		await notify("起動しました");

		expect(fetch).toHaveBeenCalledWith("https://discord.com/api/webhooks/test", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ content: "起動しました", allowed_mentions: { parse: [] } })
		});
	});

	it("送信に失敗しても例外を投げず、ログに残す", async () => {
		vi.stubEnv("DISCORD_LOG_WEBHOOK_URL", "https://discord.com/api/webhooks/test");
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new Error("network error");
			})
		);
		const error = vi.spyOn(console, "error").mockImplementation(() => {});

		await expect(notify("起動しました")).resolves.toBeUndefined();
		expect(error).toHaveBeenCalledOnce();
	});
});
