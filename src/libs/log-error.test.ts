import { DiscordAPIError, HTTPError } from "discord.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { logError } from "#/libs/log-error.ts";

const body = { body: { data: { embeds: [{ description: "秘密のスレッド" }] } }, files: undefined };
const url = "https://discord.com/api/v10/interactions/1/secret-token/callback";
const maskedUrl = "https://discord.com/api/v10/interactions/1/***/callback";

describe("logError", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("DiscordのAPIのエラーは、送ろうとした返信の中身を出さない", () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});

		logError(new DiscordAPIError({ code: 50013, message: "Missing Permissions" }, 50013, 403, "POST", url, body));

		const output = JSON.stringify(error.mock.calls);
		expect(output).toContain("Missing Permissions");
		expect(output).toContain(`POST ${maskedUrl}（403）`);
		expect(output).not.toContain("秘密のスレッド");
		expect(output).not.toContain("secret-token");
	});

	it("返信の編集で使うWebhookのURLからも、tokenを隠す", () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const webhookUrl = "https://discord.com/api/v10/webhooks/1/secret-token/messages/@original";

		logError(new HTTPError(500, "Internal Server Error", "PATCH", webhookUrl, body));

		const output = JSON.stringify(error.mock.calls);
		expect(output).toContain("PATCH https://discord.com/api/v10/webhooks/1/***/messages/@original（500）");
		expect(output).not.toContain("secret-token");
	});

	it("tokenを含まないURLは、そのまま出す", () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const channelUrl = "https://discord.com/api/v10/channels/1";

		logError(new HTTPError(500, "Internal Server Error", "PATCH", channelUrl, body));

		expect(JSON.stringify(error.mock.calls)).toContain(`PATCH ${channelUrl}（500）`);
	});

	it("HTTPのエラーも、送ろうとした返信の中身を出さない", () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});

		logError(new HTTPError(500, "Internal Server Error", "POST", url, body));

		const output = JSON.stringify(error.mock.calls);
		expect(output).toContain(`POST ${maskedUrl}（500）`);
		expect(output).not.toContain("秘密のスレッド");
		expect(output).not.toContain("secret-token");
	});

	it("ほかのエラーは、そのまま出す", () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const e = new Error("database is locked");

		logError(e);

		expect(error).toHaveBeenCalledWith(e);
	});
});
