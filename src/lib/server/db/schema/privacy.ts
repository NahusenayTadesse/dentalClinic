// privacy.ts - The breach log the data protection proclamation expects a clinic to keep.
import { mysqlTable, mysqlEnum, int, date, text, varchar } from 'drizzle-orm/mysql-core';
import { secureFields } from './secureFields';

/**
 * A personal-data breach: a laptop stolen, a chart left on the bus, a message sent to the wrong
 * patient, an account used by someone it did not belong to. The Personal Data Protection
 * Proclamation (No. 1321/2024) expects a clinic to record each one, what it did about it, and
 * whether and when it told the authority and the people affected — so the log is kept even for
 * the ones that turn out to matter little.
 *
 * Edited under Admin Panel → Breach Log. `isActive` is "still open"; closing one is unticking it.
 */
export const dataBreach = mysqlTable('data_breach', {
	id: int('id').primaryKey().autoincrement(),
	/** One line, for the list: "Reception laptop stolen". */
	title: varchar('title', { length: 150 }).notNull(),
	discoveredOn: date('discovered_on', { mode: 'string' }).notNull(),
	occurredOn: date('occurred_on', { mode: 'string' }),
	severity: mysqlEnum('severity', ['low', 'medium', 'high']).notNull().default('medium'),
	/** What happened, and what personal data it touched. */
	description: text('description').notNull(),
	/** How many people's data, as near as is known. */
	peopleAffected: int('people_affected'),
	/** What was done to stop it and stop it happening again. */
	actions: text('actions'),
	reportedOn: date('reported_on', { mode: 'string' }),
	notifiedOn: date('notified_on', { mode: 'string' }),
	...secureFields
});
