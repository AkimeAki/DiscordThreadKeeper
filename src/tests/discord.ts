import type { AnyThreadChannel, CacheType, ChatInputCommandInteraction, Client } from "discord.js";
import { ChannelType, PermissionFlagsBits, PermissionsBitField } from "discord.js";
import { vi } from "vitest";

// discord.jsの本物のオブジェクトはGatewayにつながないと作れないので、処理が触るプロパティだけを持つ偽物を型に当てはめる

export const createThread = (thread: {
	id: string;
	guildId: string;
	name?: string;
	type?: ChannelType.PublicThread | ChannelType.PrivateThread;
	archived?: boolean;
	locked?: boolean;
	autoArchiveDuration?: number;
	// コマンドを実行した人がこのスレッドで持つ権限
	permissions?: bigint[];
}) => {
	const { permissions = [PermissionFlagsBits.ViewChannel], ...rest } = thread;

	return {
		name: "スレッド",
		type: ChannelType.PublicThread,
		archived: false,
		locked: false,
		autoArchiveDuration: 10080,
		...rest,
		isThread: () => true,
		isSendable: () => true,
		permissionsFor: () => new PermissionsBitField(permissions),
		edit: vi.fn(),
		send: vi.fn(),
		setAutoArchiveDuration: vi.fn()
	} as unknown as AnyThreadChannel;
};

export const createInteraction = (interaction: { channel: unknown; guild: unknown }) => {
	return {
		...interaction,
		member: {},
		inCachedGuild: () => interaction.guild !== null,
		reply: vi.fn()
	} as unknown as ChatInputCommandInteraction<CacheType>;
};

export const createGuild = (id: string, channels: Map<string, AnyThreadChannel | Error>) => {
	return {
		id,
		channels: { fetch: vi.fn(async (channelId: string) => findChannel(channels, channelId)) }
	};
};

export const createClient = (client: {
	guildIds: string[];
	// 障害で一時的に見えなくなっているサーバー
	unavailableGuildIds?: string[];
	// 接続直後に届くアクティブなスレッドとして、キャッシュに入っているもの
	cachedChannels?: AnyThreadChannel[];
	// APIに問い合わせたときに返るもの
	fetchedChannels?: Map<string, AnyThreadChannel | Error>;
}) => {
	const { guildIds, unavailableGuildIds = [], cachedChannels = [], fetchedChannels = new Map() } = client;
	const guilds = [
		...guildIds.map((id) => ({ id, available: true })),
		...unavailableGuildIds.map((id) => ({ id, available: false }))
	];

	return {
		guilds: { cache: new Map(guilds.map((guild) => [guild.id, guild])) },
		channels: {
			cache: new Map(cachedChannels.map((channel) => [channel.id, channel])),
			fetch: vi.fn(async (channelId: string) => findChannel(fetchedChannels, channelId))
		}
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
