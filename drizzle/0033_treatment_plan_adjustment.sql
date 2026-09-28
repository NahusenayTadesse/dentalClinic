-- The change ledger for presented quotes: one row per change, never updated or deleted.
-- Foreign keys are NO ACTION on purpose, so a hard delete of a plan or line with history is refused.
CREATE TABLE `treatment_plan_adjustment` (
	`id` int AUTO_INCREMENT NOT NULL,
	`treatment_plan_id` int NOT NULL,
	`treatment_plan_item_id` int NOT NULL,
	`kind` enum('changed','added','removed') NOT NULL,
	`changes` json,
	`line_total_before` decimal(10,2) NOT NULL DEFAULT 0,
	`line_total_after` decimal(10,2) NOT NULL DEFAULT 0,
	`reason` varchar(255) NOT NULL,
	`after_answer` boolean NOT NULL DEFAULT false,
	`created_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `treatment_plan_adjustment_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `treatment_plan_adjustment` ADD CONSTRAINT `treatment_plan_adjustment_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `treatment_plan_adjustment` ADD CONSTRAINT `tp_adjustment_plan_fk` FOREIGN KEY (`treatment_plan_id`) REFERENCES `treatment_plan`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `treatment_plan_adjustment` ADD CONSTRAINT `tp_adjustment_item_fk` FOREIGN KEY (`treatment_plan_item_id`) REFERENCES `treatment_plan_item`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `treatment_plan_adjustment_plan_idx` ON `treatment_plan_adjustment` (`treatment_plan_id`,`id`);