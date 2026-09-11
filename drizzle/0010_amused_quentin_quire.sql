CREATE TABLE `clinic_closure` (
	`id` int AUTO_INCREMENT NOT NULL,
	`branch_id` int,
	`name` varchar(100) NOT NULL,
	`starts_on` date NOT NULL,
	`ends_on` date NOT NULL,
	`ethiopian_month` tinyint,
	`ethiopian_day` tinyint,
	`note` varchar(255),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `clinic_closure_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `clinic_closure` ADD CONSTRAINT `clinic_closure_branch_id_branch_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branch`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `clinic_closure` ADD CONSTRAINT `clinic_closure_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `clinic_closure` ADD CONSTRAINT `clinic_closure_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `clinic_closure` ADD CONSTRAINT `clinic_closure_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `clinic_closure_range_idx` ON `clinic_closure` (`starts_on`,`ends_on`);--> statement-breakpoint
CREATE INDEX `clinic_closure_branch_idx` ON `clinic_closure` (`branch_id`);