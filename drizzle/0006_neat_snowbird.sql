CREATE TABLE `provider` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employee_id` int NOT NULL,
	`specialty_id` int,
	`licence_number` varchar(64),
	`licence_issued_on` date,
	`licence_expires_on` date,
	`licence_body` varchar(100),
	`abbreviation` varchar(12),
	`colour` varchar(7),
	`is_bookable` boolean NOT NULL DEFAULT true,
	`default_appointment_minutes` int NOT NULL DEFAULT 30,
	`can_prescribe` boolean NOT NULL DEFAULT true,
	`schedule_note` varchar(255),
	`live_employee_key` int GENERATED ALWAYS AS ((if(`deleted_at` is null, `employee_id`, null))) VIRTUAL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `provider_id` PRIMARY KEY(`id`),
	CONSTRAINT `provider_live_employee_unique` UNIQUE(`live_employee_key`)
);
--> statement-breakpoint
CREATE TABLE `provider_specialty` (
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
	CONSTRAINT `provider_specialty_id` PRIMARY KEY(`id`),
	CONSTRAINT `provider_specialty_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
ALTER TABLE `appointment` DROP FOREIGN KEY `appointment_provider_id_employee_id_fk`;
--> statement-breakpoint
ALTER TABLE `procedures` DROP FOREIGN KEY `procedures_provider_id_employee_id_fk`;
--> statement-breakpoint
ALTER TABLE `provider` ADD CONSTRAINT `provider_employee_id_employee_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employee`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `provider` ADD CONSTRAINT `provider_specialty_id_provider_specialty_id_fk` FOREIGN KEY (`specialty_id`) REFERENCES `provider_specialty`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `provider` ADD CONSTRAINT `provider_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `provider` ADD CONSTRAINT `provider_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `provider` ADD CONSTRAINT `provider_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `provider_specialty` ADD CONSTRAINT `provider_specialty_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `provider_specialty` ADD CONSTRAINT `provider_specialty_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `provider_specialty` ADD CONSTRAINT `provider_specialty_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `provider_licence_expiry_idx` ON `provider` (`licence_expires_on`);--> statement-breakpoint
CREATE INDEX `provider_specialty_idx` ON `provider` (`specialty_id`);--> statement-breakpoint
ALTER TABLE `appointment` ADD CONSTRAINT `appointment_provider_id_provider_id_fk` FOREIGN KEY (`provider_id`) REFERENCES `provider`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `procedures` ADD CONSTRAINT `procedures_provider_id_provider_id_fk` FOREIGN KEY (`provider_id`) REFERENCES `provider`(`id`) ON DELETE set null ON UPDATE no action;