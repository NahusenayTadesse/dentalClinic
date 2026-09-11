CREATE TABLE `condition` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`hmis_code` varchar(16),
	`icd_code` varchar(16),
	`icd_version` enum('icd10','icd11'),
	`category` varchar(80),
	`is_dental_related` boolean NOT NULL DEFAULT false,
	`source` enum('seed','import','clinic') NOT NULL DEFAULT 'clinic',
	`external_id` varchar(64),
	`last_synced_at` datetime,
	`description` varchar(255),
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `condition_id` PRIMARY KEY(`id`),
	CONSTRAINT `condition_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `patient_conditions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patient_id` int NOT NULL,
	`condition_id` int NOT NULL,
	`status` enum('suspected','active','inRemission','resolved') NOT NULL DEFAULT 'active',
	`diagnosed_on` date,
	`resolved_on` date,
	`provider_id` int,
	`note` text,
	`live_key` int GENERATED ALWAYS AS ((if(`deleted_at` is null, `condition_id`, null))) VIRTUAL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `patient_conditions_id` PRIMARY KEY(`id`),
	CONSTRAINT `patient_conditions_live_unique` UNIQUE(`patient_id`,`live_key`)
);
--> statement-breakpoint
ALTER TABLE `condition` ADD CONSTRAINT `condition_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `condition` ADD CONSTRAINT `condition_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `condition` ADD CONSTRAINT `condition_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_conditions` ADD CONSTRAINT `patient_conditions_patient_id_patient_id_fk` FOREIGN KEY (`patient_id`) REFERENCES `patient`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_conditions` ADD CONSTRAINT `patient_conditions_condition_id_condition_id_fk` FOREIGN KEY (`condition_id`) REFERENCES `condition`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_conditions` ADD CONSTRAINT `patient_conditions_provider_id_provider_id_fk` FOREIGN KEY (`provider_id`) REFERENCES `provider`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_conditions` ADD CONSTRAINT `patient_conditions_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_conditions` ADD CONSTRAINT `patient_conditions_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_conditions` ADD CONSTRAINT `patient_conditions_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `condition_dental_idx` ON `condition` (`is_dental_related`,`sort_order`);--> statement-breakpoint
CREATE INDEX `condition_hmis_idx` ON `condition` (`hmis_code`);--> statement-breakpoint
CREATE INDEX `condition_external_idx` ON `condition` (`external_id`);--> statement-breakpoint
CREATE INDEX `patient_conditions_condition_idx` ON `patient_conditions` (`condition_id`,`status`);--> statement-breakpoint
CREATE INDEX `patient_conditions_patient_idx` ON `patient_conditions` (`patient_id`);