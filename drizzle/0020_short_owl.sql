ALTER TABLE `transactions` ADD `approval_status` enum('pending','approved','rejected') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `requested_by` varchar(255);--> statement-breakpoint
ALTER TABLE `transactions` ADD `approved_by` varchar(255);--> statement-breakpoint
ALTER TABLE `transactions` ADD `approved_at` datetime;--> statement-breakpoint
ALTER TABLE `transactions` ADD `rejected_by` varchar(255);--> statement-breakpoint
ALTER TABLE `transactions` ADD `rejected_at` datetime;--> statement-breakpoint
ALTER TABLE `transactions` ADD `rejection_reason` varchar(255);--> statement-breakpoint
ALTER TABLE `transactions` ADD `approval_overridden` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `audit_log` ADD `branch_id` int;--> statement-breakpoint
ALTER TABLE `invoice` ADD `approval_status` enum('pending','approved','rejected') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoice` ADD `requested_by` varchar(255);--> statement-breakpoint
ALTER TABLE `invoice` ADD `approved_by` varchar(255);--> statement-breakpoint
ALTER TABLE `invoice` ADD `approved_at` datetime;--> statement-breakpoint
ALTER TABLE `invoice` ADD `rejected_by` varchar(255);--> statement-breakpoint
ALTER TABLE `invoice` ADD `rejected_at` datetime;--> statement-breakpoint
ALTER TABLE `invoice` ADD `rejection_reason` varchar(255);--> statement-breakpoint
ALTER TABLE `invoice` ADD `approval_overridden` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_requested_by_user_id_fk` FOREIGN KEY (`requested_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_approved_by_user_id_fk` FOREIGN KEY (`approved_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_rejected_by_user_id_fk` FOREIGN KEY (`rejected_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoice` ADD CONSTRAINT `invoice_requested_by_user_id_fk` FOREIGN KEY (`requested_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoice` ADD CONSTRAINT `invoice_approved_by_user_id_fk` FOREIGN KEY (`approved_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoice` ADD CONSTRAINT `invoice_rejected_by_user_id_fk` FOREIGN KEY (`rejected_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;