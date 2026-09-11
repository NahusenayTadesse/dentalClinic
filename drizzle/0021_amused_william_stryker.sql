CREATE TABLE `patient_access_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patient_id` int NOT NULL,
	`user_id` varchar(255),
	`record_type` enum('summary','allergies','conditions','medications','note','prescription','file','procedure') NOT NULL,
	`record_id` int,
	`action` enum('view','print','export') NOT NULL DEFAULT 'view',
	`ip_address` varchar(45),
	`branch_id` int,
	`viewed_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `patient_access_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sent_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`file_name` varchar(255) NOT NULL,
	`report_about` varchar(255),
	`sent_to` varchar(255),
	`sent_by` varchar(150),
	`sent_on` date NOT NULL,
	`note` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`deleted_at` datetime,
	CONSTRAINT `sent_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
DROP TABLE `reports`;--> statement-breakpoint
ALTER TABLE `patient_access_log` ADD CONSTRAINT `patient_access_log_patient_id_patient_id_fk` FOREIGN KEY (`patient_id`) REFERENCES `patient`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_access_log` ADD CONSTRAINT `patient_access_log_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `patient_access_patient_idx` ON `patient_access_log` (`patient_id`,`viewed_at`);--> statement-breakpoint
CREATE INDEX `patient_access_user_idx` ON `patient_access_log` (`user_id`,`viewed_at`);--> statement-breakpoint
CREATE INDEX `patient_access_action_idx` ON `patient_access_log` (`action`,`viewed_at`);