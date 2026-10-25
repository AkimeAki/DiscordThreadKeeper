import type { Guild } from "discord.js";
import { deleteGuildThreads } from "#/libs/delete-thread.ts";
import { notify } from "#/libs/notify.ts";

// Botを外したサーバーのデータは残さない。discord.jsは障害で一時的に見えなくなったサーバーをGuildUnavailableとして別に扱うので、ここでは本当に外れたときだけ消える
export const guildDelete = async (guild: Guild) => {
	try {
		await deleteGuildThreads(guild.id);
		const message = `サーバーから外れたので、登録を消しました: ${guild.id}（参加中: ${guild.client.guilds.cache.size}サーバー）`;
		console.log(message);
		await notify(message);
	} catch (e) {
		console.error(e);
	}
};
