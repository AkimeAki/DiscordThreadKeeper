import type { AnyThreadChannel, CacheType, ChatInputCommandInteraction, Client } from "discord.js";
import { vi } from "vitest";

// discord.jsの本物のオブジェクトはGatewayにつながないと作れないので、処理が触るプロパティだけを持つ偽物を型に当てはめる

export const createThread = (thread: {
	id: string;
	guildId: string;
	name?: string;
	archived?: boolean;
	autoArchiveDuration?: number;
}) => {
	return {
		name: "スレッド",
		archived: false,
		autoArchiveDuration: 10080,
		...thread,
		isThread: () => true,
		isSendable: () => true,
		edit: vi.fn(),
		send: vi.fn(),
		setAutoArchiveDuration: vi.fn()
	} as unknown as AnyThreadChannel;
};

export const createInteraction = (interaction: { channel: unknown; guild: unknown }) => {
	return { ...interaction, reply: vi.fn() } as unknown as ChatInputCommandInteraction<CacheType>;
};

export const createGuild = (id: string, channels: Map<string, AnyThreadChannel | Error>) => {
	return {
		id,
		channels: { fetch: vi.fn(async (channelId: string) => findChannel(channels, channelId)) }
	};
};

export const createClient = (guildIds: string[], channels: Map<string, AnyThreadChannel | Error>) => {
	return {
		guilds: { fetch: vi.fn(async () => new Map(guildIds.map((id) => [id, { id }]))) },
		channels: { fetch: vi.fn(async (channelId: string) => findChannel(channels, channelId)) }
	} as unknown as Client;
};

// 本物と同じく、Discord APIのエラーはcodeを持つ例外として投げる
export const createDiscordError = (code: number) => {
	return Object.assign(new Error(`Discord API error ${code}`), { code });
};

const findChannel = (channels: Map<string, AnyThreadChannel | Error>, channelId: string) => {
	const channel = channels.get(channelId);
	if (channel instanceof Error) {
		throw channel;
	}

	return channel ?? null;
};
