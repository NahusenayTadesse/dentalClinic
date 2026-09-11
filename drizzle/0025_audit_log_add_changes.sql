ALTER TABLE `audit_log` MODIFY COLUMN `action` varchar(20) NOT NULL;--> statement-breakpoint
ALTER TABLE `audit_log` MODIFY COLUMN `record_id` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `audit_log` ADD `changes` json;--> statement-breakpoint
CREATE INDEX `audit_log_record_idx` ON `audit_log` (`table_name`,`record_id`,`id`);