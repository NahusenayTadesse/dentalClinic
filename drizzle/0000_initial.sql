CREATE TABLE `customer_contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customer_id` int NOT NULL,
	`contact_type` varchar(50) NOT NULL,
	`contact_detail` varchar(255) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `customer_contacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`email` varchar(100) NOT NULL,
	`tin_no` varchar(50) NOT NULL,
	`status` enum('active','dead','pending','contracted'),
	`address` int,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	`approval_status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`requested_by` varchar(255),
	`approved_by` varchar(255),
	`approved_at` datetime,
	`rejected_by` varchar(255),
	`rejected_at` datetime,
	`rejection_reason` varchar(255),
	`approval_overridden` boolean NOT NULL DEFAULT false,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`),
	CONSTRAINT `customers_tin_no_unique` UNIQUE(`tin_no`)
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`expense_date` date NOT NULL,
	`type` int NOT NULL,
	`description` varchar(255),
	`total` decimal(10,2) NOT NULL,
	`transaction_id` int NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	`approval_status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`requested_by` varchar(255),
	`approved_by` varchar(255),
	`approved_at` datetime,
	`rejected_by` varchar(255),
	`rejected_at` datetime,
	`rejection_reason` varchar(255),
	`approval_overridden` boolean NOT NULL DEFAULT false,
	CONSTRAINT `expenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `expenses_type` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` varchar(255),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `expenses_type_id` PRIMARY KEY(`id`),
	CONSTRAINT `expenses_type_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `payment_methods` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` varchar(255),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `payment_methods_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_methods_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `payroll_adjustments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`payroll_entry_id` int,
	`adjustment_type` enum('bonus','deduction') NOT NULL,
	`basic_salary` decimal(10,2),
	`overtime_amount` decimal(10,2),
	`deduction` decimal(10,2),
	`commission_amount` decimal(10,2),
	`bonus_amount` decimal(10,2),
	`allowances` decimal(10,2),
	`transport_allowance` decimal(10,2),
	`position_allowance` decimal(10,2),
	`housing_allowance` decimal(10,2),
	`non_taxable_allowance` decimal(10,2),
	`gross_amount` decimal(10,2),
	`net_amount` decimal(10,2),
	`amount` decimal(10,2) NOT NULL,
	`reason` varchar(255),
	`transaction_id` int,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	`approval_status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`requested_by` varchar(255),
	`approved_by` varchar(255),
	`approved_at` datetime,
	`rejected_by` varchar(255),
	`rejected_at` datetime,
	`rejection_reason` varchar(255),
	`approval_overridden` boolean NOT NULL DEFAULT false,
	CONSTRAINT `payroll_adjustments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payroll_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`payroll_id` int,
	`staff_id` int NOT NULL,
	`month` enum('መስከረም','ጥቅምት','ህዳር','ታህሳስ','ጥር','የካቲት','መጋቢት','ሚያዝያ','ግንቦት','ሰኔ','ሐምሌ','ነሐሴ') NOT NULL,
	`year` year NOT NULL,
	`pay_period_start` date NOT NULL,
	`pay_period_end` date NOT NULL,
	`basic_salary` decimal(10,2),
	`overtime_amount` decimal(10,2),
	`deduction` decimal(10,2),
	`commission_amount` decimal(10,2),
	`bonus_amount` decimal(10,2),
	`allowances` decimal(10,2),
	`transport_allowance` decimal(10,2),
	`position_allowance` decimal(10,2),
	`housing_allowance` decimal(10,2),
	`non_taxable_allowance` decimal(10,2),
	`gross_amount` decimal(10,2),
	`net_amount` decimal(10,2),
	`paid_amount` decimal(10,2),
	`attendance_penality` decimal(10,2),
	`tax_amount` decimal(10,2),
	`status` enum('pending','approved','paid') NOT NULL DEFAULT 'pending',
	`payment_method_id` int,
	`payment_date` date,
	`pen_em` decimal(10,2),
	`pen_org` decimal(10,2),
	`notes` varchar(255),
	`reciept_link` varchar(255),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `payroll_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payroll_receipts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`payroll_run_id` int,
	`pay_period_start` date NOT NULL,
	`pay_period_end` date NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`paid_date` date NOT NULL,
	`number_of_employees` int NOT NULL,
	`reciept_link` varchar(255),
	`transaction_id` int,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `payroll_receipts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payroll_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`month` varchar(50) NOT NULL,
	`year` year NOT NULL,
	`total_salaries` decimal(10,2),
	`total_overtime` decimal(10,2),
	`total_transport` decimal(10,2),
	`total_housing` decimal(10,2),
	`total_position` decimal(10,2),
	`total_net` decimal(10,2),
	`total_deductions` decimal(10,2),
	`total_penalities` decimal(10,2),
	`total_tax` decimal(10,2),
	`total_gross` decimal(10,2),
	`pen_em` decimal(10,2),
	`pen_org` decimal(10,2),
	`finalized` boolean NOT NULL DEFAULT false,
	`finalized_by` int,
	`finalized_by_user_id` varchar(255),
	`finalized_at` datetime,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	`approval_status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`requested_by` varchar(255),
	`approved_by` varchar(255),
	`approved_at` datetime,
	`rejected_by` varchar(255),
	`rejected_at` datetime,
	`rejection_reason` varchar(255),
	`approval_overridden` boolean NOT NULL DEFAULT false,
	CONSTRAINT `payroll_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `payroll_runs_month_year_unique` UNIQUE(`month`,`year`)
);
--> statement-breakpoint
CREATE TABLE `transaction_services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staff_id` int NOT NULL,
	`transaction_id` int NOT NULL,
	`service_id` int NOT NULL,
	`price` decimal(10,2) NOT NULL,
	`tip` decimal(10,2) NOT NULL DEFAULT '0',
	`tax` decimal(10,2),
	`total` decimal(10,2),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `transaction_services_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transaction_supplies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transaction_id` int NOT NULL,
	`supply_id` int,
	`quantity` decimal(10,2) NOT NULL DEFAULT '1',
	`unit_price` decimal(10,2) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `transaction_supplies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`description` varchar(255),
	`amount` decimal(10,2) NOT NULL,
	`payment_status` enum('pending','paid','unpaid','refunded','partially_paid','partially_refunded','overpaid','disputed') DEFAULT 'pending',
	`payment_method_id` int,
	`reciept_link` varchar(255),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vat_and_withhold` (
	`vat` decimal(10,2) NOT NULL,
	`with_hold` decimal(10,2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`description` varchar(255),
	CONSTRAINT `permissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `permissions_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`role_id` int NOT NULL,
	`permission_id` int NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `role_permissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `special_permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`permission_id` int NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `special_permissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `account` (
	`id` varchar(255) NOT NULL,
	`account_id` varchar(255) NOT NULL,
	`provider_id` varchar(255) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` datetime,
	`refresh_token_expires_at` datetime,
	`scope` text,
	`password` text,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	CONSTRAINT `account_id` PRIMARY KEY(`id`),
	CONSTRAINT `account_provider_account_idx` UNIQUE(`provider_id`,`account_id`)
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(32) NOT NULL,
	`description` varchar(255),
	`is_active` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `roles_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` varchar(255) NOT NULL,
	`token` varchar(255) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`expires_at` datetime NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`impersonated_by` varchar(255),
	CONSTRAINT `session_id` PRIMARY KEY(`id`),
	CONSTRAINT `session_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`email_verified` boolean NOT NULL DEFAULT false,
	`image` text,
	`username` varchar(32),
	`is_active` boolean NOT NULL DEFAULT true,
	`role` varchar(64),
	`banned` boolean DEFAULT false,
	`ban_reason` text,
	`ban_expires` datetime,
	`role_id` int NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `user_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_email_unique` UNIQUE(`email`),
	CONSTRAINT `user_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE TABLE `verification` (
	`id` varchar(255) NOT NULL,
	`identifier` varchar(255) NOT NULL,
	`value` text NOT NULL,
	`expires_at` datetime NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	CONSTRAINT `verification_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `damaged_supplies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`supply_id` int NOT NULL,
	`quantity` int NOT NULL,
	`damaged_by` int,
	`deductable` boolean NOT NULL DEFAULT false,
	`reason` varchar(255) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `damaged_supplies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `supplies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`supply_type_id` int NOT NULL,
	`name` varchar(50) NOT NULL,
	`description` varchar(255),
	`quantity` int NOT NULL DEFAULT 0,
	`unit_of_measure` varchar(20),
	`reorder_level` int,
	`returnable` boolean NOT NULL DEFAULT false,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `supplies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `supplies_adjustments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`supplies_id` int NOT NULL,
	`adjustment` int NOT NULL,
	`supplier_id` int,
	`employee_responsible` int,
	`reason` varchar(255),
	`cost_per_item` decimal(10,2),
	`total` decimal(10,2),
	`transaction_id` int,
	`damaged_supplies_id` int,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `supplies_adjustments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `supply_suppliers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`email` varchar(100),
	`description` varchar(255),
	`address` int,
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `supply_suppliers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `supply_types` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`description` varchar(255),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `supply_types_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` varchar(255),
	`action` varchar(32) NOT NULL,
	`table_name` varchar(32) NOT NULL,
	`record_id` varchar(255) NOT NULL,
	`old_values` json,
	`new_values` json,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	`ip_address` varchar(45),
	CONSTRAINT `audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `backup` (
	`last_download` timestamp NOT NULL DEFAULT (now())
);
--> statement-breakpoint
CREATE TABLE `job_run` (
	`id` int AUTO_INCREMENT NOT NULL,
	`job_name` varchar(50) NOT NULL,
	`trigger_source` enum('cron','manual','backstop') NOT NULL DEFAULT 'cron',
	`run_status` enum('running','success','failed') NOT NULL DEFAULT 'running',
	`started_at` timestamp NOT NULL DEFAULT (now()),
	`finished_at` timestamp,
	`summary` varchar(500),
	`error` varchar(500),
	CONSTRAINT `job_run_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`report_date` date NOT NULL,
	`booked_appointments` int DEFAULT 0,
	`cancelled_appointments` int DEFAULT 0,
	`products_sold` int NOT NULL DEFAULT 0,
	`services_rendered` int NOT NULL,
	`daily_expenses` decimal(10,2),
	`daily_income` decimal(10,2),
	`transactions` int NOT NULL,
	`staff_paid` int,
	`total_staff_paid` decimal(10,2),
	`staff_hired` int,
	`staff_fired` int,
	CONSTRAINT `reports_id` PRIMARY KEY(`id`),
	CONSTRAINT `reports_report_date_unique` UNIQUE(`report_date`)
);
--> statement-breakpoint
CREATE TABLE `service_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`description` varchar(255),
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `service_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `service_categories_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`category_id` int,
	`description` varchar(255),
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `services_id` PRIMARY KEY(`id`),
	CONSTRAINT `services_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `annual_leave_entitlement` (
	`id` int AUTO_INCREMENT NOT NULL,
	`from_years` int NOT NULL,
	`to_years` int,
	`days` decimal(5,1) NOT NULL,
	`description` varchar(255),
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `annual_leave_entitlement_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bonuses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staff_id` int,
	`description` varchar(255),
	`amount` decimal(10,2) NOT NULL,
	`bonus_date` date NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `bonuses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deductions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staff_id` int,
	`type` varchar(100) NOT NULL,
	`reason` varchar(255) NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`deduction_date` date NOT NULL,
	`warning_type` varchar(100),
	`warning_reason` varchar(255),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `deductions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `department` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(32) NOT NULL,
	`phone` varchar(20),
	`commission` boolean NOT NULL DEFAULT false,
	`description` varchar(255),
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `department_id` PRIMARY KEY(`id`),
	CONSTRAINT `department_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `educational_level` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(32) NOT NULL,
	`description` varchar(255),
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `educational_level_id` PRIMARY KEY(`id`),
	CONSTRAINT `educational_level_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `employee` (
	`id` int AUTO_INCREMENT NOT NULL,
	`id_no` varchar(255),
	`name` varchar(50) NOT NULL,
	`father_name` varchar(50) NOT NULL,
	`grand_father_name` varchar(50) NOT NULL,
	`gender` enum('male','female') NOT NULL DEFAULT 'male',
	`nationality` varchar(50) NOT NULL DEFAULT 'Ethiopia',
	`blood_type` enum('A+','A-','B+','B-','AB+','AB-','O+','O-'),
	`tin_no` varchar(10),
	`department_id` int NOT NULL,
	`position_id` int,
	`birth_date` date NOT NULL,
	`photo` varchar(255) NOT NULL,
	`govt_id` varchar(255) NOT NULL,
	`hire_date` date NOT NULL,
	`termination_date` datetime,
	`employment_status` int NOT NULL,
	`educational_level` int,
	`martial_status` enum('single','married','widowed','divorced','other') DEFAULT 'single',
	`site_id` int,
	`existingPensionCard` boolean DEFAULT false,
	`address` int,
	`leaves_left` decimal(5,1) NOT NULL DEFAULT 0,
	`signiture` varchar(255),
	`pension_card` varchar(255),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	`approval_status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`requested_by` varchar(255),
	`approved_by` varchar(255),
	`approved_at` datetime,
	`rejected_by` varchar(255),
	`rejected_at` datetime,
	`rejection_reason` varchar(255),
	`approval_overridden` boolean NOT NULL DEFAULT false,
	CONSTRAINT `employee_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employee_guarantor` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staff_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`relationship` enum('mother','father','spouse','son','brother','sister','daughter','other') NOT NULL,
	`relation` varchar(255),
	`job_type` varchar(255),
	`company` varchar(255),
	`salary` decimal(10,2) NOT NULL,
	`gurantor_document` varchar(255),
	`phone` varchar(255),
	`photo` varchar(255),
	`govt_id` varchar(255),
	`email` varchar(255),
	`address` int NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `employee_guarantor_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employee_leave_grant` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staff_id` int NOT NULL,
	`service_year` int NOT NULL,
	`grant_date` date NOT NULL,
	`expiry_date` date NOT NULL,
	`days_granted` decimal(5,1) NOT NULL,
	`days_used` decimal(5,1) NOT NULL DEFAULT 0,
	`grant_status` enum('active','expired') NOT NULL DEFAULT 'active',
	`expired_at` datetime,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `employee_leave_grant_id` PRIMARY KEY(`id`),
	CONSTRAINT `staff_service_year_idx` UNIQUE(`staff_id`,`service_year`)
);
--> statement-breakpoint
CREATE TABLE `empoloyee_termination` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staff_id` int NOT NULL,
	`reason` varchar(255),
	`termination_letter` varchar(255),
	`termination_date` date NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `empoloyee_termination_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employment_statuses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(32) NOT NULL,
	`remove_from_lists` boolean NOT NULL DEFAULT false,
	`termination_status` boolean,
	`description` varchar(255),
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `employment_statuses_id` PRIMARY KEY(`id`),
	CONSTRAINT `employment_statuses_name_unique` UNIQUE(`name`),
	CONSTRAINT `termination_status_unique_idx` UNIQUE(`termination_status`)
);
--> statement-breakpoint
CREATE TABLE `leave` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staff_id` int NOT NULL,
	`leave_type_id` int,
	`request_date` date NOT NULL,
	`start_date` date NOT NULL,
	`end_date` date NOT NULL,
	`half_day_start` boolean NOT NULL DEFAULT false,
	`half_day_end` boolean NOT NULL DEFAULT false,
	`days` decimal(5,1) NOT NULL DEFAULT 0,
	`reason` varchar(255),
	`user_id` varchar(255),
	`leave_letter` varchar(100),
	`status` enum('pending','approved','rejected') DEFAULT 'pending',
	`rejection_reason` varchar(255),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `leave_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leave_expiry_policy` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`expiry_years` int NOT NULL,
	`description` varchar(255),
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `leave_expiry_policy_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leave_type` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`max_days` decimal(5,1) NOT NULL DEFAULT 0,
	`deducts_balance` boolean NOT NULL DEFAULT false,
	`description` varchar(255),
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `leave_type_id` PRIMARY KEY(`id`),
	CONSTRAINT `leave_type_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `missing_days` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staff_id` int NOT NULL,
	`day` date NOT NULL,
	`reason` varchar(255) NOT NULL,
	`deductable` boolean NOT NULL DEFAULT false,
	`deductable_amount` decimal(10,2),
	`approval` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `missing_days_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `over_time` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staff_id` int,
	`reason` varchar(255),
	`amount_per_hour` decimal(10,2) NOT NULL,
	`over_time_type_id` int,
	`hours` decimal(10,2) NOT NULL,
	`total` decimal(10,2) NOT NULL,
	`date` date NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `over_time_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `over_time_type` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`rate` decimal(10,2) NOT NULL,
	`max_hours` int,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `over_time_type_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `penality` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`rate` decimal(15,2) NOT NULL,
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `penality_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `position` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(32) NOT NULL,
	`department_id` int NOT NULL,
	`description` varchar(255),
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `position_id` PRIMARY KEY(`id`),
	CONSTRAINT `position_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `qualification` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staff_id` int NOT NULL,
	`field` varchar(255),
	`education_level` int NOT NULL,
	`school_name` varchar(255),
	`qualification_date` date NOT NULL,
	`certificate` varchar(100),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `qualification_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `salaries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staff_id` int NOT NULL,
	`department_id` int,
	`site_id` int,
	`position_id` int,
	`office commision` boolean DEFAULT false,
	`percentage` decimal(10,2),
	`change_reason` varchar(255),
	`transportation_allowance` decimal(10,2) NOT NULL DEFAULT '0',
	`housing_allowance` decimal(10,2) NOT NULL DEFAULT '0',
	`non_tax_allowance` decimal(10,2) NOT NULL DEFAULT '0',
	`position_allowance` decimal(10,2) NOT NULL DEFAULT '0',
	`amount` decimal(10,2) NOT NULL,
	`start_date` date NOT NULL,
	`end_date` date,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	`approval_status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`requested_by` varchar(255),
	`approved_by` varchar(255),
	`approved_at` datetime,
	`rejected_by` varchar(255),
	`rejected_at` datetime,
	`rejection_reason` varchar(255),
	`approval_overridden` boolean NOT NULL DEFAULT false,
	CONSTRAINT `salaries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `staff_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staff_id` int NOT NULL,
	`payment_Method_id` int,
	`account_detail` varchar(255) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `staff_accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `staff_contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staff_id` int NOT NULL,
	`contact_type` varchar(50) NOT NULL,
	`contact_detail` varchar(255) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `staff_contacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `staff_families` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staff_id` int,
	`relationship` enum('mother','father','spouse','son','daughter','grandchild','grandfather','grandmother','uncle','aunt','brother','sister','other') NOT NULL,
	`gender` enum('male','female') NOT NULL DEFAULT 'male',
	`other_relationship` varchar(255),
	`name` varchar(255) NOT NULL,
	`phone` varchar(255),
	`email` varchar(255),
	`emergency_contact` boolean NOT NULL DEFAULT false,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `staff_families_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `staff_schedule` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staff_id` int NOT NULL,
	`week_day` tinyint NOT NULL,
	`start_time` time NOT NULL,
	`end_time` time NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `staff_schedule_id` PRIMARY KEY(`id`),
	CONSTRAINT `real_days_only` CHECK(`staff_schedule`.`week_day` >= 0 AND `staff_schedule`.`week_day` <= 6)
);
--> statement-breakpoint
CREATE TABLE `staff_services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staff_id` int NOT NULL,
	`service_id` int NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `staff_services_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tax_type` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`threshold` decimal(12,2),
	`rate` decimal(15,2) NOT NULL,
	`deduction` decimal(12,2) NOT NULL,
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `tax_type_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_staff` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` varchar(255),
	`staff_id` int,
	CONSTRAINT `user_staff_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `work_experience` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staff_id` int NOT NULL,
	`company_name` varchar(255),
	`position` varchar(255),
	`start_date` date NOT NULL,
	`end_date` date NOT NULL,
	`description` varchar(255),
	`certificate` varchar(100),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `work_experience_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `address` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subcity_id` int,
	`other_subcity` varchar(50),
	`street` varchar(100),
	`kebele` varchar(100),
	`building_number` varchar(10),
	`floor` int DEFAULT 0,
	`house_number` int DEFAULT 0,
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `address_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `city` (
	`id` int AUTO_INCREMENT NOT NULL,
	`region_id` int NOT NULL,
	`name` varchar(50) NOT NULL,
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `city_id` PRIMARY KEY(`id`),
	CONSTRAINT `city_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `region` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `region_id` PRIMARY KEY(`id`),
	CONSTRAINT `region_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `subcity` (
	`sc_id` int AUTO_INCREMENT NOT NULL,
	`city_id` int NOT NULL,
	`name` varchar(50) NOT NULL,
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `subcity_sc_id` PRIMARY KEY(`sc_id`),
	CONSTRAINT `subcity_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `site` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`customer_id` int NOT NULL,
	`address` int NOT NULL,
	`start_date` date NOT NULL,
	`office_commission` boolean NOT NULL DEFAULT true,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	`approval_status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`requested_by` varchar(255),
	`approved_by` varchar(255),
	`approved_at` datetime,
	`rejected_by` varchar(255),
	`rejected_at` datetime,
	`rejection_reason` varchar(255),
	`approval_overridden` boolean NOT NULL DEFAULT false,
	CONSTRAINT `site_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `site_contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`site_id` int NOT NULL,
	`contact_type` varchar(50) NOT NULL,
	`contact_detail` varchar(255) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `site_contacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `customer_contacts` ADD CONSTRAINT `customer_contacts_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_contacts` ADD CONSTRAINT `customer_contacts_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_contacts` ADD CONSTRAINT `customer_contacts_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_contacts` ADD CONSTRAINT `customer_contacts_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customers` ADD CONSTRAINT `customers_address_address_id_fk` FOREIGN KEY (`address`) REFERENCES `address`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customers` ADD CONSTRAINT `customers_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customers` ADD CONSTRAINT `customers_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customers` ADD CONSTRAINT `customers_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customers` ADD CONSTRAINT `customers_requested_by_user_id_fk` FOREIGN KEY (`requested_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customers` ADD CONSTRAINT `customers_approved_by_user_id_fk` FOREIGN KEY (`approved_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customers` ADD CONSTRAINT `customers_rejected_by_user_id_fk` FOREIGN KEY (`rejected_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_type_expenses_type_id_fk` FOREIGN KEY (`type`) REFERENCES `expenses_type`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_transaction_id_transactions_id_fk` FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_requested_by_user_id_fk` FOREIGN KEY (`requested_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_approved_by_user_id_fk` FOREIGN KEY (`approved_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_rejected_by_user_id_fk` FOREIGN KEY (`rejected_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expenses_type` ADD CONSTRAINT `expenses_type_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expenses_type` ADD CONSTRAINT `expenses_type_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expenses_type` ADD CONSTRAINT `expenses_type_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_methods` ADD CONSTRAINT `payment_methods_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_methods` ADD CONSTRAINT `payment_methods_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_methods` ADD CONSTRAINT `payment_methods_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payroll_adjustments` ADD CONSTRAINT `payroll_adjustments_payroll_entry_id_payroll_entries_id_fk` FOREIGN KEY (`payroll_entry_id`) REFERENCES `payroll_entries`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payroll_adjustments` ADD CONSTRAINT `payroll_adjustments_transaction_id_transactions_id_fk` FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payroll_adjustments` ADD CONSTRAINT `payroll_adjustments_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payroll_adjustments` ADD CONSTRAINT `payroll_adjustments_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payroll_adjustments` ADD CONSTRAINT `payroll_adjustments_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payroll_adjustments` ADD CONSTRAINT `payroll_adjustments_requested_by_user_id_fk` FOREIGN KEY (`requested_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payroll_adjustments` ADD CONSTRAINT `payroll_adjustments_approved_by_user_id_fk` FOREIGN KEY (`approved_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payroll_adjustments` ADD CONSTRAINT `payroll_adjustments_rejected_by_user_id_fk` FOREIGN KEY (`rejected_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payroll_entries` ADD CONSTRAINT `payroll_entries_payroll_id_payroll_runs_id_fk` FOREIGN KEY (`payroll_id`) REFERENCES `payroll_runs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payroll_entries` ADD CONSTRAINT `payroll_entries_staff_id_employee_id_fk` FOREIGN KEY (`staff_id`) REFERENCES `employee`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payroll_entries` ADD CONSTRAINT `payroll_entries_payment_method_id_payment_methods_id_fk` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payroll_entries` ADD CONSTRAINT `payroll_entries_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payroll_entries` ADD CONSTRAINT `payroll_entries_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payroll_entries` ADD CONSTRAINT `payroll_entries_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payroll_receipts` ADD CONSTRAINT `payroll_receipts_payroll_run_id_payroll_runs_id_fk` FOREIGN KEY (`payroll_run_id`) REFERENCES `payroll_runs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payroll_receipts` ADD CONSTRAINT `payroll_receipts_transaction_id_transactions_id_fk` FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payroll_receipts` ADD CONSTRAINT `payroll_receipts_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payroll_receipts` ADD CONSTRAINT `payroll_receipts_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payroll_receipts` ADD CONSTRAINT `payroll_receipts_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payroll_runs` ADD CONSTRAINT `payroll_runs_finalized_by_employee_id_fk` FOREIGN KEY (`finalized_by`) REFERENCES `employee`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payroll_runs` ADD CONSTRAINT `payroll_runs_finalized_by_user_id_user_id_fk` FOREIGN KEY (`finalized_by_user_id`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payroll_runs` ADD CONSTRAINT `payroll_runs_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payroll_runs` ADD CONSTRAINT `payroll_runs_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payroll_runs` ADD CONSTRAINT `payroll_runs_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payroll_runs` ADD CONSTRAINT `payroll_runs_requested_by_user_id_fk` FOREIGN KEY (`requested_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payroll_runs` ADD CONSTRAINT `payroll_runs_approved_by_user_id_fk` FOREIGN KEY (`approved_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payroll_runs` ADD CONSTRAINT `payroll_runs_rejected_by_user_id_fk` FOREIGN KEY (`rejected_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transaction_services` ADD CONSTRAINT `transaction_services_staff_id_employee_id_fk` FOREIGN KEY (`staff_id`) REFERENCES `employee`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transaction_services` ADD CONSTRAINT `transaction_services_transaction_id_transactions_id_fk` FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transaction_services` ADD CONSTRAINT `transaction_services_service_id_services_id_fk` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transaction_services` ADD CONSTRAINT `transaction_services_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transaction_services` ADD CONSTRAINT `transaction_services_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transaction_services` ADD CONSTRAINT `transaction_services_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transaction_supplies` ADD CONSTRAINT `transaction_supplies_transaction_id_transactions_id_fk` FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transaction_supplies` ADD CONSTRAINT `transaction_supplies_supply_id_supplies_id_fk` FOREIGN KEY (`supply_id`) REFERENCES `supplies`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transaction_supplies` ADD CONSTRAINT `transaction_supplies_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transaction_supplies` ADD CONSTRAINT `transaction_supplies_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transaction_supplies` ADD CONSTRAINT `transaction_supplies_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_payment_method_id_payment_methods_id_fk` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_permission_id_permissions_id_fk` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `special_permissions` ADD CONSTRAINT `special_permissions_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `special_permissions` ADD CONSTRAINT `special_permissions_permission_id_permissions_id_fk` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `special_permissions` ADD CONSTRAINT `special_permissions_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `special_permissions` ADD CONSTRAINT `special_permissions_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `special_permissions` ADD CONSTRAINT `special_permissions_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `account` ADD CONSTRAINT `account_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `roles` ADD CONSTRAINT `roles_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `session` ADD CONSTRAINT `session_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user` ADD CONSTRAINT `user_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `damaged_supplies` ADD CONSTRAINT `damaged_supplies_supply_id_supplies_id_fk` FOREIGN KEY (`supply_id`) REFERENCES `supplies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `damaged_supplies` ADD CONSTRAINT `damaged_supplies_damaged_by_employee_id_fk` FOREIGN KEY (`damaged_by`) REFERENCES `employee`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `damaged_supplies` ADD CONSTRAINT `damaged_supplies_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `damaged_supplies` ADD CONSTRAINT `damaged_supplies_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `damaged_supplies` ADD CONSTRAINT `damaged_supplies_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplies` ADD CONSTRAINT `supplies_supply_type_id_supply_types_id_fk` FOREIGN KEY (`supply_type_id`) REFERENCES `supply_types`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplies` ADD CONSTRAINT `supplies_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplies` ADD CONSTRAINT `supplies_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplies` ADD CONSTRAINT `supplies_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplies_adjustments` ADD CONSTRAINT `supplies_adjustments_supplies_id_supplies_id_fk` FOREIGN KEY (`supplies_id`) REFERENCES `supplies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplies_adjustments` ADD CONSTRAINT `supplies_adjustments_supplier_id_supply_suppliers_id_fk` FOREIGN KEY (`supplier_id`) REFERENCES `supply_suppliers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplies_adjustments` ADD CONSTRAINT `supplies_adjustments_employee_responsible_employee_id_fk` FOREIGN KEY (`employee_responsible`) REFERENCES `employee`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplies_adjustments` ADD CONSTRAINT `supplies_adjustments_transaction_id_transaction_supplies_id_fk` FOREIGN KEY (`transaction_id`) REFERENCES `transaction_supplies`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplies_adjustments` ADD CONSTRAINT `supplies_adjustments_damaged_supplies_id_damaged_supplies_id_fk` FOREIGN KEY (`damaged_supplies_id`) REFERENCES `damaged_supplies`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplies_adjustments` ADD CONSTRAINT `supplies_adjustments_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplies_adjustments` ADD CONSTRAINT `supplies_adjustments_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplies_adjustments` ADD CONSTRAINT `supplies_adjustments_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supply_suppliers` ADD CONSTRAINT `supply_suppliers_address_address_id_fk` FOREIGN KEY (`address`) REFERENCES `address`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supply_suppliers` ADD CONSTRAINT `supply_suppliers_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supply_types` ADD CONSTRAINT `supply_types_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_log` ADD CONSTRAINT `audit_log_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `service_categories` ADD CONSTRAINT `service_categories_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `services` ADD CONSTRAINT `services_category_id_service_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `service_categories`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `services` ADD CONSTRAINT `services_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `annual_leave_entitlement` ADD CONSTRAINT `annual_leave_entitlement_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bonuses` ADD CONSTRAINT `bonuses_staff_id_employee_id_fk` FOREIGN KEY (`staff_id`) REFERENCES `employee`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bonuses` ADD CONSTRAINT `bonuses_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bonuses` ADD CONSTRAINT `bonuses_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bonuses` ADD CONSTRAINT `bonuses_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `deductions` ADD CONSTRAINT `deductions_staff_id_employee_id_fk` FOREIGN KEY (`staff_id`) REFERENCES `employee`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `deductions` ADD CONSTRAINT `deductions_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `deductions` ADD CONSTRAINT `deductions_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `deductions` ADD CONSTRAINT `deductions_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `department` ADD CONSTRAINT `department_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `educational_level` ADD CONSTRAINT `educational_level_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employee` ADD CONSTRAINT `employee_department_id_department_id_fk` FOREIGN KEY (`department_id`) REFERENCES `department`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employee` ADD CONSTRAINT `employee_position_id_position_id_fk` FOREIGN KEY (`position_id`) REFERENCES `position`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employee` ADD CONSTRAINT `employee_employment_status_employment_statuses_id_fk` FOREIGN KEY (`employment_status`) REFERENCES `employment_statuses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employee` ADD CONSTRAINT `employee_educational_level_educational_level_id_fk` FOREIGN KEY (`educational_level`) REFERENCES `educational_level`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employee` ADD CONSTRAINT `employee_site_id_site_id_fk` FOREIGN KEY (`site_id`) REFERENCES `site`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employee` ADD CONSTRAINT `employee_address_address_id_fk` FOREIGN KEY (`address`) REFERENCES `address`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employee` ADD CONSTRAINT `employee_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employee` ADD CONSTRAINT `employee_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employee` ADD CONSTRAINT `employee_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employee` ADD CONSTRAINT `employee_requested_by_user_id_fk` FOREIGN KEY (`requested_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employee` ADD CONSTRAINT `employee_approved_by_user_id_fk` FOREIGN KEY (`approved_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employee` ADD CONSTRAINT `employee_rejected_by_user_id_fk` FOREIGN KEY (`rejected_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employee_guarantor` ADD CONSTRAINT `employee_guarantor_staff_id_employee_id_fk` FOREIGN KEY (`staff_id`) REFERENCES `employee`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employee_guarantor` ADD CONSTRAINT `employee_guarantor_address_address_id_fk` FOREIGN KEY (`address`) REFERENCES `address`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employee_guarantor` ADD CONSTRAINT `employee_guarantor_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employee_guarantor` ADD CONSTRAINT `employee_guarantor_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employee_guarantor` ADD CONSTRAINT `employee_guarantor_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employee_leave_grant` ADD CONSTRAINT `employee_leave_grant_staff_id_employee_id_fk` FOREIGN KEY (`staff_id`) REFERENCES `employee`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employee_leave_grant` ADD CONSTRAINT `employee_leave_grant_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employee_leave_grant` ADD CONSTRAINT `employee_leave_grant_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employee_leave_grant` ADD CONSTRAINT `employee_leave_grant_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `empoloyee_termination` ADD CONSTRAINT `empoloyee_termination_staff_id_employee_id_fk` FOREIGN KEY (`staff_id`) REFERENCES `employee`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `empoloyee_termination` ADD CONSTRAINT `empoloyee_termination_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `empoloyee_termination` ADD CONSTRAINT `empoloyee_termination_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `empoloyee_termination` ADD CONSTRAINT `empoloyee_termination_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employment_statuses` ADD CONSTRAINT `employment_statuses_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leave` ADD CONSTRAINT `leave_staff_id_employee_id_fk` FOREIGN KEY (`staff_id`) REFERENCES `employee`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leave` ADD CONSTRAINT `leave_leave_type_id_leave_type_id_fk` FOREIGN KEY (`leave_type_id`) REFERENCES `leave_type`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leave` ADD CONSTRAINT `leave_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leave` ADD CONSTRAINT `leave_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leave` ADD CONSTRAINT `leave_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leave` ADD CONSTRAINT `leave_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leave_expiry_policy` ADD CONSTRAINT `leave_expiry_policy_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leave_type` ADD CONSTRAINT `leave_type_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `missing_days` ADD CONSTRAINT `missing_days_staff_id_employee_id_fk` FOREIGN KEY (`staff_id`) REFERENCES `employee`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `missing_days` ADD CONSTRAINT `missing_days_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `missing_days` ADD CONSTRAINT `missing_days_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `missing_days` ADD CONSTRAINT `missing_days_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `over_time` ADD CONSTRAINT `over_time_staff_id_employee_id_fk` FOREIGN KEY (`staff_id`) REFERENCES `employee`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `over_time` ADD CONSTRAINT `over_time_over_time_type_id_over_time_type_id_fk` FOREIGN KEY (`over_time_type_id`) REFERENCES `over_time_type`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `over_time` ADD CONSTRAINT `over_time_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `over_time` ADD CONSTRAINT `over_time_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `over_time` ADD CONSTRAINT `over_time_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `over_time_type` ADD CONSTRAINT `over_time_type_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `over_time_type` ADD CONSTRAINT `over_time_type_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `over_time_type` ADD CONSTRAINT `over_time_type_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `penality` ADD CONSTRAINT `penality_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `position` ADD CONSTRAINT `position_department_id_department_id_fk` FOREIGN KEY (`department_id`) REFERENCES `department`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `position` ADD CONSTRAINT `position_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `qualification` ADD CONSTRAINT `qualification_staff_id_employee_id_fk` FOREIGN KEY (`staff_id`) REFERENCES `employee`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `qualification` ADD CONSTRAINT `qualification_education_level_educational_level_id_fk` FOREIGN KEY (`education_level`) REFERENCES `educational_level`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `qualification` ADD CONSTRAINT `qualification_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `qualification` ADD CONSTRAINT `qualification_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `qualification` ADD CONSTRAINT `qualification_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `salaries` ADD CONSTRAINT `salaries_staff_id_employee_id_fk` FOREIGN KEY (`staff_id`) REFERENCES `employee`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `salaries` ADD CONSTRAINT `salaries_department_id_department_id_fk` FOREIGN KEY (`department_id`) REFERENCES `department`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `salaries` ADD CONSTRAINT `salaries_site_id_site_id_fk` FOREIGN KEY (`site_id`) REFERENCES `site`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `salaries` ADD CONSTRAINT `salaries_position_id_position_id_fk` FOREIGN KEY (`position_id`) REFERENCES `position`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `salaries` ADD CONSTRAINT `salaries_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `salaries` ADD CONSTRAINT `salaries_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `salaries` ADD CONSTRAINT `salaries_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `salaries` ADD CONSTRAINT `salaries_requested_by_user_id_fk` FOREIGN KEY (`requested_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `salaries` ADD CONSTRAINT `salaries_approved_by_user_id_fk` FOREIGN KEY (`approved_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `salaries` ADD CONSTRAINT `salaries_rejected_by_user_id_fk` FOREIGN KEY (`rejected_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_accounts` ADD CONSTRAINT `staff_accounts_staff_id_employee_id_fk` FOREIGN KEY (`staff_id`) REFERENCES `employee`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_accounts` ADD CONSTRAINT `staff_accounts_payment_Method_id_payment_methods_id_fk` FOREIGN KEY (`payment_Method_id`) REFERENCES `payment_methods`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_accounts` ADD CONSTRAINT `staff_accounts_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_accounts` ADD CONSTRAINT `staff_accounts_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_accounts` ADD CONSTRAINT `staff_accounts_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_contacts` ADD CONSTRAINT `staff_contacts_staff_id_employee_id_fk` FOREIGN KEY (`staff_id`) REFERENCES `employee`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_contacts` ADD CONSTRAINT `staff_contacts_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_contacts` ADD CONSTRAINT `staff_contacts_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_contacts` ADD CONSTRAINT `staff_contacts_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_families` ADD CONSTRAINT `staff_families_staff_id_employee_id_fk` FOREIGN KEY (`staff_id`) REFERENCES `employee`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_families` ADD CONSTRAINT `staff_families_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_families` ADD CONSTRAINT `staff_families_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_families` ADD CONSTRAINT `staff_families_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_schedule` ADD CONSTRAINT `staff_schedule_staff_id_employee_id_fk` FOREIGN KEY (`staff_id`) REFERENCES `employee`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_schedule` ADD CONSTRAINT `staff_schedule_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_schedule` ADD CONSTRAINT `staff_schedule_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_schedule` ADD CONSTRAINT `staff_schedule_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_services` ADD CONSTRAINT `staff_services_staff_id_employee_id_fk` FOREIGN KEY (`staff_id`) REFERENCES `employee`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_services` ADD CONSTRAINT `staff_services_service_id_services_id_fk` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_services` ADD CONSTRAINT `staff_services_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_services` ADD CONSTRAINT `staff_services_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_services` ADD CONSTRAINT `staff_services_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tax_type` ADD CONSTRAINT `tax_type_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_staff` ADD CONSTRAINT `user_staff_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_staff` ADD CONSTRAINT `user_staff_staff_id_employee_id_fk` FOREIGN KEY (`staff_id`) REFERENCES `employee`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `work_experience` ADD CONSTRAINT `work_experience_staff_id_employee_id_fk` FOREIGN KEY (`staff_id`) REFERENCES `employee`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `work_experience` ADD CONSTRAINT `work_experience_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `work_experience` ADD CONSTRAINT `work_experience_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `work_experience` ADD CONSTRAINT `work_experience_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `address` ADD CONSTRAINT `address_subcity_id_subcity_sc_id_fk` FOREIGN KEY (`subcity_id`) REFERENCES `subcity`(`sc_id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `address` ADD CONSTRAINT `address_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `city` ADD CONSTRAINT `city_region_id_region_id_fk` FOREIGN KEY (`region_id`) REFERENCES `region`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `city` ADD CONSTRAINT `city_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `region` ADD CONSTRAINT `region_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subcity` ADD CONSTRAINT `subcity_city_id_city_id_fk` FOREIGN KEY (`city_id`) REFERENCES `city`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subcity` ADD CONSTRAINT `subcity_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `site` ADD CONSTRAINT `site_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `site` ADD CONSTRAINT `site_address_address_id_fk` FOREIGN KEY (`address`) REFERENCES `address`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `site` ADD CONSTRAINT `site_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `site` ADD CONSTRAINT `site_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `site` ADD CONSTRAINT `site_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `site` ADD CONSTRAINT `site_requested_by_user_id_fk` FOREIGN KEY (`requested_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `site` ADD CONSTRAINT `site_approved_by_user_id_fk` FOREIGN KEY (`approved_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `site` ADD CONSTRAINT `site_rejected_by_user_id_fk` FOREIGN KEY (`rejected_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `site_contacts` ADD CONSTRAINT `site_contacts_site_id_site_id_fk` FOREIGN KEY (`site_id`) REFERENCES `site`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `site_contacts` ADD CONSTRAINT `site_contacts_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `site_contacts` ADD CONSTRAINT `site_contacts_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `site_contacts` ADD CONSTRAINT `site_contacts_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `staff_id_idx` ON `payroll_entries` (`staff_id`);--> statement-breakpoint
CREATE INDEX `payroll_id_idx` ON `payroll_entries` (`payroll_id`);--> statement-breakpoint
CREATE INDEX `period_idx` ON `payroll_entries` (`year`,`month`);--> statement-breakpoint
CREATE INDEX `payment_method_idx` ON `payroll_entries` (`payment_method_id`);--> statement-breakpoint
CREATE INDEX `account_user_id_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE INDEX `session_user_id_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE INDEX `name_idx` ON `user` (`name`);--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE INDEX `job_name_started_idx` ON `job_run` (`job_name`,`started_at`);--> statement-breakpoint
CREATE INDEX `from_years_idx` ON `annual_leave_entitlement` (`from_years`);--> statement-breakpoint
CREATE INDEX `staff_id_idx` ON `bonuses` (`staff_id`);--> statement-breakpoint
CREATE INDEX `amount_idx` ON `bonuses` (`amount`);--> statement-breakpoint
CREATE INDEX `bonus_date_idx` ON `bonuses` (`bonus_date`);--> statement-breakpoint
CREATE INDEX `staff_id_idx` ON `deductions` (`staff_id`);--> statement-breakpoint
CREATE INDEX `amount_idx` ON `deductions` (`amount`);--> statement-breakpoint
CREATE INDEX `bonus_date_idx` ON `deductions` (`deduction_date`);--> statement-breakpoint
CREATE INDEX `name_idx` ON `department` (`name`);--> statement-breakpoint
CREATE INDEX `id_no_idx` ON `employee` (`id_no`);--> statement-breakpoint
CREATE INDEX `first_name_idx` ON `employee` (`name`);--> statement-breakpoint
CREATE INDEX `last_name_idx` ON `employee` (`father_name`);--> statement-breakpoint
CREATE INDEX `grand_father_name_idx` ON `employee` (`grand_father_name`);--> statement-breakpoint
CREATE INDEX `hire_date_idx` ON `employee` (`hire_date`);--> statement-breakpoint
CREATE INDEX `grant_expiry_idx` ON `employee_leave_grant` (`expiry_date`);--> statement-breakpoint
CREATE INDEX `name_idx` ON `employment_statuses` (`name`);--> statement-breakpoint
CREATE INDEX `leave_type_name_idx` ON `leave_type` (`name`);--> statement-breakpoint
CREATE INDEX `staff_id_idx` ON `missing_days` (`staff_id`);--> statement-breakpoint
CREATE INDEX `day_idx` ON `missing_days` (`day`);--> statement-breakpoint
CREATE INDEX `deductable_idx` ON `missing_days` (`deductable`);--> statement-breakpoint
CREATE INDEX `staff_id_idx` ON `over_time` (`staff_id`);--> statement-breakpoint
CREATE INDEX `amount_idx` ON `over_time` (`total`);--> statement-breakpoint
CREATE INDEX `date_idx` ON `over_time` (`date`);--> statement-breakpoint
CREATE INDEX `name_idx` ON `penality` (`name`);--> statement-breakpoint
CREATE INDEX `rate_idx` ON `penality` (`rate`);--> statement-breakpoint
CREATE INDEX `name_idx` ON `position` (`name`);--> statement-breakpoint
CREATE INDEX `staff_id_idx` ON `salaries` (`staff_id`);--> statement-breakpoint
CREATE INDEX `transportation_allowance_idx` ON `salaries` (`transportation_allowance`);--> statement-breakpoint
CREATE INDEX `housing_allowance_idx` ON `salaries` (`housing_allowance`);--> statement-breakpoint
CREATE INDEX `non_tax_allowance_idx` ON `salaries` (`non_tax_allowance`);--> statement-breakpoint
CREATE INDEX `position_allowance_idx` ON `salaries` (`position_allowance`);--> statement-breakpoint
CREATE INDEX `amount_idx` ON `salaries` (`amount`);--> statement-breakpoint
CREATE INDEX `start_date_idx` ON `salaries` (`start_date`);--> statement-breakpoint
CREATE INDEX `end_date_idx` ON `salaries` (`end_date`);--> statement-breakpoint
CREATE INDEX `accountDetail_idx` ON `staff_accounts` (`account_detail`);--> statement-breakpoint
CREATE INDEX `is_active_idx` ON `staff_accounts` (`is_active`);--> statement-breakpoint
CREATE INDEX `name_idx` ON `tax_type` (`name`);--> statement-breakpoint
CREATE INDEX `threshold_idx` ON `tax_type` (`threshold`);--> statement-breakpoint
CREATE INDEX `rate_idx` ON `tax_type` (`rate`);--> statement-breakpoint
CREATE INDEX `deduction_idx` ON `tax_type` (`deduction`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `tax_type` (`status`);