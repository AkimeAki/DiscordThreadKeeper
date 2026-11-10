import type { Client } from "discord.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { commands, sendCommandsToBotList, syncCommands } from "#/libs/commands.ts";

describe("syncCommands", () => {
	it("今のコマンドの一覧を登録する", async () => {
		vi.spyOn(console, "log").mockImplementation(() => {});
		const set = vi.fn();
		const client = { application: { commands: { set } } } as unknown as Client<true>;

		await syncCommands(client);

		expect(set).toHaveBeenCalledWith(
			commands.map((command) => {
				return command.data.toJSON();
			})
		);
	});

	it("登録に失敗しても例外を投げず、ログに残す", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const set = vi.fn(async () => {
			throw new Error("network error");
		});
		const client = { application: { commands: { set } } } as unknown as Client<true>;

		await expect(syncCommands(client)).resolves.toBeUndefined();
		expect(error).toHaveBeenCalledOnce();
	});
});

describe("sendCommandsToBotList", () => {
	const client = { application: { id: "app" } } as unknown as Client<true>;

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
	});

	it("トークンを設定していなければ、何も送らない", async () => {
		vi.stubEnv("DISCORDBOTLIST_TOKEN", "");
		const fetch = vi.fn();
		vi.stubGlobal("fetch", fetch);

		await sendCommandsToBotList(client);

		expect(fetch).not.toHaveBeenCalled();
	});

	it("Discordに登録するものと同じ一覧を、BotのIDとトークンを付けて送る", async () => {
		vi.stubEnv("DISCORDBOTLIST_TOKEN", "token");
		const fetch = vi.fn(async () => new Response(null, { status: 200 }));
		vi.stubGlobal("fetch", fetch);
		vi.spyOn(console, "log").mockImplementation(() => {});

		await sendCommandsToBotList(client);

		expect(fetch).toHaveBeenCalledWith("https://discordbotlist.com/api/v1/bots/app/commands", {
			method: "POST",
			headers: { "Content-Type": "application/json", Authorization: "Bot token" },
			body: JSON.stringify(
				commands.map((command) => {
					return command.data.toJSON();
				})
			)
		});
	});

	it("送信に失敗しても例外を投げず、ログに残す", async () => {
		vi.stubEnv("DISCORDBOTLIST_TOKEN", "token");
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new Error("network error");
			})
		);
		const error = vi.spyOn(console, "error").mockImplementation(() => {});

		await expect(sendCommandsToBotList(client)).resolves.toBeUndefined();
		expect(error).toHaveBeenCalledOnce();
	});

	it("discordbotlist.comがエラーを返したら、ステータスをログに残す", async () => {
		vi.stubEnv("DISCORDBOTLIST_TOKEN", "token");
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(null, { status: 401 }))
		);
		const error = vi.spyOn(console, "error").mockImplementation(() => {});

		await sendCommandsToBotList(client);

		expect(error).toHaveBeenCalledWith("discordbotlist.comへのコマンドの送信に失敗しました: 401");
	});
});
