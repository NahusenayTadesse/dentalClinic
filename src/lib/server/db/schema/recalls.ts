// recalls.ts - Bringing patients back.
import { mysqlTable, mysqlEnum, varchar, int, date, datetime, index } from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';
import { secureFields } from './secureFields';
import { branchRef } from './branches';
import { patient } from './patients';
import { appointment, appointmentType } from './scheduling';

/**
 * A patient who is due to come back, and has not booked yet.
 *
 * The distinction that makes this a table rather than a flag: a **reminder** goes to someone who
 * already has an appointment and exists to stop them missing it — that is
 * `appointment.reminderSentAt`. A **recall** goes to someone with no appointment at all, and its
 * job is to get one made. They are different rows because they are different conversations.
 *
 * Worth building for a cash clinic in particular. Retention runs above 85% in practices with a
 * working recall system and below 60% without one, and bringing back a patient the clinic has
 * already treated costs a fraction of finding a new one — which matters most where the marketing
 * budget is nothing and the competition is the clinic down the road.
 *
 * `dueOn` is the whole query surface: "who is due this month, and who is overdue and has not
 * been called". Indexed with `status` for exactly that.
 *
 * Non-goal: this does not send anything. What was sent and when is `lastContactedAt` and
 * `contactAttempts`; the sending is the app's problem, and the channel is whatever the patient
 * has in `patient_contacts` — a phone call for most, Telegram for some.
 */
export const recall = mysqlTable(
	'recall',
	{
		id: int('id').primaryKey().autoincrement(),

		patientId: int('patient_id')
			.notNull()
			.references(() => patient.id, { onDelete: 'cascade' }),

		/**
		 * What they are being called back for. `set null` rather than cascade: retiring a type
		 * should not quietly delete the list of people waiting to be invited for it.
		 */
		appointmentTypeId: int('appointment_type_id').references(() => appointmentType.id, {
			onDelete: 'set null'
		}),

		branchId: branchRef(),

		/** The date the patient becomes due. The column every recall query sorts and filters on. */
		dueOn: date('due_on', { mode: 'string' }).notNull(),

		/** What this recall follows — the visit that set the interval running. */
		lastVisitOn: date('last_visit_on', { mode: 'string' }),

		/**
		 * `due`       — waiting, not yet contacted or not yet booked
		 * `booked`    — an appointment exists; `scheduledAppointmentId` says which
		 * `completed` — the patient came
		 * `declined`  — they were asked and said no. Kept rather than deleted, because a patient
		 *               who declines twice should stop being called a third time.
		 * `stopped`   — the clinic ended it: moved away, died, transferred.
		 */
		status: mysqlEnum('status', ['due', 'booked', 'completed', 'declined', 'stopped'])
			.notNull()
			.default('due'),

		/** The appointment that answered this recall, closing the loop. */
		scheduledAppointmentId: int('scheduled_appointment_id').references(() => appointment.id, {
			onDelete: 'set null'
		}),

		/**
		 * When someone last tried, and how many times. Two columns rather than a contact log,
		 * because the questions a clinic actually asks are "has anyone called this person" and
		 * "have we already tried three times" — and a log table would be a row per phone call
		 * that nobody reads, on a database where row count is a hosting cost.
		 */
		lastContactedAt: datetime('last_contacted_at'),
		contactAttempts: int('contact_attempts').notNull().default(0),

		note: varchar('note', { length: 255 }),

		...secureFields
	},
	(table) => [
		// "Who is due, oldest first" — the list the front desk works through.
		index('recall_status_due_idx').on(table.status, table.dueOn),
		index('recall_patient_idx').on(table.patientId),
		index('recall_branch_due_idx').on(table.branchId, table.dueOn)
	]
);

export const recallRelations = relations(recall, ({ one }) => ({
	patient: one(patient, { fields: [recall.patientId], references: [patient.id] }),
	appointmentType: one(appointmentType, {
		fields: [recall.appointmentTypeId],
		references: [appointmentType.id]
	}),
	scheduledAppointment: one(appointment, {
		fields: [recall.scheduledAppointmentId],
		references: [appointment.id]
	})
}));
