CREATE TABLE `ledger_account` (
	`id` int AUTO_INCREMENT NOT NULL,
	`target` varchar(40) NOT NULL,
	`code` varchar(30) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `ledger_account_id` PRIMARY KEY(`id`),
	CONSTRAINT `ledger_account_target_unique` UNIQUE(`target`)
);
--> statement-breakpoint
ALTER TABLE `ledger_account` ADD CONSTRAINT `ledger_account_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ledger_account` ADD CONSTRAINT `ledger_account_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ledger_account` ADD CONSTRAINT `ledger_account_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;