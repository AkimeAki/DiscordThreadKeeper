import { type APIApplicationCommand, ApplicationCommand, type Client, Collection } from "discord.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { commands, sendCommandsToBotList, syncCommands } from "#/libs/commands.ts";

// Discordが登録済みのコマンドとして返す形にする。比べるのはdiscord.jsの本物のApplicationCommandにする。
// 型定義ではコンストラクタが非公開だが、discord.js自身はこの形で作っているので型だけ合わせる
const RegisteredCommand = ApplicationCommand as unknown as new (
	client: Client,
	data: APIApplicationCommand
) => ApplicationCommand;

const createRegistered = (client: Client, command: object) => {
	// Discordは、登録したときに省いた項目も既定値で返す
	const data = { id: crypto.randomUUID(), application_id: "app", version: "1", type: 1, nsfw: false, ...command };
	return new RegisteredCommand(client, data as APIApplicationCommand);
};

const createClient = (registered: (client: Client) => ApplicationCommand[]) => {
	const set = vi.fn();
	const client = { application: { commands: { set } } } as unknown as Client<true>;
	const fetch = vi.fn(
		async () => new Collection(registered(client).map((command) => [command.id, command] as const))
	);
	Object.assign(client.application.commands, { fetch });

	return { client, set };
};

describe("syncCommands", () => {
	beforeEach(() => {
		vi.spyOn(console, "log").mockImplementation(() => {});
	});

	it("登録済みの内容と同じなら、登録し直さない", async () => {
		const { client, set } = createClient((client) => commands.map((command) => createRegistered(client, command)));

		await syncCommands(client);

		expect(set).not.toHaveBeenCalled();
	});

	it("登録済みのコマンドは、言語ごとの訳も含めて取得する", async () => {
		const { client } = createClient((client) => commands.map((command) => createRegistered(client, command)));

		await syncCommands(client);

		expect(client.application.commands.fetch).toHaveBeenCalledWith({ withLocalizations: true });
	});

	it("訳が登録されていなければ、登録し直す", async () => {
		const { client, set } = createClient((client) =>
			commands.map((command) => createRegistered(client, { ...command, description_localizations: null }))
		);

		await syncCommands(client);

		expect(set).toHaveBeenCalledWith(commands);
	});

	it("説明文などが変わっていたら、登録し直す", async () => {
		const { client, set } = createClient((client) =>
			commands.map((command) => createRegistered(client, { ...command, description: "古い説明文" }))
		);

		await syncCommands(client);

		expect(set).toHaveBeenCalledWith(commands);
	});

	it("登録されていないコマンドがあれば、登録し直す", async () => {
		const { client, set } = createClient((client) =>
			commands.slice(1).map((command) => createRegistered(client, command))
		);

		await syncCommands(client);

		expect(set).toHaveBeenCalledWith(commands);
	});

	it("今はないコマンドが登録されていたら、登録し直して消す", async () => {
		const { client, set } = createClient((client) => [
			...commands.map((command) => createRegistered(client, command)),
			createRegistered(client, { name: "old", description: "使わなくなったコマンド" })
		]);

		await syncCommands(client);

		expect(set).toHaveBeenCalledWith(commands);
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
			body: JSON.stringify(commands)
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
