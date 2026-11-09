import type { CacheType, ChatInputCommandInteraction } from "discord.js";
import { ChannelNotFoundError, GuildNotFoundError, NotThreadError } from "#/error.ts";

export const getThread = async (interaction: ChatInputCommandInteraction<CacheType>) => {
	if (interaction.guild === null) {
		throw new GuildNotFoundError();
	}

	// アーカイブ済みのスレッドは接続直後の一覧に含まれず、キャッシュにないとinteraction.channelがnullになる
	const channel = interaction.channel ?? (await interaction.client.channels.fetch(interaction.channelId));
	if (channel === null) {
		throw new ChannelNotFoundError();
	}

	if (!channel.isThread()) {
		throw new NotThreadError();
	}

	return { guildId: interaction.guild.id, thread: channel };
};
