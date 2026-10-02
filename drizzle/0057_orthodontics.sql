CREATE TABLE `ortho_case` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patient_id` int NOT NULL,
	`provider_id` int,
	`branch_id` int DEFAULT 1,
	`appliance` enum('fixedBoth','fixedUpper','fixedLower','removable','aligners','functional') NOT NULL,
	`started_on` date NOT NULL,
	`planned_months` int NOT NULL,
	`total_fee` decimal(12,2) NOT NULL,
	`deposit` decimal(12,2) NOT NULL DEFAULT 0,
	`instalments` int NOT NULL DEFAULT 0,
	`status` enum('active','retention','finished','discontinued') NOT NULL DEFAULT 'active',
	`ended_on` date,
	`notes` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `ortho_case_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ortho_instalment` (
	`id` int AUTO_INCREMENT NOT NULL,
	`case_id` int NOT NULL,
	`n` int NOT NULL,
	`due_on` date NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`invoice_id` int,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `ortho_instalment_id` PRIMARY KEY(`id`),
	CONSTRAINT `ortho_instalment_case_n_unique` UNIQUE(`case_id`,`n`)
);
--> statement-breakpoint
CREATE TABLE `ortho_visit` (
	`id` int AUTO_INCREMENT NOT NULL,
	`case_id` int NOT NULL,
	`appointment_id` int,
	`provider_id` int,
	`visited_on` date NOT NULL,
	`work` varchar(255) NOT NULL,
	`next_in_weeks` int,
	`note` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `ortho_visit_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `patient_access_log` MODIFY COLUMN `record_type` enum('summary','allergies','conditions','medications','note','prescription','file','procedure','treatmentPlan','invoice','consent','labCase','perio','ortho') NOT NULL;--> statement-breakpoint
ALTER TABLE `ortho_case` ADD CONSTRAINT `ortho_case_patient_id_patient_id_fk` FOREIGN KEY (`patient_id`) REFERENCES `patient`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ortho_case` ADD CONSTRAINT `ortho_case_provider_id_provider_id_fk` FOREIGN KEY (`provider_id`) REFERENCES `provider`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ortho_case` ADD CONSTRAINT `ortho_case_branch_id_branch_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branch`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ortho_case` ADD CONSTRAINT `ortho_case_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ortho_case` ADD CONSTRAINT `ortho_case_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ortho_case` ADD CONSTRAINT `ortho_case_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ortho_instalment` ADD CONSTRAINT `ortho_instalment_case_id_ortho_case_id_fk` FOREIGN KEY (`case_id`) REFERENCES `ortho_case`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ortho_instalment` ADD CONSTRAINT `ortho_instalment_invoice_id_invoice_id_fk` FOREIGN KEY (`invoice_id`) REFERENCES `invoice`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ortho_instalment` ADD CONSTRAINT `ortho_instalment_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ortho_instalment` ADD CONSTRAINT `ortho_instalment_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ortho_instalment` ADD CONSTRAINT `ortho_instalment_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ortho_visit` ADD CONSTRAINT `ortho_visit_case_id_ortho_case_id_fk` FOREIGN KEY (`case_id`) REFERENCES `ortho_case`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ortho_visit` ADD CONSTRAINT `ortho_visit_appointment_id_appointment_id_fk` FOREIGN KEY (`appointment_id`) REFERENCES `appointment`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ortho_visit` ADD CONSTRAINT `ortho_visit_provider_id_provider_id_fk` FOREIGN KEY (`provider_id`) REFERENCES `provider`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ortho_visit` ADD CONSTRAINT `ortho_visit_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ortho_visit` ADD CONSTRAINT `ortho_visit_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ortho_visit` ADD CONSTRAINT `ortho_visit_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ortho_case_patient_idx` ON `ortho_case` (`patient_id`);--> statement-breakpoint
CREATE INDEX `ortho_instalment_due_idx` ON `ortho_instalment` (`due_on`);--> statement-breakpoint
CREATE INDEX `ortho_visit_case_idx` ON `ortho_visit` (`case_id`,`visited_on`);