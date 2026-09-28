-- A treatment plan is part of the chart, so opening or printing one is recorded like the rest.
-- Appending to an enum is metadata-only in MariaDB/MySQL: no existing row changes.
ALTER TABLE `patient_access_log` MODIFY COLUMN `record_type` enum('summary','allergies','conditions','medications','note','prescription','file','procedure','treatmentPlan') NOT NULL;
