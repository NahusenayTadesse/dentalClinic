ALTER TABLE `supplies` ADD `tracks_expiry` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `supplies` DROP COLUMN `quantity`;--> statement-breakpoint
ALTER TABLE `supplies` DROP COLUMN `tracks_batches`;