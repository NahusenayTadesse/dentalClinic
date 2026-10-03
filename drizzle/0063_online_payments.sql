CREATE TABLE `online_payment` (
	`id` int AUTO_INCREMENT NOT NULL,
	`gateway_id` int NOT NULL,
	`provider` enum('chapa','telebirr','arifpay','santimpay') NOT NULL,
	`reference` varchar(40) NOT NULL,
	`patient_id` int NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`allocations` json NOT NULL,
	`phone` varchar(20),
	`status` enum('pending','paid','failed','cancelled') NOT NULL DEFAULT 'pending',
	`checkout_url` varchar(1024),
	`session_id` varchar(128),
	`provider_reference` varchar(128),
	`provider_status` varchar(50),
	`transaction_id` int,
	`error` varchar(255),
	`checked_at` datetime,
	`paid_at` datetime,
	`branch_id` int DEFAULT 1,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `online_payment_id` PRIMARY KEY(`id`),
	CONSTRAINT `online_payment_reference_unique` UNIQUE(`reference`)
);
--> statement-breakpoint
CREATE TABLE `payment_gateway` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` enum('chapa','telebirr','arifpay','santimpay') NOT NULL,
	`label` varchar(80) NOT NULL,
	`mode` enum('test','live') NOT NULL DEFAULT 'test',
	`secrets_encrypted` text NOT NULL,
	`secret_hint` varchar(8) NOT NULL,
	`settings` json NOT NULL,
	`payment_method_id` int NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `payment_gateway_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `sms_message` MODIFY COLUMN `kind` enum('reminder','recall','test','payment') NOT NULL;--> statement-breakpoint
ALTER TABLE `online_payment` ADD CONSTRAINT `online_payment_gateway_id_payment_gateway_id_fk` FOREIGN KEY (`gateway_id`) REFERENCES `payment_gateway`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `online_payment` ADD CONSTRAINT `online_payment_patient_id_patient_id_fk` FOREIGN KEY (`patient_id`) REFERENCES `patient`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `online_payment` ADD CONSTRAINT `online_payment_transaction_id_transactions_id_fk` FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `online_payment` ADD CONSTRAINT `online_payment_branch_id_branch_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branch`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `online_payment` ADD CONSTRAINT `online_payment_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `online_payment` ADD CONSTRAINT `online_payment_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `online_payment` ADD CONSTRAINT `online_payment_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_gateway` ADD CONSTRAINT `payment_gateway_payment_method_id_payment_methods_id_fk` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_gateway` ADD CONSTRAINT `payment_gateway_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_gateway` ADD CONSTRAINT `payment_gateway_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_gateway` ADD CONSTRAINT `payment_gateway_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `online_payment_patient_idx` ON `online_payment` (`patient_id`);--> statement-breakpoint
CREATE INDEX `online_payment_status_idx` ON `online_payment` (`status`);