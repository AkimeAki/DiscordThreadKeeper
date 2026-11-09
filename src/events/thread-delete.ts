import type { AnyThreadChannel } from "discord.js";
import { deleteThread } from "#/libs/delete-thread.ts";

// 登録の上限は行数で数えるので、消されたスレッドの分は次の確認を待たずに空ける
export const threadDelete = async (thread: AnyThreadChannel) => {
	await deleteThread(thread.guildId, thread.id);
};
