ALTER TABLE `damaged_supplies` MODIFY COLUMN `quantity` decimal(10,2) NOT NULL;--> statement-breakpoint
ALTER TABLE `supplies` MODIFY COLUMN `reorder_level` decimal(10,2);--> statement-breakpoint
ALTER TABLE `supplies_adjustments` MODIFY COLUMN `adjustment` decimal(10,2) NOT NULL;