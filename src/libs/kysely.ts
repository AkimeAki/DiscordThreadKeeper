import { createPool } from "mysql2";
import { Kysely, MysqlDialect } from "kysely";
import * as dotenv from "dotenv";
import { DB } from "@/db/types.js";

dotenv.config();

export const db = () => {
	const connectionString = `${process.env.DATABASE_URL ?? ""}`;

	const dialect = new MysqlDialect({ pool: createPool(connectionString) });

	return new Kysely<DB>({
		dialect,
		log: (event) => {
			if (event.level === "query" && process.env.DEVELOPMENT === "true") {
				console.log(event.query.sql);
				console.log(event.query.parameters);
			}
		}
	});
};
