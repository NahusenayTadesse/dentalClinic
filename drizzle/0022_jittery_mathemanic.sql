ALTER TABLE `supplies_adjustments` DROP FOREIGN KEY `supplies_adjustments_transaction_id_transaction_supplies_id_fk`;
--> statement-breakpoint
ALTER TABLE `supplies_adjustments` ADD CONSTRAINT `supplies_adjustments_transaction_id_transactions_id_fk` FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `vat_and_withhold` ADD COLUMN `id` int AUTO_INCREMENT PRIMARY KEY FIRST;
--> statement-breakpoint
ALTER TABLE `backup` ADD COLUMN `id` int AUTO_INCREMENT PRIMARY KEY FIRST;
--> statement-breakpoint
ALTER TABLE `vat_and_withhold` MODIFY COLUMN `vat` decimal(10,2) NOT NULL;
--> statement-breakpoint
ALTER TABLE `vat_and_withhold` MODIFY COLUMN `with_hold` decimal(10,2) NOT NULL;
