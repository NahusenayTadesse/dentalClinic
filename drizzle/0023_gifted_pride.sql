CREATE TABLE `patient_consent` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patient_id` int NOT NULL,
	`procedure_id` int,
	`consent_type` enum('treatment','surgical','anaesthetic','radiograph','photography','dataSharing') NOT NULL,
	`method` enum('written','verbal','electronic') NOT NULL DEFAULT 'written',
	`given_on` date NOT NULL,
	`given_by` varchar(150),
	`relationship` varchar(50),
	`witnessed_by` int,
	`document_file_id` int,
	`withdrawn_on` date,
	`withdrawn_reason` varchar(255),
	`note` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `patient_consent_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `referral_source` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(80) NOT NULL,
	`description` varchar(255),
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `referral_source_id` PRIMARY KEY(`id`),
	CONSTRAINT `referral_source_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `treatment_plan` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patient_id` int NOT NULL,
	`provider_id` int,
	`branch_id` int DEFAULT 1,
	`status` enum('draft','presented','accepted','partial','declined','expired','completed') NOT NULL DEFAULT 'draft',
	`presented_on` date,
	`decided_on` date,
	`decline_reason` varchar(255),
	`estimated_total` decimal(10,2),
	`valid_until` date,
	`note` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `treatment_plan_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `patient` ADD `referral_source_id` int;--> statement-breakpoint
ALTER TABLE `patient` ADD `referred_by` varchar(150);--> statement-breakpoint
ALTER TABLE `procedures` ADD `treatment_plan_id` int;--> statement-breakpoint
ALTER TABLE `patient_consent` ADD CONSTRAINT `patient_consent_patient_id_patient_id_fk` FOREIGN KEY (`patient_id`) REFERENCES `patient`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_consent` ADD CONSTRAINT `patient_consent_procedure_id_procedures_id_fk` FOREIGN KEY (`procedure_id`) REFERENCES `procedures`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_consent` ADD CONSTRAINT `patient_consent_witnessed_by_provider_id_fk` FOREIGN KEY (`witnessed_by`) REFERENCES `provider`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_consent` ADD CONSTRAINT `patient_consent_document_file_id_patient_file_id_fk` FOREIGN KEY (`document_file_id`) REFERENCES `patient_file`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_consent` ADD CONSTRAINT `patient_consent_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_consent` ADD CONSTRAINT `patient_consent_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_consent` ADD CONSTRAINT `patient_consent_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `referral_source` ADD CONSTRAINT `referral_source_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `referral_source` ADD CONSTRAINT `referral_source_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `referral_source` ADD CONSTRAINT `referral_source_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `treatment_plan` ADD CONSTRAINT `treatment_plan_patient_id_patient_id_fk` FOREIGN KEY (`patient_id`) REFERENCES `patient`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `treatment_plan` ADD CONSTRAINT `treatment_plan_provider_id_provider_id_fk` FOREIGN KEY (`provider_id`) REFERENCES `provider`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `treatment_plan` ADD CONSTRAINT `treatment_plan_branch_id_branch_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branch`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `treatment_plan` ADD CONSTRAINT `treatment_plan_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `treatment_plan` ADD CONSTRAINT `treatment_plan_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `treatment_plan` ADD CONSTRAINT `treatment_plan_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `patient_consent_patient_type_idx` ON `patient_consent` (`patient_id`,`consent_type`);--> statement-breakpoint
CREATE INDEX `patient_consent_procedure_idx` ON `patient_consent` (`procedure_id`);--> statement-breakpoint
CREATE INDEX `treatment_plan_status_idx` ON `treatment_plan` (`status`,`presented_on`);--> statement-breakpoint
CREATE INDEX `treatment_plan_patient_idx` ON `treatment_plan` (`patient_id`);--> statement-breakpoint
ALTER TABLE `patient` ADD CONSTRAINT `patient_referral_source_id_referral_source_id_fk` FOREIGN KEY (`referral_source_id`) REFERENCES `referral_source`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `procedures` ADD CONSTRAINT `procedures_treatment_plan_id_treatment_plan_id_fk` FOREIGN KEY (`treatment_plan_id`) REFERENCES `treatment_plan`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `procedure_plan_idx` ON `procedures` (`treatment_plan_id`);