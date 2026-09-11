CREATE TABLE `contact_types` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`kind` enum('email','phone','username','url') NOT NULL DEFAULT 'username',
	`link_prefix` varchar(120),
	`description` varchar(255),
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `contact_types_id` PRIMARY KEY(`id`),
	CONSTRAINT `contact_types_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `patient_contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patient_id` int NOT NULL,
	`contact_type_id` int NOT NULL,
	`value` varchar(255) NOT NULL,
	`label` varchar(50),
	`is_primary` boolean NOT NULL DEFAULT false,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `patient_contacts_id` PRIMARY KEY(`id`),
	CONSTRAINT `patient_contacts_unique` UNIQUE(`patient_id`,`contact_type_id`,`value`)
);
--> statement-breakpoint
CREATE TABLE `patient_emergency_contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patient_id` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`relation` varchar(50),
	`phone` varchar(20) NOT NULL,
	`alt_phone` varchar(20),
	`is_primary` boolean NOT NULL DEFAULT false,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `patient_emergency_contacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `contact_types` ADD CONSTRAINT `contact_types_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `contact_types` ADD CONSTRAINT `contact_types_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `contact_types` ADD CONSTRAINT `contact_types_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_contacts` ADD CONSTRAINT `patient_contacts_patient_id_patient_id_fk` FOREIGN KEY (`patient_id`) REFERENCES `patient`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_contacts` ADD CONSTRAINT `patient_contacts_contact_type_id_contact_types_id_fk` FOREIGN KEY (`contact_type_id`) REFERENCES `contact_types`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_contacts` ADD CONSTRAINT `patient_contacts_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_contacts` ADD CONSTRAINT `patient_contacts_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_contacts` ADD CONSTRAINT `patient_contacts_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_emergency_contacts` ADD CONSTRAINT `patient_emergency_contacts_patient_id_patient_id_fk` FOREIGN KEY (`patient_id`) REFERENCES `patient`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_emergency_contacts` ADD CONSTRAINT `patient_emergency_contacts_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_emergency_contacts` ADD CONSTRAINT `patient_emergency_contacts_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_emergency_contacts` ADD CONSTRAINT `patient_emergency_contacts_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `patient_contacts_patient_idx` ON `patient_contacts` (`patient_id`);--> statement-breakpoint
CREATE INDEX `patient_emergency_patient_idx` ON `patient_emergency_contacts` (`patient_id`);--> statement-breakpoint
ALTER TABLE `patient` DROP COLUMN `emergency_name`;--> statement-breakpoint
ALTER TABLE `patient` DROP COLUMN `emergency_phone`;--> statement-breakpoint
ALTER TABLE `patient` DROP COLUMN `emergency_relation`;