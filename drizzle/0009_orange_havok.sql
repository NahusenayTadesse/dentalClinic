CREATE TABLE `appointment_type` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(80) NOT NULL,
	`default_minutes` int NOT NULL DEFAULT 30,
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
ALTER TABLE `appointment_type_services` ADD CONSTRAINT `appointment_type_services_appointment_type_id_appointment_type_id_fk` FOREIGN KEY (`appointment_type_id`) REFERENCES `appointment_type`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointment_type_services` ADD CONSTRAINT `appointment_type_services_service_id_services_id_fk` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointment_type_services` ADD CONSTRAINT `appointment_type_services_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointment_type_services` ADD CONSTRAINT `appointment_type_services_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointment_type_services` ADD CONSTRAINT `appointment_type_services_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointment` ADD CONSTRAINT `appointment_appointment_type_id_appointment_type_id_fk` FOREIGN KEY (`appointment_type_id`) REFERENCES `appointment_type`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointment` ADD CONSTRAINT `appointment_cancelled_by_user_id_fk` FOREIGN KEY (`cancelled_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointment` ADD CONSTRAINT `appointment_rebooked_from_id_appointment_id_fk` FOREIGN KEY (`rebooked_from_id`) REFERENCES `appointment`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `appointment_type_idx` ON `appointment` (`appointment_type_id`);--> statement-breakpoint
CREATE INDEX `appointment_asap_idx` ON `appointment` (`is_asap`,`starts_at`);