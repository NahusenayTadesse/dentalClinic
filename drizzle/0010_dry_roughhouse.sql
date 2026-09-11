CREATE TABLE `patient_file` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patient_id` int NOT NULL,
	`appointment_id` int,
	`kind` enum('radiograph','photo','consent','referral','labResult','paperRecord','other') NOT NULL DEFAULT 'other',
	`stored_name` varchar(255) NOT NULL,
	`original_name` varchar(255),
	`mime_type` varchar(100),
	`size_bytes` int,
	`tooth_id` smallint,
	`taken_on` date,
	`description` varchar(255),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `patient_file_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clinical_note` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patient_id` int NOT NULL,
	`appointment_id` int,
	`provider_id` int,
	`kind` enum('examination','treatment','telephone','note') NOT NULL DEFAULT 'note',
	`summary` varchar(255),
	`body` text NOT NULL,
	`signed_at` datetime,
	`amends_id` int,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `clinical_note_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `medicine` (
	`id` int AUTO_INCREMENT NOT NULL,
	`generic_name` varchar(120) NOT NULL,
	`brand_name` varchar(120),
	`strength` varchar(50),
	`form` enum('tablet','capsule','syrup','suspension','injection','mouthwash','gel','cream','other') NOT NULL DEFAULT 'tablet',
	`is_antibiotic` boolean NOT NULL DEFAULT false,
	`is_on_eml` boolean NOT NULL DEFAULT true,
	`notes` varchar(255),
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `medicine_id` PRIMARY KEY(`id`),
	CONSTRAINT `medicine_generic_name_unique` UNIQUE(`generic_name`)
);
--> statement-breakpoint
CREATE TABLE `prescription` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patient_id` int NOT NULL,
	`provider_id` int,
	`appointment_id` int,
	`branch_id` int DEFAULT 1,
	`prescribed_on` date NOT NULL,
	`patient_weight_kg` decimal(5,2),
	`indication` varchar(255),
	`notes` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `prescription_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `prescription_item` (
	`id` int AUTO_INCREMENT NOT NULL,
	`prescription_id` int NOT NULL,
	`medicine_id` int NOT NULL,
	`dose` varchar(50),
	`frequency` varchar(80),
	`duration_days` int,
	`quantity` varchar(50),
	`instructions` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `prescription_item_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `patient_file` ADD CONSTRAINT `patient_file_patient_id_patient_id_fk` FOREIGN KEY (`patient_id`) REFERENCES `patient`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_file` ADD CONSTRAINT `patient_file_appointment_id_appointment_id_fk` FOREIGN KEY (`appointment_id`) REFERENCES `appointment`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_file` ADD CONSTRAINT `patient_file_tooth_id_tooth_id_fk` FOREIGN KEY (`tooth_id`) REFERENCES `tooth`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_file` ADD CONSTRAINT `patient_file_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_file` ADD CONSTRAINT `patient_file_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_file` ADD CONSTRAINT `patient_file_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `clinical_note` ADD CONSTRAINT `clinical_note_patient_id_patient_id_fk` FOREIGN KEY (`patient_id`) REFERENCES `patient`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `clinical_note` ADD CONSTRAINT `clinical_note_appointment_id_appointment_id_fk` FOREIGN KEY (`appointment_id`) REFERENCES `appointment`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `clinical_note` ADD CONSTRAINT `clinical_note_provider_id_provider_id_fk` FOREIGN KEY (`provider_id`) REFERENCES `provider`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `clinical_note` ADD CONSTRAINT `clinical_note_amends_id_clinical_note_id_fk` FOREIGN KEY (`amends_id`) REFERENCES `clinical_note`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `clinical_note` ADD CONSTRAINT `clinical_note_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `clinical_note` ADD CONSTRAINT `clinical_note_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `clinical_note` ADD CONSTRAINT `clinical_note_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `medicine` ADD CONSTRAINT `medicine_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `medicine` ADD CONSTRAINT `medicine_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `medicine` ADD CONSTRAINT `medicine_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `prescription` ADD CONSTRAINT `prescription_patient_id_patient_id_fk` FOREIGN KEY (`patient_id`) REFERENCES `patient`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `prescription` ADD CONSTRAINT `prescription_provider_id_provider_id_fk` FOREIGN KEY (`provider_id`) REFERENCES `provider`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `prescription` ADD CONSTRAINT `prescription_appointment_id_appointment_id_fk` FOREIGN KEY (`appointment_id`) REFERENCES `appointment`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `prescription` ADD CONSTRAINT `prescription_branch_id_branch_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branch`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `prescription` ADD CONSTRAINT `prescription_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `prescription` ADD CONSTRAINT `prescription_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `prescription` ADD CONSTRAINT `prescription_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `prescription_item` ADD CONSTRAINT `prescription_item_prescription_id_prescription_id_fk` FOREIGN KEY (`prescription_id`) REFERENCES `prescription`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `prescription_item` ADD CONSTRAINT `prescription_item_medicine_id_medicine_id_fk` FOREIGN KEY (`medicine_id`) REFERENCES `medicine`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `prescription_item` ADD CONSTRAINT `prescription_item_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `prescription_item` ADD CONSTRAINT `prescription_item_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `prescription_item` ADD CONSTRAINT `prescription_item_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `patient_file_patient_kind_idx` ON `patient_file` (`patient_id`,`kind`);--> statement-breakpoint
CREATE INDEX `patient_file_appointment_idx` ON `patient_file` (`appointment_id`);--> statement-breakpoint
CREATE INDEX `patient_file_tooth_idx` ON `patient_file` (`tooth_id`);--> statement-breakpoint
CREATE INDEX `patient_file_stored_name_idx` ON `patient_file` (`stored_name`);--> statement-breakpoint
CREATE INDEX `clinical_note_patient_idx` ON `clinical_note` (`patient_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `clinical_note_appointment_idx` ON `clinical_note` (`appointment_id`);--> statement-breakpoint
CREATE INDEX `clinical_note_provider_idx` ON `clinical_note` (`provider_id`);--> statement-breakpoint
CREATE INDEX `medicine_antibiotic_idx` ON `medicine` (`is_antibiotic`);--> statement-breakpoint
CREATE INDEX `prescription_patient_idx` ON `prescription` (`patient_id`,`prescribed_on`);--> statement-breakpoint
CREATE INDEX `prescription_provider_idx` ON `prescription` (`provider_id`,`prescribed_on`);--> statement-breakpoint
CREATE INDEX `prescription_appointment_idx` ON `prescription` (`appointment_id`);--> statement-breakpoint
CREATE INDEX `prescription_item_prescription_idx` ON `prescription_item` (`prescription_id`);--> statement-breakpoint
CREATE INDEX `prescription_item_medicine_idx` ON `prescription_item` (`medicine_id`);