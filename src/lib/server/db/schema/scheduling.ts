// scheduling.ts - Chairs, and who is in them when.
import {
	mysqlTable,
	mysqlEnum,
	varchar,
	int,
	datetime,
	boolean,
	unique,
	index,
	type AnyMySqlColumn
} from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';
import { secureFields } from './secureFields';
import { branchRef } from './branches';
import { user } from './user';
import { patient } from './patients';
import { services } from './services';
import { employee } from './staff';
import { provider } from './providers';

/**
 * What a visit is for — check-up, scaling, extraction, review.
 *
 * A table rather than an enum because the list is a clinic's own vocabulary and grows with what
 * it offers: a practice that starts doing implants adds a type, and a practice that never does
 * orthodontics should not see one in the picker.
 *
 * It is more than a label, and that is the reason it earns a table:
 *
 *   - `defaultMinutes` is the duration the front desk gets for free. Picking "Extraction" should
 *     set the slot, because the person booking is not the person who knows how long an
 *     extraction takes.
 *   - `colour` paints the appointment in the day view, and **supersedes the provider's colour**
 *     when both are set. Colouring by what is happening is usually more useful than colouring by
 *     who is doing it, so the type wins; a clinic that prefers the other reading just leaves
 *     this null.
 *   - `appointment_type_services` below pre-loads the work a type implies.
 *
 * Non-goal: the blockout rules established systems attach to a type — which parts of the diary a
 * type may be booked into. That needs a scheduling-template layer this app does not have, and
 * inventing half of one here would be worse than leaving the front desk to use its judgement.
 */
export const appointmentType = mysqlTable('appointment_type', {
	id: int('id').primaryKey().autoincrement(),
	name: varchar('name', { length: 80 }).notNull().unique(),

	/** Slot length this type suggests. The booker can still override it on the appointment. */
	defaultMinutes: int('default_minutes').notNull().default(30),

	/** Hex, for the day view. Wins over `provider.colour` — see above. */
	colour: varchar('colour', { length: 7 }),

	description: varchar('description', { length: 255 }),
	sortOrder: int('sort_order').notNull().default(0),

	...secureFields
});

/**
 * The work an appointment type implies, so that choosing "Root canal" offers the root canal
 * rather than leaving someone to remember it.
 *
 * Suggestions, not requirements. Established systems distinguish attached procedures from
 * *required* ones with "at least one" and "all" semantics; that machinery exists to enforce
 * insurance-claim completeness, which is not a pressure here, and a clinic that has to fight the
 * booking screen stops using the types at all.
 */
export const appointmentTypeServices = mysqlTable(
	'appointment_type_services',
	{
		id: int('id').primaryKey().autoincrement(),
		appointmentTypeId: int('appointment_type_id')
			.notNull()
			.references(() => appointmentType.id, { onDelete: 'cascade' }),
		serviceId: int('service_id')
			.notNull()
			.references(() => services.id, { onDelete: 'cascade' }),
		...secureFields
	},
	(table) => [
		unique('appointment_type_service_unique').on(table.appointmentTypeId, table.serviceId)
	]
);

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
		 * Nurse or assistant, where a clinic tracks one. An `employee`, deliberately, and not a
		 * `provider`: this column asks who assisted, which is orthogonal to whether that person
		 * holds a licence. A nurse whose licence the clinic must track gets a provider row of
		 * their own — nothing here prevents it, and the expiry report picks them up either way —
		 * but an assistant trained on the job has no licence to record, and pointing this column
		 * at `provider` would force a hollow row for them.
		 */
		assistantId: int('assistant_id').references(() => employee.id, { onDelete: 'set null' }),

		/**
		 * What the visit is for. Null for a booking made before anyone knows — a walk-in in pain,
		 * or a slot held over the phone while the patient checks a date.
		 */
		appointmentTypeId: int('appointment_type_id').references(() => appointmentType.id, {
			onDelete: 'set null'
		}),

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

		/**
		 * When the confirmation call actually happened, and not merely that it did — `status` can
		 * already say `confirmed`. The timing is the whole value: a confirmation made three weeks
		 * out has expired by the day, one made two days out is why the patient turns up, and
		 * without the timestamp the two are the same row.
		 */
		confirmedAt: datetime('confirmed_at'),

		/**
		 * When a reminder last went out. Recorded because messages cost money here and because a
		 * patient texted twice trusts the next one less — and because without it there is no way
		 * to tell whether reminders reduce no-shows at all.
		 */
		reminderSentAt: datetime('reminder_sent_at'),

		/**
		 * Who cancelled it and when. Distinct from `updatedBy`, which any edit overwrites: "who
		 * cancelled this" is a question asked precisely when the answer is contested, and an audit
		 * column shared with every other change cannot answer it.
		 */
		cancelledAt: datetime('cancelled_at'),
		cancelledBy: varchar('cancelled_by', { length: 255 }).references(() => user.id, {
			onDelete: 'set null'
		}),

		/**
		 * The patient will come at short notice if a slot frees up.
		 *
		 * A cancellation at nine in the morning is an empty chair unless someone can be found for
		 * it, and in a clinic paid per visit an empty chair is the loss. This flag is the
		 * short-call list — the first query the front desk runs when the phone rings with a
		 * cancellation.
		 */
		isAsap: boolean('is_asap').notNull().default(false),

		/**
		 * The appointment this one replaces, when a cancelled or missed visit is rebooked.
		 *
		 * A self-reference rather than overwriting the original, so the history survives: four
		 * rows chained together say this patient has been rebooked four times, which is a fact
		 * about the patient worth seeing before the fifth slot is held for them. `set null` keeps
		 * the newer appointment when an older one is finally purged.
		 */
		rebookedFromId: int('rebooked_from_id').references((): AnyMySqlColumn => appointment.id, {
			onDelete: 'set null'
		}),

		/**
		 * Who booked it is `createdBy`, from `secureFields` — the person who created the row is
		 * the person who took the booking, and a second `bookedBy` column would be the same fact
		 * twice, free to disagree. `updatedBy` is whoever last moved it, and `cancelledBy` above
		 * is deliberately separate from both.
		 */
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
		index('appointment_status_start_idx').on(table.status, table.startsAt),
		index('appointment_type_idx').on(table.appointmentTypeId),
		// The short-call list: who can fill a slot that just opened.
		index('appointment_asap_idx').on(table.isAsap, table.startsAt)
	]
);

export const operatoryRelations = relations(operatory, ({ many }) => ({
	appointments: many(appointment)
}));

export const appointmentTypeRelations = relations(appointmentType, ({ many }) => ({
	appointments: many(appointment),
	services: many(appointmentTypeServices)
}));

export const appointmentTypeServicesRelations = relations(appointmentTypeServices, ({ one }) => ({
	appointmentType: one(appointmentType, {
		fields: [appointmentTypeServices.appointmentTypeId],
		references: [appointmentType.id]
	}),
	service: one(services, {
		fields: [appointmentTypeServices.serviceId],
		references: [services.id]
	})
}));

export const appointmentRelations = relations(appointment, ({ one }) => ({
	appointmentType: one(appointmentType, {
		fields: [appointment.appointmentTypeId],
		references: [appointmentType.id]
	}),
	patient: one(patient, { fields: [appointment.patientId], references: [patient.id] }),
	operatory: one(operatory, { fields: [appointment.operatoryId], references: [operatory.id] }),
	provider: one(provider, { fields: [appointment.providerId], references: [provider.id] })
}));
