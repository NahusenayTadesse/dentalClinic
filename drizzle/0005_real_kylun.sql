CREATE TABLE `tooth` (
	`id` smallint NOT NULL,
	`name` varchar(50) NOT NULL,
	`quadrant` tinyint NOT NULL,
	`position` tinyint NOT NULL,
	`dentition` enum('permanent','primary') NOT NULL,
	`tooth_type` enum('incisor','canine','premolar','molar') NOT NULL,
	CONSTRAINT `tooth_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `appointment` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patient_id` int NOT NULL,
	`operatory_id` int,
	`provider_id` int,
	`assistant_id` int,
	`branch_id` int DEFAULT 1,
	`starts_at` datetime NOT NULL,
	`duration_minutes` int NOT NULL DEFAULT 30,
	`status` enum('scheduled','confirmed','arrived','inChair','completed','noShow','cancelled') NOT NULL DEFAULT 'scheduled',
	`cancel_reason` varchar(255),
	`note` varchar(500),
	`is_new_patient` boolean NOT NULL DEFAULT false,
	`arrived_at` datetime,
	`seated_at` datetime,
	`dismissed_at` datetime,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `appointment_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `operatory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`branch_id` int DEFAULT 1,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `operatory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `procedures` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patient_id` int NOT NULL,
	`appointment_id` int,
	`service_id` int NOT NULL,
	`provider_id` int,
	`branch_id` int DEFAULT 1,
	`status` enum('planned','completed','existing','referred','condition','cancelled') NOT NULL DEFAULT 'planned',
	`tooth_id` smallint,
	`surfaces` varchar(6),
	`tooth_range` varchar(64),
	`fee` decimal(10,2),
	`completed_on` date,
	`note` varchar(500),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `procedures_id` PRIMARY KEY(`id`),
	CONSTRAINT `procedure_surfaces_valid` CHECK(`procedures`.`surfaces` REGEXP '^[MODBLI]{1,6}$')
);
--> statement-breakpoint
ALTER TABLE `appointment` ADD CONSTRAINT `appointment_patient_id_patient_id_fk` FOREIGN KEY (`patient_id`) REFERENCES `patient`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointment` ADD CONSTRAINT `appointment_operatory_id_operatory_id_fk` FOREIGN KEY (`operatory_id`) REFERENCES `operatory`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointment` ADD CONSTRAINT `appointment_provider_id_employee_id_fk` FOREIGN KEY (`provider_id`) REFERENCES `employee`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointment` ADD CONSTRAINT `appointment_assistant_id_employee_id_fk` FOREIGN KEY (`assistant_id`) REFERENCES `employee`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointment` ADD CONSTRAINT `appointment_branch_id_branch_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branch`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointment` ADD CONSTRAINT `appointment_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointment` ADD CONSTRAINT `appointment_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointment` ADD CONSTRAINT `appointment_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `operatory` ADD CONSTRAINT `operatory_branch_id_branch_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branch`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `operatory` ADD CONSTRAINT `operatory_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `operatory` ADD CONSTRAINT `operatory_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `operatory` ADD CONSTRAINT `operatory_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `procedures` ADD CONSTRAINT `procedures_patient_id_patient_id_fk` FOREIGN KEY (`patient_id`) REFERENCES `patient`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `procedures` ADD CONSTRAINT `procedures_appointment_id_appointment_id_fk` FOREIGN KEY (`appointment_id`) REFERENCES `appointment`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `procedures` ADD CONSTRAINT `procedures_service_id_services_id_fk` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `procedures` ADD CONSTRAINT `procedures_provider_id_employee_id_fk` FOREIGN KEY (`provider_id`) REFERENCES `employee`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `procedures` ADD CONSTRAINT `procedures_branch_id_branch_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branch`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `procedures` ADD CONSTRAINT `procedures_tooth_id_tooth_id_fk` FOREIGN KEY (`tooth_id`) REFERENCES `tooth`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `procedures` ADD CONSTRAINT `procedures_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `procedures` ADD CONSTRAINT `procedures_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `procedures` ADD CONSTRAINT `procedures_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `appointment_operatory_start_idx` ON `appointment` (`operatory_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `appointment_branch_start_idx` ON `appointment` (`branch_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `appointment_patient_idx` ON `appointment` (`patient_id`);--> statement-breakpoint
CREATE INDEX `appointment_provider_start_idx` ON `appointment` (`provider_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `appointment_status_start_idx` ON `appointment` (`status`,`starts_at`);--> statement-breakpoint
CREATE INDEX `operatory_branch_idx` ON `operatory` (`branch_id`);--> statement-breakpoint
CREATE INDEX `procedure_patient_status_idx` ON `procedures` (`patient_id`,`status`);--> statement-breakpoint
CREATE INDEX `procedure_appointment_idx` ON `procedures` (`appointment_id`);--> statement-breakpoint
CREATE INDEX `procedure_tooth_idx` ON `procedures` (`tooth_id`);--> statement-breakpoint
CREATE INDEX `procedure_provider_completed_idx` ON `procedures` (`provider_id`,`completed_on`);--> statement-breakpoint
CREATE INDEX `procedure_branch_completed_idx` ON `procedures` (`branch_id`,`completed_on`);