CREATE TABLE `sms_message` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patient_id` int,
	`appointment_id` int,
	`recall_id` int,
	`kind` enum('reminder','recall','test') NOT NULL,
	`to_phone` varchar(20) NOT NULL,
	`body` text NOT NULL,
	`provider_id` int,
	`provider` enum('afromessage','geezsms') NOT NULL,
	`status` enum('sent','failed') NOT NULL,
	`provider_message_id` varchar(100),
	`error` varchar(255),
	`segments` smallint NOT NULL,
	`cost` decimal(10,2),
	`branch_id` int DEFAULT 1,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `sms_message_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sms_provider` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` enum('afromessage','geezsms') NOT NULL,
	`label` varchar(80) NOT NULL,
	`api_key_encrypted` text NOT NULL,
	`api_key_hint` varchar(8) NOT NULL,
	`sender_name` varchar(32),
	`sender_id` varchar(64),
	`cost_per_segment` decimal(8,2),
	`is_default` boolean NOT NULL DEFAULT false,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `sms_provider_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `patient` ADD `sms_opt_out` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `clinic_settings` ADD `sms_reminder_template` varchar(320) DEFAULT 'ሰላም {name}፣ {date} {time} ላይ በ{clinic} የጥርስ ቀጠሮ አለዎት። ለማዘዋወር {phone} ይደውሉ።' NOT NULL;--> statement-breakpoint
ALTER TABLE `clinic_settings` ADD `sms_recall_template` varchar(320) DEFAULT 'ሰላም {name}፣ የ{visit} ጊዜዎ ደርሷል። ቀጠሮ ለመያዝ {clinic}ን በ{phone} ይደውሉ።' NOT NULL;--> statement-breakpoint
ALTER TABLE `sms_message` ADD CONSTRAINT `sms_message_patient_id_patient_id_fk` FOREIGN KEY (`patient_id`) REFERENCES `patient`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sms_message` ADD CONSTRAINT `sms_message_appointment_id_appointment_id_fk` FOREIGN KEY (`appointment_id`) REFERENCES `appointment`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sms_message` ADD CONSTRAINT `sms_message_recall_id_recall_id_fk` FOREIGN KEY (`recall_id`) REFERENCES `recall`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sms_message` ADD CONSTRAINT `sms_message_provider_id_sms_provider_id_fk` FOREIGN KEY (`provider_id`) REFERENCES `sms_provider`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sms_message` ADD CONSTRAINT `sms_message_branch_id_branch_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branch`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sms_message` ADD CONSTRAINT `sms_message_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sms_message` ADD CONSTRAINT `sms_message_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sms_message` ADD CONSTRAINT `sms_message_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sms_provider` ADD CONSTRAINT `sms_provider_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sms_provider` ADD CONSTRAINT `sms_provider_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sms_provider` ADD CONSTRAINT `sms_provider_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `sms_message_appointment_idx` ON `sms_message` (`appointment_id`);--> statement-breakpoint
CREATE INDEX `sms_message_recall_idx` ON `sms_message` (`recall_id`);--> statement-breakpoint
CREATE INDEX `sms_message_created_idx` ON `sms_message` (`created_at`);