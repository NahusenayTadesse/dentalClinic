-- Dated by the app as a UTC instant (Drizzle's datetime convention), not by the database's now(),
-- which wrote the server's local clock and read back three hours late. The table is new: an
-- install running 0033 and 0034 together has no rows to convert.
ALTER TABLE `treatment_plan_adjustment` MODIFY COLUMN `created_at` datetime NOT NULL;
