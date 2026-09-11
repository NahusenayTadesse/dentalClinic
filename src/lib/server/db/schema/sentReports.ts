// sentReports.ts - A note of which report went to whom.
import { mysqlTable, varchar, int, date, datetime, timestamp, text } from 'drizzle-orm/mysql-core';

/**
 * A record that a report was produced and sent.
 *
 * **Deliberately connected to nothing.** No foreign keys, no relations, and no other table points
 * at it. That is not an oversight and should not be "fixed" later: this is a convenience log the
 * front office keeps for itself — what was sent, when, by whom and to whom — so that "did we
 * already send the monthly figures to the health bureau" has an answer without anyone searching
 * their sent mail.
 *
 * Standing apart is what makes it safe to use casually. It can be listed, edited, pruned or
 * exported without touching anything that matters; deleting a user does not disturb it; and it
 * cannot become load-bearing by accident, because nothing can join to it. `sentBy` and `sentTo`
 * are plain names for the same reason — a recipient is usually an office or a person outside the
 * clinic, and neither belongs in `user`.
 *
 * Non-goal: storing the report itself. `fileName` names what was produced, and reports in this app
 * are generated in the browser rather than kept on the server. If a copy ever needs keeping, that
 * is `patient_file` or the file store, not this.
 */
export const sentReports = mysqlTable('sent_reports', {
	id: int('id').primaryKey().autoincrement(),

	/** What the file was called — "September 2026 morbidity return.pdf". */
	fileName: varchar('file_name', { length: 255 }).notNull(),

	/** What it covered, in whatever words make it findable a year later. */
	reportAbout: varchar('report_about', { length: 255 }),

	/** Who it went to — an office, a bureau, a person. A name, not a link. */
	sentTo: varchar('sent_to', { length: 255 }),

	/** Who sent it. A name rather than a user reference, for the reason in the table note. */
	sentBy: varchar('sent_by', { length: 150 }),

	sentOn: date('sent_on').notNull(),

	note: text('note'),

	createdAt: timestamp('created_at').defaultNow().notNull(),

	/**
	 * Soft delete, without the usual `deletedBy` — that column carries a foreign key to `user`,
	 * and this table has none by design. A tidy-up here loses nothing worth attributing.
	 */
	deletedAt: datetime('deleted_at')
});
