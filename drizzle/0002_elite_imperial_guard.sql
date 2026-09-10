CREATE TABLE `patient` (
	`id` int AUTO_INCREMENT NOT NULL,
	`file_no` varchar(32),
	`name` varchar(50) NOT NULL,
	`father_name` varchar(50) NOT NULL,
	`grand_father_name` varchar(50),
	`sex` enum('male','female') NOT NULL,
	`birth_date` date,
	`birth_date_estimated` boolean NOT NULL DEFAULT false,
	`phone` varchar(20),
	`alt_phone` varchar(20),
	`blood_type` enum('A+','A-','B+','B-','AB+','AB-','O+','O-'),
	`allergies` text,
	`medical_notes` text,
	`history_taken_at` datetime,
	`history_taken_by` varchar(255),
	`emergency_name` varchar(100),
	`emergency_phone` varchar(20),
	`emergency_relation` varchar(50),
	`address` int,
	`photo` varchar(255),
	`customer_id` int,
	`branch_id` int DEFAULT 1,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `patient_id` PRIMARY KEY(`id`),
	CONSTRAINT `patient_file_no_unique` UNIQUE(`file_no`)
);
--> statement-breakpoint
ALTER TABLE `patient` ADD CONSTRAINT `patient_history_taken_by_user_id_fk` FOREIGN KEY (`history_taken_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient` ADD CONSTRAINT `patient_address_address_id_fk` FOREIGN KEY (`address`) REFERENCES `address`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient` ADD CONSTRAINT `patient_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient` ADD CONSTRAINT `patient_branch_id_branch_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branch`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient` ADD CONSTRAINT `patient_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient` ADD CONSTRAINT `patient_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient` ADD CONSTRAINT `patient_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `patient_phone_idx` ON `patient` (`phone`);--> statement-breakpoint
CREATE INDEX `patient_name_idx` ON `patient` (`name`,`father_name`);--> statement-breakpoint
CREATE INDEX `patient_branch_idx` ON `patient` (`branch_id`);