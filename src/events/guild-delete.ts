import type { Guild } from "discord.js";
import { deleteGuildThreads } from "#/libs/delete-thread.ts";

// Botを外したサーバーのデータは残さない。discord.jsは障害で一時的に見えなくなったサーバーをGuildUnavailableとして別に扱うので、ここでは本当に外れたときだけ消える
export const guildDelete = async (guild: Guild) => {
	try {
		await deleteGuildThreads(guild.id);
		console.log(`サーバーから外れたので、登録を消しました: ${guild.id}`);
	} catch (e) {
		console.error(e);
	}
};
