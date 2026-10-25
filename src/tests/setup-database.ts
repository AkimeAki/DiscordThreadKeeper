import Database from "better-sqlite3";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { beforeEach } from "vitest";

// テストファイルごとに空のDBを作る。テストがkysely.tsを読み込むより先に動くので、ここで接続先を差し替えられる
const file = path.join(mkdtempSync(path.join(tmpdir(), "thread-keeper-")), "test.db");
process.env["DATABASE_URL"] = `file:${file}`;

const database = new Database(file);

// 本番と同じスキーマにするため、Prismaのマイグレーションを古い順にそのまま流す
const migrations = readdirSync("prisma/migrations", { withFileTypes: true })
	.filter((entry) => entry.isDirectory())
	.map((entry) => entry.name)
	.sort();

for (const migration of migrations) {
	database.exec(readFileSync(path.join("prisma/migrations", migration, "migration.sql"), "utf8"));
}

beforeEach(() => {
	database.exec("DELETE FROM threads");
});
