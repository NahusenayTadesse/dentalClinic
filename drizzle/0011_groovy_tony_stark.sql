ALTER TABLE `transactions` ADD `direction` enum('in','out') DEFAULT 'in' NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `patient_id` int;--> statement-breakpoint
ALTER TABLE `transactions` ADD `customer_id` int;--> statement-breakpoint
ALTER TABLE `transactions` ADD `occurred_on` date;--> statement-breakpoint
ALTER TABLE `transactions` ADD `subtotal` decimal(10,2);--> statement-breakpoint
ALTER TABLE `transactions` ADD `vat_amount` decimal(10,2);--> statement-breakpoint
ALTER TABLE `transactions` ADD `withholding_amount` decimal(10,2);--> statement-breakpoint
ALTER TABLE `transactions` ADD `receipt_number` varchar(50);--> statement-breakpoint
ALTER TABLE `transactions` ADD `fiscal_status` enum('notRequired','pending','cleared','failed') DEFAULT 'notRequired' NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `fiscal_reference` varchar(128);--> statement-breakpoint
ALTER TABLE `transactions` ADD `fiscal_qr` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `fiscal_cleared_at` datetime;--> statement-breakpoint
ALTER TABLE `transactions` ADD `gateway` varchar(50);--> statement-breakpoint
ALTER TABLE `transactions` ADD `gateway_txn_token` varchar(128);--> statement-breakpoint
ALTER TABLE `transactions` ADD `gateway_reference` varchar(128);--> statement-breakpoint
ALTER TABLE `transactions` ADD `gateway_status` varchar(50);--> statement-breakpoint
ALTER TABLE `transactions` ADD `reverses_transaction_id` int;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_gateway_txn_token_unique` UNIQUE(`gateway_txn_token`);--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_patient_id_patient_id_fk` FOREIGN KEY (`patient_id`) REFERENCES `patient`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_reverses_transaction_id_transactions_id_fk` FOREIGN KEY (`reverses_transaction_id`) REFERENCES `transactions`(`id`) ON DELETE set null ON UPDATE no action;