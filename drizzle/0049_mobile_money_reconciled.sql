ALTER TABLE `transactions` ADD `reconciled_at` datetime;--> statement-breakpoint
ALTER TABLE `transactions` ADD `reconciled_by` varchar(255);--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_reconciled_by_user_id_fk` FOREIGN KEY (`reconciled_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;