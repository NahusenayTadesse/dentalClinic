CREATE TABLE `data_breach` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(150) NOT NULL,
	`discovered_on` date NOT NULL,
	`occurred_on` date,
	`severity` enum('low','medium','high') NOT NULL DEFAULT 'medium',
	`description` text NOT NULL,
	`people_affected` int,
	`actions` text,
	`reported_on` date,
	`notified_on` date,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `data_breach_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `patient_access_log` MODIFY COLUMN `record_type` enum('summary','allergies','conditions','medications','note','prescription','file','procedure','treatmentPlan','invoice','consent','labCase','perio','ortho','fullRecord') NOT NULL;--> statement-breakpoint
ALTER TABLE `clinic_settings` ADD `record_retention_years` int DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE `data_breach` ADD CONSTRAINT `data_breach_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `data_breach` ADD CONSTRAINT `data_breach_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `data_breach` ADD CONSTRAINT `data_breach_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;