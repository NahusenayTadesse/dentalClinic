CREATE TABLE `supply_batch` (
	`id` int AUTO_INCREMENT NOT NULL,
	`supply_id` int NOT NULL,
	`batch_number` varchar(60),
	`expiry_date` date,
	`quantity` decimal(10,2) NOT NULL DEFAULT 0,
	`received_quantity` decimal(10,2),
	`unit_cost` decimal(10,2),
	`supplier_id` int,
	`received_on` date,
	`status` enum('active','depleted','expired','quarantined','returned') NOT NULL DEFAULT 'active',
	`branch_id` int DEFAULT 1,
	`note` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `supply_batch_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `supplies` ADD `medicine_id` int;--> statement-breakpoint
ALTER TABLE `supplies` ADD `tracks_batches` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `supplies_adjustments` ADD `movement_type` enum('received','dispensed','consumed','damaged','expired','returned','transferred','correction') DEFAULT 'correction' NOT NULL;--> statement-breakpoint
ALTER TABLE `supplies_adjustments` ADD `batch_id` int;--> statement-breakpoint
ALTER TABLE `supplies_adjustments` ADD `patient_id` int;--> statement-breakpoint
ALTER TABLE `supplies_adjustments` ADD `prescription_id` int;--> statement-breakpoint
ALTER TABLE `invoice_line` ADD `supply_id` int;--> statement-breakpoint
ALTER TABLE `supply_batch` ADD CONSTRAINT `supply_batch_supply_id_supplies_id_fk` FOREIGN KEY (`supply_id`) REFERENCES `supplies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supply_batch` ADD CONSTRAINT `supply_batch_supplier_id_supply_suppliers_id_fk` FOREIGN KEY (`supplier_id`) REFERENCES `supply_suppliers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supply_batch` ADD CONSTRAINT `supply_batch_branch_id_branch_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branch`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supply_batch` ADD CONSTRAINT `supply_batch_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supply_batch` ADD CONSTRAINT `supply_batch_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supply_batch` ADD CONSTRAINT `supply_batch_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `supply_batch_expiry_idx` ON `supply_batch` (`expiry_date`,`status`);--> statement-breakpoint
CREATE INDEX `supply_batch_supply_idx` ON `supply_batch` (`supply_id`,`status`);--> statement-breakpoint
CREATE INDEX `supply_batch_number_idx` ON `supply_batch` (`batch_number`);--> statement-breakpoint
ALTER TABLE `supplies` ADD CONSTRAINT `supplies_medicine_id_medicine_id_fk` FOREIGN KEY (`medicine_id`) REFERENCES `medicine`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplies_adjustments` ADD CONSTRAINT `supplies_adjustments_batch_id_supply_batch_id_fk` FOREIGN KEY (`batch_id`) REFERENCES `supply_batch`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplies_adjustments` ADD CONSTRAINT `supplies_adjustments_patient_id_patient_id_fk` FOREIGN KEY (`patient_id`) REFERENCES `patient`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplies_adjustments` ADD CONSTRAINT `supplies_adjustments_prescription_id_prescription_id_fk` FOREIGN KEY (`prescription_id`) REFERENCES `prescription`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoice_line` ADD CONSTRAINT `invoice_line_supply_id_supplies_id_fk` FOREIGN KEY (`supply_id`) REFERENCES `supplies`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `invoice_line_supply_idx` ON `invoice_line` (`supply_id`);