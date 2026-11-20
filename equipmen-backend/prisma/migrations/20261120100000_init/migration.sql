-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'STOREKEEPER', 'VIEWER') NOT NULL DEFAULT 'STOREKEEPER',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categories` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `categories_name_key`(`name`),
    UNIQUE INDEX `categories_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `locations` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `zone` VARCHAR(191) NULL,

    UNIQUE INDEX `locations_name_key`(`name`),
    UNIQUE INDEX `locations_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `equipment` (
    `id` VARCHAR(191) NOT NULL,
    `asset_tag` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `serial_number` VARCHAR(191) NULL,
    `manufacturer` VARCHAR(191) NULL,
    `model` VARCHAR(191) NULL,
    `condition` ENUM('New', 'Excellent', 'Good', 'Fair', 'Poor', 'Damaged') NOT NULL DEFAULT 'Good',
    `acquired_on` DATE NOT NULL,
    `notes` TEXT NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `category_id` VARCHAR(191) NOT NULL,
    `location_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `equipment_asset_tag_key`(`asset_tag`),
    UNIQUE INDEX `equipment_serial_number_key`(`serial_number`),
    INDEX `equipment_name_idx`(`name`),
    INDEX `equipment_category_id_idx`(`category_id`),
    INDEX `equipment_location_id_idx`(`location_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `checkouts` (
    `id` VARCHAR(191) NOT NULL,
    `ref` VARCHAR(191) NOT NULL,
    `equipment_id` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `issued_to` VARCHAR(191) NOT NULL,
    `issued_by` VARCHAR(191) NOT NULL,
    `issued_on` DATE NOT NULL,
    `expected_return` DATE NOT NULL,
    `condition_out` ENUM('New', 'Excellent', 'Good', 'Fair', 'Poor', 'Damaged') NOT NULL,
    `notes` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `checkouts_ref_key`(`ref`),
    INDEX `checkouts_equipment_id_issued_on_idx`(`equipment_id`, `issued_on`),
    INDEX `checkouts_issued_on_idx`(`issued_on`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `check_returns` (
    `id` VARCHAR(191) NOT NULL,
    `ref` VARCHAR(191) NOT NULL,
    `checkout_id` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `returned_on` DATE NOT NULL,
    `returned_by` VARCHAR(191) NOT NULL,
    `condition_in` ENUM('New', 'Excellent', 'Good', 'Fair', 'Poor', 'Damaged') NOT NULL,
    `damage_noted` BOOLEAN NOT NULL DEFAULT false,
    `notes` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `check_returns_ref_key`(`ref`),
    INDEX `check_returns_checkout_id_idx`(`checkout_id`),
    INDEX `check_returns_returned_on_idx`(`returned_on`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `maintenance_logs` (
    `id` VARCHAR(191) NOT NULL,
    `ref` VARCHAR(191) NOT NULL,
    `equipment_id` VARCHAR(191) NOT NULL,
    `type` ENUM('Inspection', 'Calibration', 'Repair', 'Service', 'GasRefill') NOT NULL,
    `status` ENUM('scheduled', 'in_progress', 'completed') NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `technician` VARCHAR(191) NOT NULL,
    `opened_on` DATE NOT NULL,
    `completed_on` DATE NULL,
    `notes` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `maintenance_logs_ref_key`(`ref`),
    INDEX `maintenance_logs_equipment_id_status_idx`(`equipment_id`, `status`),
    INDEX `maintenance_logs_opened_on_idx`(`opened_on`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activity_events` (
    `id` VARCHAR(191) NOT NULL,
    `at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actor_id` VARCHAR(191) NULL,
    `actor_name` VARCHAR(191) NOT NULL,
    `summary` TEXT NOT NULL,
    `equipment_id` VARCHAR(191) NULL,

    INDEX `activity_events_at_idx`(`at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `counters` (
    `name` VARCHAR(191) NOT NULL,
    `value` INTEGER NOT NULL,

    PRIMARY KEY (`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `equipment` ADD CONSTRAINT `equipment_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `equipment` ADD CONSTRAINT `equipment_location_id_fkey` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `checkouts` ADD CONSTRAINT `checkouts_equipment_id_fkey` FOREIGN KEY (`equipment_id`) REFERENCES `equipment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `check_returns` ADD CONSTRAINT `check_returns_checkout_id_fkey` FOREIGN KEY (`checkout_id`) REFERENCES `checkouts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_logs` ADD CONSTRAINT `maintenance_logs_equipment_id_fkey` FOREIGN KEY (`equipment_id`) REFERENCES `equipment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activity_events` ADD CONSTRAINT `activity_events_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

