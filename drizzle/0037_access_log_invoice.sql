-- A bill lists the treatment done, so opening or printing one is recorded like the rest of the chart.
ALTER TABLE `patient_access_log` MODIFY COLUMN `record_type` enum('summary','allergies','conditions','medications','note','prescription','file','procedure','treatmentPlan','invoice') NOT NULL;
