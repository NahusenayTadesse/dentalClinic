-- An extraction leaves a gap on the dental chart; this is the flag that says which services do.
ALTER TABLE `services` ADD `removes_tooth` boolean DEFAULT false NOT NULL;