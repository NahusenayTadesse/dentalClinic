CREATE TABLE `perio_exam` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patient_id` int NOT NULL,
	`provider_id` int,
	`appointment_id` int,
	`branch_id` int DEFAULT 1,
	`examined_on` date NOT NULL,
	`completed_at` datetime,
	`notes` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `perio_exam_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `perio_site` (
	`id` int AUTO_INCREMENT NOT NULL,
	`exam_id` int NOT NULL,
	`tooth_id` smallint NOT NULL,
	`site` enum('DB','B','MB','DL','L','ML') NOT NULL,
	`depth` tinyint,
	`recession` tinyint,
	`bleeding` boolean NOT NULL DEFAULT false,
	`plaque` boolean NOT NULL DEFAULT false,
	CONSTRAINT `perio_site_id` PRIMARY KEY(`id`),
	CONSTRAINT `perio_site_exam_tooth_site_unique` UNIQUE(`exam_id`,`tooth_id`,`site`)
);
--> statement-breakpoint
CREATE TABLE `perio_tooth` (
	`id` int AUTO_INCREMENT NOT NULL,
	`exam_id` int NOT NULL,
	`tooth_id` smallint NOT NULL,
	`missing` boolean NOT NULL DEFAULT false,
	`mobility` tinyint,
	`furcation` tinyint,
	CONSTRAINT `perio_tooth_id` PRIMARY KEY(`id`),
	CONSTRAINT `perio_tooth_exam_tooth_unique` UNIQUE(`exam_id`,`tooth_id`)
);
--> statement-breakpoint
ALTER TABLE `patient_access_log` MODIFY COLUMN `record_type` enum('summary','allergies','conditions','medications','note','prescription','file','procedure','treatmentPlan','invoice','consent','labCase','perio') NOT NULL;--> statement-breakpoint
ALTER TABLE `perio_exam` ADD CONSTRAINT `perio_exam_patient_id_patient_id_fk` FOREIGN KEY (`patient_id`) REFERENCES `patient`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `perio_exam` ADD CONSTRAINT `perio_exam_provider_id_provider_id_fk` FOREIGN KEY (`provider_id`) REFERENCES `provider`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `perio_exam` ADD CONSTRAINT `perio_exam_appointment_id_appointment_id_fk` FOREIGN KEY (`appointment_id`) REFERENCES `appointment`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `perio_exam` ADD CONSTRAINT `perio_exam_branch_id_branch_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branch`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `perio_exam` ADD CONSTRAINT `perio_exam_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `perio_exam` ADD CONSTRAINT `perio_exam_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `perio_exam` ADD CONSTRAINT `perio_exam_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `perio_site` ADD CONSTRAINT `perio_site_exam_id_perio_exam_id_fk` FOREIGN KEY (`exam_id`) REFERENCES `perio_exam`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `perio_site` ADD CONSTRAINT `perio_site_tooth_id_tooth_id_fk` FOREIGN KEY (`tooth_id`) REFERENCES `tooth`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `perio_tooth` ADD CONSTRAINT `perio_tooth_exam_id_perio_exam_id_fk` FOREIGN KEY (`exam_id`) REFERENCES `perio_exam`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `perio_tooth` ADD CONSTRAINT `perio_tooth_tooth_id_tooth_id_fk` FOREIGN KEY (`tooth_id`) REFERENCES `tooth`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `perio_exam_patient_idx` ON `perio_exam` (`patient_id`,`examined_on`);--> statement-breakpoint
CREATE INDEX `perio_exam_provider_idx` ON `perio_exam` (`provider_id`);