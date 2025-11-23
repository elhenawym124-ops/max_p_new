-- Create homepage_templates table
CREATE TABLE IF NOT EXISTS `homepage_templates` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `content` LONGTEXT NOT NULL,
    `thumbnail` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `homepage_templates_companyId_idx`(`companyId`),
    INDEX `homepage_templates_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Add foreign key constraint
ALTER TABLE `homepage_templates` 
ADD CONSTRAINT `homepage_templates_companyId_fkey` 
FOREIGN KEY (`companyId`) 
REFERENCES `companies`(`id`) 
ON DELETE CASCADE 
ON UPDATE CASCADE;
