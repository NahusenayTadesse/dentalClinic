CREATE TABLE `purchase_order` (
	`id` int AUTO_INCREMENT NOT NULL,
	`number` varchar(30),
	`supplier_id` int NOT NULL,
	`branch_id` int DEFAULT 1,
	`status` enum('draft','sent','partly','received','cancelled') NOT NULL DEFAULT 'draft',
	`ordered_on` date,
	`expected_on` date,
	`note` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `purchase_order_id` PRIMARY KEY(`id`),
	CONSTRAINT `purchase_order_number_unique` UNIQUE(`number`)
);
--> statement-breakpoint
CREATE TABLE `purchase_order_line` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`supply_id` int NOT NULL,
	`quantity` decimal(10,2) NOT NULL,
	`unit_cost` decimal(10,2),
	`received` decimal(10,2) NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `purchase_order_line_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `supplier_invoice` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`invoice_no` varchar(60) NOT NULL,
	`invoice_date` date NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`transaction_id` int,
	`note` varchar(255),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `supplier_invoice_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `supplies_adjustments` ADD `purchase_order_line_id` int;--> statement-breakpoint
ALTER TABLE `purchase_order` ADD CONSTRAINT `purchase_order_supplier_id_supply_suppliers_id_fk` FOREIGN KEY (`supplier_id`) REFERENCES `supply_suppliers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_order` ADD CONSTRAINT `purchase_order_branch_id_branch_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branch`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_order` ADD CONSTRAINT `purchase_order_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_order` ADD CONSTRAINT `purchase_order_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_order` ADD CONSTRAINT `purchase_order_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_order_line` ADD CONSTRAINT `purchase_order_line_order_id_purchase_order_id_fk` FOREIGN KEY (`order_id`) REFERENCES `purchase_order`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_order_line` ADD CONSTRAINT `purchase_order_line_supply_id_supplies_id_fk` FOREIGN KEY (`supply_id`) REFERENCES `supplies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_order_line` ADD CONSTRAINT `purchase_order_line_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_order_line` ADD CONSTRAINT `purchase_order_line_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_order_line` ADD CONSTRAINT `purchase_order_line_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplier_invoice` ADD CONSTRAINT `supplier_invoice_order_id_purchase_order_id_fk` FOREIGN KEY (`order_id`) REFERENCES `purchase_order`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplier_invoice` ADD CONSTRAINT `supplier_invoice_transaction_id_transactions_id_fk` FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplier_invoice` ADD CONSTRAINT `supplier_invoice_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplier_invoice` ADD CONSTRAINT `supplier_invoice_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplier_invoice` ADD CONSTRAINT `supplier_invoice_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `purchase_order_branch_status_idx` ON `purchase_order` (`branch_id`,`status`);--> statement-breakpoint
CREATE INDEX `purchase_order_line_order_idx` ON `purchase_order_line` (`order_id`);--> statement-breakpoint
CREATE INDEX `supplier_invoice_order_idx` ON `supplier_invoice` (`order_id`);