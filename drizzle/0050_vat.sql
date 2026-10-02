ALTER TABLE `invoice` ADD `vat_rate` decimal(5,2);--> statement-breakpoint
ALTER TABLE `invoice_line` ADD `taxable` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `clinic_settings` ADD `tin` varchar(20);--> statement-breakpoint
ALTER TABLE `clinic_settings` ADD `vat_registered` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `clinic_settings` ADD `vat_rate` decimal(5,2) DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE `clinic_settings` ADD `vat_on_services` boolean DEFAULT false NOT NULL;