-- The facilities ERP's payment line items. Bills replaced them (invoice_line): work is billed, then
-- paid separately. The reports read bills now and nothing writes these.
DROP TABLE `transaction_services`;--> statement-breakpoint
DROP TABLE `transaction_supplies`;
