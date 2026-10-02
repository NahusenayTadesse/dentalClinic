CREATE TABLE `instrument_pack` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cycle_id` int NOT NULL,
	`code` varchar(30) NOT NULL,
	`contents` varchar(100),
	`expires_on` date NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `instrument_pack_id` PRIMARY KEY(`id`),
	CONSTRAINT `instrument_pack_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `pack_use` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pack_id` int NOT NULL,
	`patient_id` int NOT NULL,
	`appointment_id` int,
	`used_at` datetime NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `pack_use_id` PRIMARY KEY(`id`),
	CONSTRAINT `pack_use_pack_unique` UNIQUE(`pack_id`)
);
--> statement-breakpoint
CREATE TABLE `sterilisation_cycle` (
	`id` int AUTO_INCREMENT NOT NULL,
	`steriliser_id` int NOT NULL,
	`branch_id` int DEFAULT 1,
	`cycle_no` int NOT NULL,
	`kind` enum('load','bowieDick','vacuumTest') NOT NULL DEFAULT 'load',
	`ran_at` datetime NOT NULL,
	`program` varchar(60),
	`temperature_c` decimal(4,1),
	`hold_minutes` int,
	`chemical_indicator` enum('pass','fail','pending','none') NOT NULL DEFAULT 'none',
	`biological_indicator` enum('pass','fail','pending','none') NOT NULL DEFAULT 'none',
	`biological_read_at` datetime,
	`status` enum('passed','failed','pending') NOT NULL,
	`note` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `sterilisation_cycle_id` PRIMARY KEY(`id`),
	CONSTRAINT `sterilisation_cycle_number_unique` UNIQUE(`steriliser_id`,`cycle_no`)
);
--> statement-breakpoint
CREATE TABLE `steriliser` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`kind` enum('autoclaveB','autoclaveN','autoclaveS','dryHeat') NOT NULL DEFAULT 'autoclaveB',
	`serial_no` varchar(60),
	`branch_id` int DEFAULT 1,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `steriliser_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `instrument_pack` ADD CONSTRAINT `instrument_pack_cycle_id_sterilisation_cycle_id_fk` FOREIGN KEY (`cycle_id`) REFERENCES `sterilisation_cycle`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `instrument_pack` ADD CONSTRAINT `instrument_pack_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `instrument_pack` ADD CONSTRAINT `instrument_pack_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `instrument_pack` ADD CONSTRAINT `instrument_pack_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pack_use` ADD CONSTRAINT `pack_use_pack_id_instrument_pack_id_fk` FOREIGN KEY (`pack_id`) REFERENCES `instrument_pack`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pack_use` ADD CONSTRAINT `pack_use_patient_id_patient_id_fk` FOREIGN KEY (`patient_id`) REFERENCES `patient`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pack_use` ADD CONSTRAINT `pack_use_appointment_id_appointment_id_fk` FOREIGN KEY (`appointment_id`) REFERENCES `appointment`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pack_use` ADD CONSTRAINT `pack_use_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pack_use` ADD CONSTRAINT `pack_use_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pack_use` ADD CONSTRAINT `pack_use_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sterilisation_cycle` ADD CONSTRAINT `sterilisation_cycle_steriliser_id_steriliser_id_fk` FOREIGN KEY (`steriliser_id`) REFERENCES `steriliser`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sterilisation_cycle` ADD CONSTRAINT `sterilisation_cycle_branch_id_branch_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branch`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sterilisation_cycle` ADD CONSTRAINT `sterilisation_cycle_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sterilisation_cycle` ADD CONSTRAINT `sterilisation_cycle_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sterilisation_cycle` ADD CONSTRAINT `sterilisation_cycle_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `steriliser` ADD CONSTRAINT `steriliser_branch_id_branch_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branch`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `steriliser` ADD CONSTRAINT `steriliser_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `steriliser` ADD CONSTRAINT `steriliser_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `steriliser` ADD CONSTRAINT `steriliser_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `instrument_pack_cycle_idx` ON `instrument_pack` (`cycle_id`);--> statement-breakpoint
CREATE INDEX `pack_use_patient_idx` ON `pack_use` (`patient_id`);--> statement-breakpoint
CREATE INDEX `sterilisation_cycle_branch_ran_idx` ON `sterilisation_cycle` (`branch_id`,`ran_at`);