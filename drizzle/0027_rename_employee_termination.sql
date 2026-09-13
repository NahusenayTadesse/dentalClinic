-- The table was created as `empoloyee_termination`. RENAME TABLE keeps the old constraint and
-- index names, which drizzle derives from the table name, so each foreign key is rebuilt under
-- the new name; left alone, the next generate would try to drop and re-add all four.
RENAME TABLE `empoloyee_termination` TO `employee_termination`;
--> statement-breakpoint
ALTER TABLE `employee_termination` DROP FOREIGN KEY `empoloyee_termination_staff_id_employee_id_fk`;
--> statement-breakpoint
ALTER TABLE `employee_termination` DROP INDEX `empoloyee_termination_staff_id_employee_id_fk`;
--> statement-breakpoint
ALTER TABLE `employee_termination` ADD CONSTRAINT `employee_termination_staff_id_employee_id_fk` FOREIGN KEY (`staff_id`) REFERENCES `employee`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `employee_termination` DROP FOREIGN KEY `empoloyee_termination_created_by_user_id_fk`;
--> statement-breakpoint
ALTER TABLE `employee_termination` DROP INDEX `empoloyee_termination_created_by_user_id_fk`;
--> statement-breakpoint
ALTER TABLE `employee_termination` ADD CONSTRAINT `employee_termination_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `employee_termination` DROP FOREIGN KEY `empoloyee_termination_updated_by_user_id_fk`;
--> statement-breakpoint
ALTER TABLE `employee_termination` DROP INDEX `empoloyee_termination_updated_by_user_id_fk`;
--> statement-breakpoint
ALTER TABLE `employee_termination` ADD CONSTRAINT `employee_termination_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `employee_termination` DROP FOREIGN KEY `empoloyee_termination_deleted_by_user_id_fk`;
--> statement-breakpoint
ALTER TABLE `employee_termination` DROP INDEX `empoloyee_termination_deleted_by_user_id_fk`;
--> statement-breakpoint
ALTER TABLE `employee_termination` ADD CONSTRAINT `employee_termination_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;
