-- CreateTable
CREATE TABLE `threads` (
    `id` VARCHAR(191) NOT NULL,
    `guild_id` VARCHAR(191) NOT NULL,
    `thread_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `threads_guild_id_thread_id_key`(`guild_id`, `thread_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
