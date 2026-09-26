-- Two ERP leftovers with no reader or writer anywhere: `staff_services` (which services an
-- *employee* offered, superseded by providers) and `sent_reports`. The database is local-only, so
-- they are dropped rather than carried.
--
-- `services` gains the two things a dental catalogue needs: a standard `price` a procedure's fee
-- starts from (nullable: some work is quoted case by case), and `area`, which decides whether the
-- chart asks for a tooth, its surfaces, a span of teeth or nothing.
DROP TABLE `staff_services`;--> statement-breakpoint
DROP TABLE `sent_reports`;--> statement-breakpoint
ALTER TABLE `services` MODIFY COLUMN `name` varchar(120) NOT NULL;--> statement-breakpoint
ALTER TABLE `services` ADD `price` decimal(10,2);--> statement-breakpoint
ALTER TABLE `services` ADD `area` enum('mouth','tooth','surface','range') DEFAULT 'mouth' NOT NULL;