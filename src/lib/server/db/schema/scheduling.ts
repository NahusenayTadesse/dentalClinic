// scheduling.ts - Chairs, and who is in them when.
import {
	mysqlTable,
	mysqlEnum,
	varchar,
	int,
	datetime,
	boolean,
	index
} from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';
import { secureFields } from './secureFields';
import { branchRef } from './branches';
import { patient } from './patients';
import { employee } from './staff';
import { provider } from './providers';

/**
 * A chair. "Operatory" is the term every dental system uses; "surgery" and "room" are the same
 * thing elsewhere.
 *
 * A table rather than a number on the appointment because a chair is a real, finite resource:
 * two patients cannot occupy one, and the day view is drawn as a column per chair. It is also
 * what makes a clinic's capacity a fact the system knows rather than a thing the front desk
 * remembers.
 */
export const operatory = mysqlTable(
	'operatory',
	{
		id: int('id').primaryKey().autoincrement(),
		name: varchar('name', { length: 50 }).notNull(),

		/** Chairs belong to a location. See `branchRef`. */
		branchId: branchRef(),

		/** Left-to-right order in the day view. */
		sortOrder: int('sort_order').notNull().default(0),

		...secureFields
	},
	(table) => [index('operatory_branch_idx').on(table.branchId)]
);

/**
 * One booking of one chair.
 *
 * `providerId` is **nullable**, and that is the important decision in this table. Clinics here
 * work both ways: some book a patient to a named dentist, others book the clinic and assign
 * whoever is free when the patient arrives. A required provider would force the second kind to
 * invent one at booking time and then correct it, which makes every "how many patients did this
 * dentist see" report wrong. Null means "not yet assigned" and is an honest state.
 *
 * `arrivedAt`, `seatedAt` and `dismissedAt` are the three timestamps every established dental
 * system records, and they are worth the three columns: the gaps between them are waiting time
 * and chair time, which are the two numbers a clinic can actually act on. They stay null for an
 * appointment that has not happened yet.
 *
 * Non-goal: overlapping bookings are not prevented by the database. There is no constraint that
 * expresses "no two live appointments on one chair with overlapping time ranges" — that needs a
 * range type this database does not have — so the write path owns it. The `(operatory, startsAt)`
 * index below is there to make the check cheap.
 */
export const appointment = mysqlTable(
	'appointment',
	{
		id: int('id').primaryKey().autoincrement(),

		patientId: int('patient_id')
			.notNull()
			.references(() => patient.id, { onDelete: 'cascade' }),

		/** The chair. `set null` so retiring a chair does not erase the history booked into it. */
		operatoryId: int('operatory_id').references(() => operatory.id, { onDelete: 'set null' }),

		/**
		 * The dentist. Null until assigned — see the note above.
		 *
		 * Points at `provider`, not `employee`: only someone with a provider record may be booked,
		 * so the accountant cannot end up in the day view through a mistyped id. `set null` keeps
		 * the history when a clinician's provider record is removed.
		 */
		providerId: int('provider_id').references(() => provider.id, { onDelete: 'set null' }),

		/**
		 * Nurse or assistant, where a clinic tracks one. Still an `employee`, deliberately: an
		 * assistant does not need a licence to hold an instrument, and requiring a provider record
		 * would mean inventing one for every nurse.
		 */
		assistantId: int('assistant_id').references(() => employee.id, { onDelete: 'set null' }),

		branchId: branchRef(),

		startsAt: datetime('starts_at').notNull(),

		/**
		 * Minutes, rather than the five-minute-increment pattern string established systems use to
		 * express provider and assistant time separately within one slot. That distinction pays for
		 * itself in a practice with hygienists running parallel columns; here it would be a string
		 * to parse on every render for a nuance nobody has asked for. An end time is
		 * `startsAt + durationMinutes`, which SQL can do.
		 */
		durationMinutes: int('duration_minutes').notNull().default(30),

		/**
		 * `arrived` and `inChair` exist because a walk-in is the normal case here, not an
		 * exception: the front desk creates the appointment at the moment the patient is already
		 * standing there, and the status has to be able to say so.
		 *
		 * `noShow` is kept distinct from `cancelled` on purpose — one is a patient who told you and
		 * one is a patient who did not, and telling them apart is the whole basis of deciding
		 * whether to keep booking someone.
		 */
		status: mysqlEnum('status', [
			'scheduled',
			'confirmed',
			'arrived',
			'inChair',
			'completed',
			'noShow',
			'cancelled'
		])
			.notNull()
			.default('scheduled'),

		/** Why it did not happen. Prose: the reasons do not repeat usefully enough to code. */
		cancelReason: varchar('cancel_reason', { length: 255 }),

		note: varchar('note', { length: 500 }),

		/** Drives the longer slot and the fuller history-taking a first visit needs. */
		isNewPatient: boolean('is_new_patient').notNull().default(false),

		arrivedAt: datetime('arrived_at'),
		seatedAt: datetime('seated_at'),
		dismissedAt: datetime('dismissed_at'),

		...secureFields
	},
	(table) => [
		// The day view, and the overlap check the write path runs before saving.
		index('appointment_operatory_start_idx').on(table.operatoryId, table.startsAt),
		// "What is on at this branch today" — the query behind the main screen.
		index('appointment_branch_start_idx').on(table.branchId, table.startsAt),
		index('appointment_patient_idx').on(table.patientId),
		// "Who has this dentist got today", and the no-show list.
		index('appointment_provider_start_idx').on(table.providerId, table.startsAt),
		index('appointment_status_start_idx').on(table.status, table.startsAt)
	]
);

export const operatoryRelations = relations(operatory, ({ many }) => ({
	appointments: many(appointment)
}));

export const appointmentRelations = relations(appointment, ({ one }) => ({
	patient: one(patient, { fields: [appointment.patientId], references: [patient.id] }),
	operatory: one(operatory, { fields: [appointment.operatoryId], references: [operatory.id] }),
	provider: one(provider, { fields: [appointment.providerId], references: [provider.id] })
}));
