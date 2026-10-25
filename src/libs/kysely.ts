import Database from "better-sqlite3";
import { Kysely, SqliteDialect } from "kysely";
import * as path from "node:path";
import type { DB } from "#/db/types.ts";

// PrismaはDATABASE_URLの相対パスをprisma/からの位置として扱うので、同じファイルを開くようにそろえる
const file = path.resolve("prisma", (process.env["DATABASE_URL"] ?? "").replace(/^file:/, ""));

export const db = new Kysely<DB>({
	dialect: new SqliteDialect({ database: new Database(file) }),
	log: (event) => {
		if (event.level === "query" && process.env["DEVELOPMENT"] === "true") {
			console.log(event.query.sql);
			console.log(event.query.parameters);
		}
	}
});
