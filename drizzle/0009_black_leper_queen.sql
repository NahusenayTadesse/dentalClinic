CREATE TABLE `appointment_type` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(80) NOT NULL,
	`default_minutes` int NOT NULL DEFAULT 30,
	`recall_interval_months` int,
	`colour` varchar(7),
	`description` varchar(255),
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `appointment_type_id` PRIMARY KEY(`id`),
	CONSTRAINT `appointment_type_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `appointment_type_services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`appointment_type_id` int NOT NULL,
	`service_id` int NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `appointment_type_services_id` PRIMARY KEY(`id`),
	CONSTRAINT `appointment_type_service_unique` UNIQUE(`appointment_type_id`,`service_id`)
);
--> statement-breakpoint
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
CREATE TABLE `recall` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patient_id` int NOT NULL,
	`appointment_type_id` int,
	`branch_id` int DEFAULT 1,
	`due_on` date NOT NULL,
	`last_visit_on` date,
	`status` enum('due','booked','completed','declined','stopped') NOT NULL DEFAULT 'due',
	`scheduled_appointment_id` int,
	`last_contacted_at` datetime,
	`contact_attempts` int NOT NULL DEFAULT 0,
	`note` varchar(255),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `recall_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dental_lab` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`phone` varchar(20),
	`address` varchar(255),
	`contact_person` varchar(100),
	`typical_turnaround_days` int,
	`notes` varchar(255),
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `dental_lab_id` PRIMARY KEY(`id`),
	CONSTRAINT `dental_lab_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `lab_case` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patient_id` int NOT NULL,
	`lab_id` int NOT NULL,
	`procedure_id` int,
	`service_id` int,
	`provider_id` int,
	`branch_id` int DEFAULT 1,
	`tooth_id` smallint,
	`tooth_range` varchar(64),
	`shade` varchar(20),
	`status` enum('draft','sent','received','fitted','remake','cancelled') NOT NULL DEFAULT 'draft',
	`sent_on` date,
	`due_on` date,
	`received_on` date,
	`fitted_on` date,
	`lab_fee` decimal(10,2),
	`instructions` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `lab_case_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `appointment` ADD `appointment_type_id` int;--> statement-breakpoint
ALTER TABLE `appointment` ADD `confirmed_at` datetime;--> statement-breakpoint
ALTER TABLE `appointment` ADD `reminder_sent_at` datetime;--> statement-breakpoint
ALTER TABLE `appointment` ADD `cancelled_at` datetime;--> statement-breakpoint
ALTER TABLE `appointment` ADD `cancelled_by` varchar(255);--> statement-breakpoint
ALTER TABLE `appointment` ADD `is_asap` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `appointment` ADD `rebooked_from_id` int;--> statement-breakpoint
ALTER TABLE `appointment_type` ADD CONSTRAINT `appointment_type_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointment_type` ADD CONSTRAINT `appointment_type_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointment_type` ADD CONSTRAINT `appointment_type_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointment_type_services` ADD CONSTRAINT `appointment_type_services_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointment_type_services` ADD CONSTRAINT `appointment_type_services_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointment_type_services` ADD CONSTRAINT `appointment_type_services_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointment_type_services` ADD CONSTRAINT `appt_type_services_type_fk` FOREIGN KEY (`appointment_type_id`) REFERENCES `appointment_type`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointment_type_services` ADD CONSTRAINT `appt_type_services_service_fk` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE `recall` ADD CONSTRAINT `recall_patient_id_patient_id_fk` FOREIGN KEY (`patient_id`) REFERENCES `patient`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `recall` ADD CONSTRAINT `recall_appointment_type_id_appointment_type_id_fk` FOREIGN KEY (`appointment_type_id`) REFERENCES `appointment_type`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `recall` ADD CONSTRAINT `recall_branch_id_branch_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branch`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `recall` ADD CONSTRAINT `recall_scheduled_appointment_id_appointment_id_fk` FOREIGN KEY (`scheduled_appointment_id`) REFERENCES `appointment`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `recall` ADD CONSTRAINT `recall_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `recall` ADD CONSTRAINT `recall_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `recall` ADD CONSTRAINT `recall_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dental_lab` ADD CONSTRAINT `dental_lab_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dental_lab` ADD CONSTRAINT `dental_lab_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dental_lab` ADD CONSTRAINT `dental_lab_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lab_case` ADD CONSTRAINT `lab_case_patient_id_patient_id_fk` FOREIGN KEY (`patient_id`) REFERENCES `patient`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lab_case` ADD CONSTRAINT `lab_case_lab_id_dental_lab_id_fk` FOREIGN KEY (`lab_id`) REFERENCES `dental_lab`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lab_case` ADD CONSTRAINT `lab_case_procedure_id_procedures_id_fk` FOREIGN KEY (`procedure_id`) REFERENCES `procedures`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lab_case` ADD CONSTRAINT `lab_case_service_id_services_id_fk` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lab_case` ADD CONSTRAINT `lab_case_provider_id_provider_id_fk` FOREIGN KEY (`provider_id`) REFERENCES `provider`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lab_case` ADD CONSTRAINT `lab_case_branch_id_branch_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branch`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lab_case` ADD CONSTRAINT `lab_case_tooth_id_tooth_id_fk` FOREIGN KEY (`tooth_id`) REFERENCES `tooth`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lab_case` ADD CONSTRAINT `lab_case_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lab_case` ADD CONSTRAINT `lab_case_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lab_case` ADD CONSTRAINT `lab_case_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
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
CREATE INDEX `prescription_item_medicine_idx` ON `prescription_item` (`medicine_id`);--> statement-breakpoint
CREATE INDEX `recall_status_due_idx` ON `recall` (`status`,`due_on`);--> statement-breakpoint
CREATE INDEX `recall_patient_idx` ON `recall` (`patient_id`);--> statement-breakpoint
CREATE INDEX `recall_branch_due_idx` ON `recall` (`branch_id`,`due_on`);--> statement-breakpoint
CREATE INDEX `lab_case_status_due_idx` ON `lab_case` (`status`,`due_on`);--> statement-breakpoint
CREATE INDEX `lab_case_patient_idx` ON `lab_case` (`patient_id`);--> statement-breakpoint
CREATE INDEX `lab_case_lab_idx` ON `lab_case` (`lab_id`);--> statement-breakpoint
CREATE INDEX `lab_case_procedure_idx` ON `lab_case` (`procedure_id`);--> statement-breakpoint
ALTER TABLE `appointment` ADD CONSTRAINT `appointment_appointment_type_id_appointment_type_id_fk` FOREIGN KEY (`appointment_type_id`) REFERENCES `appointment_type`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointment` ADD CONSTRAINT `appointment_cancelled_by_user_id_fk` FOREIGN KEY (`cancelled_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointment` ADD CONSTRAINT `appointment_rebooked_from_id_appointment_id_fk` FOREIGN KEY (`rebooked_from_id`) REFERENCES `appointment`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `appointment_type_idx` ON `appointment` (`appointment_type_id`);--> statement-breakpoint
CREATE INDEX `appointment_asap_idx` ON `appointment` (`is_asap`,`starts_at`);