-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_threads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guild_id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'ja',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_threads" ("created_at", "guild_id", "id", "thread_id") SELECT "created_at", "guild_id", "id", "thread_id" FROM "threads";
DROP TABLE "threads";
ALTER TABLE "new_threads" RENAME TO "threads";
CREATE UNIQUE INDEX "threads_guild_id_thread_id_key" ON "threads"("guild_id", "thread_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

