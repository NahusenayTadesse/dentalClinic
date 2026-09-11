CREATE TABLE `treatment_plan_item` (
	`id` int AUTO_INCREMENT NOT NULL,
	`treatment_plan_id` int NOT NULL,
	`procedure_id` int,
	`description` varchar(255) NOT NULL,
	`tooth_id` smallint,
	`quantity` decimal(10,2) NOT NULL DEFAULT 1,
	`unit_price` decimal(10,2) NOT NULL,
	`line_total` decimal(10,2) NOT NULL,
	`decision` enum('pending','accepted','declined') NOT NULL DEFAULT 'pending',
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `treatment_plan_item_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `procedures` DROP FOREIGN KEY `procedures_treatment_plan_id_treatment_plan_id_fk`;
--> statement-breakpoint
DROP INDEX `procedure_plan_idx` ON `procedures`;--> statement-breakpoint
ALTER TABLE `treatment_plan_item` ADD CONSTRAINT `treatment_plan_item_treatment_plan_id_treatment_plan_id_fk` FOREIGN KEY (`treatment_plan_id`) REFERENCES `treatment_plan`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `treatment_plan_item` ADD CONSTRAINT `treatment_plan_item_procedure_id_procedures_id_fk` FOREIGN KEY (`procedure_id`) REFERENCES `procedures`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `treatment_plan_item` ADD CONSTRAINT `treatment_plan_item_tooth_id_tooth_id_fk` FOREIGN KEY (`tooth_id`) REFERENCES `tooth`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `treatment_plan_item` ADD CONSTRAINT `treatment_plan_item_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `treatment_plan_item` ADD CONSTRAINT `treatment_plan_item_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `treatment_plan_item` ADD CONSTRAINT `treatment_plan_item_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `treatment_plan_item_plan_idx` ON `treatment_plan_item` (`treatment_plan_id`,`decision`);--> statement-breakpoint
CREATE INDEX `treatment_plan_item_procedure_idx` ON `treatment_plan_item` (`procedure_id`);--> statement-breakpoint
ALTER TABLE `treatment_plan` DROP COLUMN `estimated_total`;--> statement-breakpoint
ALTER TABLE `procedures` DROP COLUMN `treatment_plan_id`;