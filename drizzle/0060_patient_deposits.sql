CREATE TABLE `patient_deposit` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patient_id` int NOT NULL,
	`transaction_id` int NOT NULL,
	`note` varchar(255),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `patient_deposit_id` PRIMARY KEY(`id`),
	CONSTRAINT `patient_deposit_transaction_unique` UNIQUE(`transaction_id`)
);
--> statement-breakpoint
ALTER TABLE `patient_deposit` ADD CONSTRAINT `patient_deposit_patient_id_patient_id_fk` FOREIGN KEY (`patient_id`) REFERENCES `patient`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_deposit` ADD CONSTRAINT `patient_deposit_transaction_id_transactions_id_fk` FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_deposit` ADD CONSTRAINT `patient_deposit_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_deposit` ADD CONSTRAINT `patient_deposit_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_deposit` ADD CONSTRAINT `patient_deposit_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `patient_deposit_patient_idx` ON `patient_deposit` (`patient_id`);