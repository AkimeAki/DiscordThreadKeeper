import { DiscordAPIError, HTTPError } from "discord.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { logError } from "#/libs/log-error.ts";

const body = { body: { data: { embeds: [{ description: "秘密のスレッド" }] } }, files: undefined };
const url = "https://discord.com/api/v10/interactions/1/token/callback";

describe("logError", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("DiscordのAPIのエラーは、送ろうとした返信の中身を出さない", () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});

		logError(new DiscordAPIError({ code: 50013, message: "Missing Permissions" }, 50013, 403, "POST", url, body));

		const output = JSON.stringify(error.mock.calls);
		expect(output).toContain("Missing Permissions");
		expect(output).toContain(`POST ${url}（403）`);
		expect(output).not.toContain("秘密のスレッド");
	});

	it("HTTPのエラーも、送ろうとした返信の中身を出さない", () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});

		logError(new HTTPError(500, "Internal Server Error", "POST", url, body));

		const output = JSON.stringify(error.mock.calls);
		expect(output).toContain(`POST ${url}（500）`);
		expect(output).not.toContain("秘密のスレッド");
	});

	it("ほかのエラーは、そのまま出す", () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const e = new Error("database is locked");

		logError(e);

		expect(error).toHaveBeenCalledWith(e);
	});
});
