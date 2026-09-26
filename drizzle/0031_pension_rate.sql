-- The two pension contribution rates, one row per party, as percentages of basic salary.
-- Seeded at 7% employee / 11% employer by /setup (seedPensionRates) and by the dev seed.
CREATE TABLE `pension_rate` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`party` enum('employee','employer') NOT NULL,
	`rate` decimal(5,2) NOT NULL,
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `pension_rate_id` PRIMARY KEY(`id`),
	CONSTRAINT `pension_rate_party_unique` UNIQUE(`party`)
);
--> statement-breakpoint
ALTER TABLE `pension_rate` ADD CONSTRAINT `pension_rate_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;