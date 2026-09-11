// procedures.ts - What was done, to which tooth, by whom.
import {
	mysqlTable,
	mysqlEnum,
	varchar,
	int,
	smallint,
	decimal,
	date,
	check,
	index
} from 'drizzle-orm/mysql-core';
import { relations, sql } from 'drizzle-orm';
import { secureFields } from './secureFields';
import { branchRef } from './branches';
import { patient } from './patients';
import { provider } from './providers';
import { services } from './services';
import { tooth } from './teeth';
import { appointment } from './scheduling';

/**
 * One procedure: planned, done, or found already present.
 *
 * The table is `procedures`, plural, and that is not a style choice: `PROCEDURE` is a reserved
 * word in MySQL and MariaDB, so `SELECT ... FROM procedure` is a syntax error unless every
 * mention is backticked. Drizzle quotes identifiers and would never have noticed, but this repo
 * writes raw `sql` fragments in the reports layer, and the failure would have surfaced there as
 * an unexplained syntax error long after anyone remembered why. The plural is not reserved.
 *
 * The central clinical table. Everything a dentist does to a patient is a row here, and the
 * odontogram, the treatment plan, the day sheet and the bill are all views over it.
 *
 * **A plan and a completed treatment are the same row at two statuses**, not two tables. Every
 * established dental system works this way and it is worth copying: accepting a plan is an
 * update, so the estimate and the finished work can never disagree, and "what did we propose
 * that never happened" is a `WHERE status = 'planned'` instead of a reconciliation between two
 * tables. `existing` covers work the patient arrived with, which has to be chartable without
 * ever having been planned or billed here.
 *
 * Non-goal: this is not the bill. `transactions` and `transaction_services` own money changing
 * hands; `fee` here is what this procedure is priced at, which is what makes an unaccepted plan
 * quotable before any transaction exists.
 */
export const procedures = mysqlTable(
	'procedures',
	{
		id: int('id').primaryKey().autoincrement(),

		patientId: int('patient_id')
			.notNull()
			.references(() => patient.id, { onDelete: 'cascade' }),

		/**
		 * The visit it happened at. Null for a procedure that is only planned — the plan is made
		 * before the appointment to carry it out exists, and often before one is ever booked.
		 */
		appointmentId: int('appointment_id').references(() => appointment.id, {
			onDelete: 'set null'
		}),

		/**
		 * What was done, from the clinic's own service catalogue. `restrict`: a procedure whose
		 * service has been hard-deleted cannot say what it was, which is worse than not existing.
		 *
		 * `services` is reused rather than a dental-specific `procedure_code` table being added.
		 * It already carries name, category and soft delete, it is already what `staff_services`
		 * and `transaction_services` point at, and a second catalogue would mean pricing lived in
		 * two places. American systems key this to ADA CDT codes; those exist for insurance claims
		 * that nobody files here.
		 */
		serviceId: int('service_id')
			.notNull()
			.references(() => services.id),

		/**
		 * Who did it, or is to do it. Null on a plan not yet assigned to anyone.
		 *
		 * `provider`, not `employee` — the same reason as on `appointment`: work is attributed to
		 * someone licensed to have done it, and the database is what guarantees that rather than
		 * the form.
		 */
		providerId: int('provider_id').references(() => provider.id, { onDelete: 'set null' }),

		branchId: branchRef(),

		/**
		 * `planned`   — proposed, not yet agreed or done
		 * `completed` — done
		 * `existing`  — already in the mouth when the patient arrived, charted for the record
		 * `referred`  — sent elsewhere, so it stops appearing as outstanding work
		 * `condition` — an observation rather than a treatment: caries, a fracture, wear
		 * `cancelled` — proposed and then declined or abandoned
		 *
		 * `condition` is what makes the odontogram honest. A chart that can only show treatments
		 * cannot record the decay that has not been treated yet, which is most of what a first
		 * examination finds.
		 */
		status: mysqlEnum('status', [
			'planned',
			'completed',
			'existing',
			'referred',
			'condition',
			'cancelled'
		])
			.notNull()
			.default('planned'),

		/**
		 * The FDI code, as a foreign key into `tooth`. Null for whole-mouth work — an examination,
		 * a scale and polish, a radiograph.
		 *
		 * A foreign key and not a number, so "every procedure on a lower molar" is a join rather
		 * than a list of codes embedded in a query, and so an impossible tooth cannot be recorded.
		 */
		toothId: smallint('tooth_id').references(() => tooth.id),

		/**
		 * Which faces of the tooth were worked on, as letters from `MODBLI` — mesial, occlusal,
		 * distal, buccal, lingual, incisal. "MOD" is a three-surface filling and is written exactly
		 * that way on paper.
		 *
		 * A string rather than rows, with a CHECK constraint keeping out anything that is not a
		 * surface letter. Surfaces are only ever read together, as the shorthand a dentist already
		 * writes; "which procedures touched an occlusal surface" is not a question anyone asks,
		 * while "which procedures touched this tooth" is — and that is the foreign key above.
		 */
		surfaces: varchar('surfaces', { length: 6 }),

		/**
		 * For work spanning teeth that is one procedure rather than several — a bridge, a denture,
		 * quadrant scaling. FDI codes separated by commas. `toothId` holds the primary tooth where
		 * there is one, so the common single-tooth case stays a clean join.
		 */
		toothRange: varchar('tooth_range', { length: 64 }),

		/**
		 * `mode: 'number'` per CLAUDE.md §9 — without it Drizzle returns strings and totalling a
		 * treatment plan silently concatenates.
		 */
		fee: decimal('fee', { precision: 10, scale: 2, mode: 'number' }),

		/** When it was done. Null while planned; `createdAt` is when it was proposed. */
		completedOn: date('completed_on'),

		note: varchar('note', { length: 500 }),

		...secureFields
	},
	(table) => [
		// The chart and the outstanding-work list: every procedure for one patient, by status.
		index('procedure_patient_status_idx').on(table.patientId, table.status),
		index('procedure_appointment_idx').on(table.appointmentId),
		index('procedure_tooth_idx').on(table.toothId),
		// Production per dentist, and the day sheet.
		index('procedure_provider_completed_idx').on(table.providerId, table.completedOn),
		index('procedure_branch_completed_idx').on(table.branchId, table.completedOn),

		/**
		 * Enforced by the database rather than the form, because a stray surface letter is exactly
		 * the kind of thing that is typed once, never noticed, and then quietly excluded from every
		 * count. Empty string is rejected too: a procedure either names surfaces or leaves the
		 * column null.
		 */
		check('procedure_surfaces_valid', sql`${table.surfaces} REGEXP '^[MODBLI]{1,6}$'`)
	]
);

export const procedureRelations = relations(procedures, ({ one }) => ({
	patient: one(patient, { fields: [procedures.patientId], references: [patient.id] }),
	appointment: one(appointment, {
		fields: [procedures.appointmentId],
		references: [appointment.id]
	}),
	service: one(services, { fields: [procedures.serviceId], references: [services.id] }),
	provider: one(provider, { fields: [procedures.providerId], references: [provider.id] }),
	tooth: one(tooth, { fields: [procedures.toothId], references: [tooth.id] })
}));
