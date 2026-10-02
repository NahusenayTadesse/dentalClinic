CREATE TABLE `payer_authorisation` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patient_id` int NOT NULL,
	`customer_id` int NOT NULL,
	`reference` varchar(100),
	`requested_amount` decimal(12,2),
	`approved_amount` decimal(12,2),
	`status` enum('requested','approved','declined') NOT NULL DEFAULT 'requested',
	`valid_until` date,
	`note` varchar(255),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `payer_authorisation_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `customers` ADD `coverage_percent` decimal(5,2) DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `annual_limit` decimal(12,2);--> statement-breakpoint
ALTER TABLE `customers` ADD `requires_preauth` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `patient` ADD `payer_member_no` varchar(50);--> statement-breakpoint
ALTER TABLE `invoice` ADD `co_payment` decimal(10,2);--> statement-breakpoint
ALTER TABLE `invoice` ADD `co_pay_of_invoice_id` int;--> statement-breakpoint
ALTER TABLE `invoice` ADD `authorisation_id` int;--> statement-breakpoint
ALTER TABLE `payer_authorisation` ADD CONSTRAINT `payer_authorisation_patient_id_patient_id_fk` FOREIGN KEY (`patient_id`) REFERENCES `patient`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payer_authorisation` ADD CONSTRAINT `payer_authorisation_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payer_authorisation` ADD CONSTRAINT `payer_authorisation_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payer_authorisation` ADD CONSTRAINT `payer_authorisation_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payer_authorisation` ADD CONSTRAINT `payer_authorisation_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoice` ADD CONSTRAINT `invoice_co_pay_of_invoice_id_invoice_id_fk` FOREIGN KEY (`co_pay_of_invoice_id`) REFERENCES `invoice`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoice` ADD CONSTRAINT `invoice_authorisation_id_payer_authorisation_id_fk` FOREIGN KEY (`authorisation_id`) REFERENCES `payer_authorisation`(`id`) ON DELETE set null ON UPDATE no action;