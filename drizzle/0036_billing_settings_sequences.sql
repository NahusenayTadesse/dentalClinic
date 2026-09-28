-- Billing groundwork: the clinic's settings row, numbered-document counters, and what kind of money
-- each payment method is (cash needs an open drawer).
CREATE TABLE `clinic_settings` (
	`id` int NOT NULL,
	`discount_approval_percent` decimal(5,2) NOT NULL DEFAULT 10,
	`updated_by` varchar(255),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	CONSTRAINT `clinic_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `document_sequence` (
	`name` varchar(40) NOT NULL,
	`next_value` int NOT NULL DEFAULT 1,
	CONSTRAINT `document_sequence_name` PRIMARY KEY(`name`)
);
--> statement-breakpoint
ALTER TABLE `payment_methods` ADD `kind` enum('cash','bank','mobile','card','other') DEFAULT 'bank' NOT NULL;--> statement-breakpoint
ALTER TABLE `clinic_settings` ADD CONSTRAINT `clinic_settings_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
INSERT INTO `clinic_settings` (`id`) VALUES (1);--> statement-breakpoint
-- A best guess from the names already typed; the admin panel is where a clinic corrects it.
UPDATE `payment_methods` SET `kind` = 'cash' WHERE LOWER(`name`) LIKE '%cash%';--> statement-breakpoint
UPDATE `payment_methods` SET `kind` = 'mobile' WHERE LOWER(`name`) LIKE '%telebirr%' OR LOWER(`name`) LIKE '%m-pesa%' OR LOWER(`name`) LIKE '%mpesa%' OR LOWER(`name`) LIKE '%cbe birr%';
