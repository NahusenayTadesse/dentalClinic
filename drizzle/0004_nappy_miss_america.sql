CREATE TABLE `allergen` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(80) NOT NULL,
	`category` enum('medication','anaesthetic','material','food','environmental','other') NOT NULL DEFAULT 'other',
	`description` varchar(255),
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `allergen_id` PRIMARY KEY(`id`),
	CONSTRAINT `allergen_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `patient_allergies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patient_id` int NOT NULL,
	`allergen_id` int NOT NULL,
	`severity` enum('unknown','mild','moderate','severe') NOT NULL DEFAULT 'unknown',
	`reaction` varchar(255),
	`live_key` int GENERATED ALWAYS AS ((if(`deleted_at` is null, `allergen_id`, null))) VIRTUAL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `patient_allergies_id` PRIMARY KEY(`id`),
	CONSTRAINT `patient_allergies_live_unique` UNIQUE(`patient_id`,`live_key`)
);
--> statement-breakpoint
ALTER TABLE `branch` DROP FOREIGN KEY `branch_address_address_id_fk`;
--> statement-breakpoint
ALTER TABLE `branch` MODIFY COLUMN `address` varchar(255);--> statement-breakpoint
ALTER TABLE `allergen` ADD CONSTRAINT `allergen_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `allergen` ADD CONSTRAINT `allergen_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `allergen` ADD CONSTRAINT `allergen_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_allergies` ADD CONSTRAINT `patient_allergies_patient_id_patient_id_fk` FOREIGN KEY (`patient_id`) REFERENCES `patient`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_allergies` ADD CONSTRAINT `patient_allergies_allergen_id_allergen_id_fk` FOREIGN KEY (`allergen_id`) REFERENCES `allergen`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_allergies` ADD CONSTRAINT `patient_allergies_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_allergies` ADD CONSTRAINT `patient_allergies_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_allergies` ADD CONSTRAINT `patient_allergies_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `patient_allergies_allergen_idx` ON `patient_allergies` (`allergen_id`);--> statement-breakpoint
CREATE INDEX `patient_allergies_patient_idx` ON `patient_allergies` (`patient_id`);--> statement-breakpoint
ALTER TABLE `patient` DROP COLUMN `allergies`;