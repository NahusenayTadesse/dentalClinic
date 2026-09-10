ALTER TABLE `employee` DROP FOREIGN KEY `employee_site_id_site_id_fk`;
--> statement-breakpoint
ALTER TABLE `salaries` DROP FOREIGN KEY `salaries_site_id_site_id_fk`;
--> statement-breakpoint
DROP TABLE `site_contacts`;
--> statement-breakpoint
DROP TABLE `site`;
--> statement-breakpoint
CREATE TABLE `branch` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`phone` varchar(20),
	`address` int,
	`opened_on` date,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `branch_id` PRIMARY KEY(`id`),
	CONSTRAINT `branch_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
INSERT INTO `branch` (`id`, `name`) VALUES (1, 'Main Branch');
--> statement-breakpoint
ALTER TABLE `payroll_runs` ADD `branch_id` int DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `transactions` ADD `branch_id` int DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `user` ADD `branch_id` int DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `supplies` ADD `branch_id` int DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `employee` ADD `branch_id` int DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `salaries` ADD `branch_id` int DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `branch` ADD CONSTRAINT `branch_address_address_id_fk` FOREIGN KEY (`address`) REFERENCES `address`(`id`) ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `branch` ADD CONSTRAINT `branch_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `branch` ADD CONSTRAINT `branch_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `branch` ADD CONSTRAINT `branch_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `payroll_runs` ADD CONSTRAINT `payroll_runs_branch_id_branch_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branch`(`id`) ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_branch_id_branch_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branch`(`id`) ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `user` ADD CONSTRAINT `user_branch_id_branch_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branch`(`id`) ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `supplies` ADD CONSTRAINT `supplies_branch_id_branch_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branch`(`id`) ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `employee` ADD CONSTRAINT `employee_branch_id_branch_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branch`(`id`) ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `salaries` ADD CONSTRAINT `salaries_branch_id_branch_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branch`(`id`) ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `employee` DROP COLUMN `site_id`;
--> statement-breakpoint
ALTER TABLE `salaries` DROP COLUMN `site_id`;
