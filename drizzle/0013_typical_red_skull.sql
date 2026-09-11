CREATE TABLE `cash_session` (
	`id` int AUTO_INCREMENT NOT NULL,
	`branch_id` int DEFAULT 1,
	`opening_float` decimal(10,2) NOT NULL DEFAULT 0,
	`opened_at` datetime NOT NULL,
	`opened_by` varchar(255),
	`closed_at` datetime,
	`closed_by` varchar(255),
	`counted_amount` decimal(10,2),
	`expected_amount` decimal(10,2),
	`banked_amount` decimal(10,2),
	`status` enum('open','closed') NOT NULL DEFAULT 'open',
	`note` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `cash_session_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `expenses` ADD `supplier_id` int;--> statement-breakpoint
ALTER TABLE `expenses` ADD `payee_name` varchar(150);--> statement-breakpoint
ALTER TABLE `expenses` ADD `vendor_reference` varchar(100);--> statement-breakpoint
ALTER TABLE `transactions` ADD `cash_session_id` int;--> statement-breakpoint
ALTER TABLE `invoice` ADD `appointment_id` int;--> statement-breakpoint
ALTER TABLE `cash_session` ADD CONSTRAINT `cash_session_branch_id_branch_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branch`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cash_session` ADD CONSTRAINT `cash_session_opened_by_user_id_fk` FOREIGN KEY (`opened_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cash_session` ADD CONSTRAINT `cash_session_closed_by_user_id_fk` FOREIGN KEY (`closed_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cash_session` ADD CONSTRAINT `cash_session_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cash_session` ADD CONSTRAINT `cash_session_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cash_session` ADD CONSTRAINT `cash_session_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `cash_session_branch_status_idx` ON `cash_session` (`branch_id`,`status`);--> statement-breakpoint
CREATE INDEX `cash_session_opened_idx` ON `cash_session` (`opened_at`);--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_supplier_id_supply_suppliers_id_fk` FOREIGN KEY (`supplier_id`) REFERENCES `supply_suppliers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_cash_session_id_cash_session_id_fk` FOREIGN KEY (`cash_session_id`) REFERENCES `cash_session`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoice` ADD CONSTRAINT `invoice_appointment_id_appointment_id_fk` FOREIGN KEY (`appointment_id`) REFERENCES `appointment`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `invoice_appointment_idx` ON `invoice` (`appointment_id`);