CREATE TABLE `patient_package` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patient_id` int NOT NULL,
	`package_id` int NOT NULL,
	`invoice_id` int,
	`branch_id` int DEFAULT 1,
	`sold_on` date NOT NULL,
	`expires_on` date,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `patient_package_id` PRIMARY KEY(`id`),
	CONSTRAINT `patient_package_invoice_unique` UNIQUE(`invoice_id`)
);
--> statement-breakpoint
CREATE TABLE `treatment_package` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`kind` enum('prepaid','bundle') NOT NULL DEFAULT 'bundle',
	`price` decimal(12,2) NOT NULL,
	`valid_days` int,
	`description` varchar(255),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `treatment_package_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `treatment_package_item` (
	`id` int AUTO_INCREMENT NOT NULL,
	`package_id` int NOT NULL,
	`service_id` int NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `treatment_package_item_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `invoice_line` ADD `patient_package_id` int;--> statement-breakpoint
ALTER TABLE `invoice_line` ADD `bundle_package_id` int;--> statement-breakpoint
ALTER TABLE `patient_package` ADD CONSTRAINT `patient_package_patient_id_patient_id_fk` FOREIGN KEY (`patient_id`) REFERENCES `patient`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_package` ADD CONSTRAINT `patient_package_package_id_treatment_package_id_fk` FOREIGN KEY (`package_id`) REFERENCES `treatment_package`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_package` ADD CONSTRAINT `patient_package_invoice_id_invoice_id_fk` FOREIGN KEY (`invoice_id`) REFERENCES `invoice`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_package` ADD CONSTRAINT `patient_package_branch_id_branch_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branch`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_package` ADD CONSTRAINT `patient_package_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_package` ADD CONSTRAINT `patient_package_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_package` ADD CONSTRAINT `patient_package_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `treatment_package` ADD CONSTRAINT `treatment_package_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `treatment_package` ADD CONSTRAINT `treatment_package_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `treatment_package` ADD CONSTRAINT `treatment_package_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `treatment_package_item` ADD CONSTRAINT `treatment_package_item_package_id_treatment_package_id_fk` FOREIGN KEY (`package_id`) REFERENCES `treatment_package`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `treatment_package_item` ADD CONSTRAINT `treatment_package_item_service_id_services_id_fk` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `treatment_package_item` ADD CONSTRAINT `treatment_package_item_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `treatment_package_item` ADD CONSTRAINT `treatment_package_item_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `treatment_package_item` ADD CONSTRAINT `treatment_package_item_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `patient_package_patient_idx` ON `patient_package` (`patient_id`);--> statement-breakpoint
CREATE INDEX `treatment_package_item_package_idx` ON `treatment_package_item` (`package_id`);--> statement-breakpoint
CREATE INDEX `invoice_line_patient_package_idx` ON `invoice_line` (`patient_package_id`);