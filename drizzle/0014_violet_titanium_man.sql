ALTER TABLE `patient` ADD `merged_into_id` int;--> statement-breakpoint
ALTER TABLE `patient` ADD `merged_at` datetime;--> statement-breakpoint
ALTER TABLE `patient` ADD CONSTRAINT `patient_merged_into_id_patient_id_fk` FOREIGN KEY (`merged_into_id`) REFERENCES `patient`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `patient_merged_idx` ON `patient` (`merged_into_id`);