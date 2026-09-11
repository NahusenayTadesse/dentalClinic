CREATE TABLE `patient_medications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patient_id` int NOT NULL,
	`medicine_id` int,
	`name_as_reported` varchar(160) NOT NULL,
	`dose` varchar(50),
	`frequency` varchar(80),
	`status` enum('active','stopped','unknown') NOT NULL DEFAULT 'active',
	`started_on` date,
	`stopped_on` date,
	`provider_id` int,
	`note` text,
	`live_key` int GENERATED ALWAYS AS ((if(`deleted_at` is null, `medicine_id`, null))) VIRTUAL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `patient_medications_id` PRIMARY KEY(`id`),
	CONSTRAINT `patient_medications_live_unique` UNIQUE(`patient_id`,`live_key`)
);
--> statement-breakpoint
ALTER TABLE `medicine` ADD `is_prescribable` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `medicine` ADD `bleeding_risk` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `medicine` ADD `osteonecrosis_risk` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `medicine` ADD `immunosuppression` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `patient_medications` ADD CONSTRAINT `patient_medications_patient_id_patient_id_fk` FOREIGN KEY (`patient_id`) REFERENCES `patient`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_medications` ADD CONSTRAINT `patient_medications_medicine_id_medicine_id_fk` FOREIGN KEY (`medicine_id`) REFERENCES `medicine`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_medications` ADD CONSTRAINT `patient_medications_provider_id_provider_id_fk` FOREIGN KEY (`provider_id`) REFERENCES `provider`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_medications` ADD CONSTRAINT `patient_medications_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_medications` ADD CONSTRAINT `patient_medications_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_medications` ADD CONSTRAINT `patient_medications_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `patient_medications_patient_idx` ON `patient_medications` (`patient_id`,`status`);--> statement-breakpoint
CREATE INDEX `patient_medications_medicine_idx` ON `patient_medications` (`medicine_id`);--> statement-breakpoint
CREATE INDEX `medicine_prescribable_idx` ON `medicine` (`is_prescribable`,`sort_order`);