// labCases.ts - Work sent out to a dental laboratory, and what came back.
import {
	mysqlTable,
	mysqlEnum,
	varchar,
	int,
	smallint,
	date,
	decimal,
	text,
	index
} from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';
import { secureFields } from './secureFields';
import { branchRef } from './branches';
import { patient } from './patients';
import { provider } from './providers';
import { services } from './services';
import { tooth } from './teeth';
import { procedures } from './procedures';

/**
 * A laboratory the clinic sends work to.
 *
 * A table rather than a name typed onto each case, because a clinic works with two or three and
 * retypes the phone number every time otherwise. `typicalTurnaroundDays` is the field that makes
 * it useful at the moment of booking: the patient asks when their crown will be ready, and the
 * honest answer depends on which lab it is going to.
 *
 * That matters more here than in a city practice. Most laboratories are in Addis Ababa, so a
 * clinic anywhere else is sending work by bus or courier, and the promised turnaround and the
 * real one are different numbers. Recording both — `typicalTurnaroundDays` against what
 * `lab_case` actually measures — is how a clinic finds out which lab to keep using.
 */
export const dentalLab = mysqlTable('dental_lab', {
	id: int('id').primaryKey().autoincrement(),
	name: varchar('name', { length: 120 }).notNull().unique(),
	phone: varchar('phone', { length: 20 }),
	/** A line, not a foreign key — same reasoning as `branch.address`. */
	address: varchar('address', { length: 255 }),
	contactPerson: varchar('contact_person', { length: 100 }),
	/** What they promise. Compare against the dates on `lab_case` to learn what they deliver. */
	typicalTurnaroundDays: int('typical_turnaround_days'),
	notes: varchar('notes', { length: 255 }),
	sortOrder: int('sort_order').notNull().default(0),
	...secureFields
});

/**
 * One item of work sent out and expected back — a crown, a bridge, a denture, an appliance.
 *
 * The clinic keeps the patient; the laboratory makes the thing. Until it comes back the patient
 * cannot be booked to fit it, which is why the dates here are scheduling data and not just
 * record-keeping.
 *
 * **Four dates, deliberately.** `sentOn` and `dueOn` are the promise; `receivedOn` is what
 * happened; `fittedOn` closes it. The gap between `dueOn` and `receivedOn` is the only honest
 * measure of a laboratory, and the gap between `receivedOn` and `fittedOn` is work sitting in a
 * drawer while a patient waits for a call.
 *
 * **`labFee` is what the laboratory charges, and is not what the patient pays.** The patient's
 * price is `procedures.fee` on the linked procedure. Keeping them apart is what makes the margin
 * on prosthetic work visible — in a cash business where a crown is a large share of a month's
 * takings, a clinic that cannot see that number is guessing.
 *
 * `remake` is a status rather than a new row, because a remake is the same case going round
 * again: counting remakes per laboratory is precisely how a clinic decides who to stop using.
 */
export const labCase = mysqlTable(
	'lab_case',
	{
		id: int('id').primaryKey().autoincrement(),

		patientId: int('patient_id')
			.notNull()
			.references(() => patient.id, { onDelete: 'cascade' }),

		/** `restrict`: a case in transit must not lose the laboratory it is at. */
		labId: int('lab_id')
			.notNull()
			.references(() => dentalLab.id),

		/**
		 * The treatment this is for. Null while the case is being prepared before the procedure is
		 * charted, and `set null` so a corrected chart does not erase a case that is out at a lab.
		 */
		procedureId: int('procedure_id').references(() => procedures.id, { onDelete: 'set null' }),

		/** What is being made, from the clinic's own catalogue rather than a second list of types. */
		serviceId: int('service_id').references(() => services.id),

		/** Who prescribed the work and will fit it. */
		providerId: int('provider_id').references(() => provider.id, { onDelete: 'set null' }),

		branchId: branchRef(),

		/** The main tooth, where there is one. Null for a full denture. */
		toothId: smallint('tooth_id').references(() => tooth.id),

		/** FDI codes for work spanning teeth — a bridge, a partial denture. */
		toothRange: varchar('tooth_range', { length: 64 }),

		/**
		 * Tooth shade — "A2", "B1", on whichever guide the clinic uses. Free text because the
		 * guides differ and a wrong shade is a remake, so what matters is recording exactly what
		 * was written on the docket.
		 */
		shade: varchar('shade', { length: 20 }),

		status: mysqlEnum('status', ['draft', 'sent', 'received', 'fitted', 'remake', 'cancelled'])
			.notNull()
			.default('draft'),

		sentOn: date('sent_on', { mode: 'string' }),
		/** What the laboratory promised. */
		dueOn: date('due_on', { mode: 'string' }),
		receivedOn: date('received_on', { mode: 'string' }),
		fittedOn: date('fitted_on', { mode: 'string' }),

		/**
		 * How many times it has gone back to the laboratory. The status says whether it is out on a
		 * remake *now*; this says how often it has been, which is the figure that decides whether
		 * a clinic keeps using a laboratory once the case is fitted and the status reads `fitted`.
		 */
		remakes: int('remakes').notNull().default(0),

		/** What the laboratory charges. `mode: 'number'` per CLAUDE.md §9. */
		labFee: decimal('lab_fee', { precision: 10, scale: 2, mode: 'number' }),

		/** The docket: what the technician is being asked to make, and how. */
		instructions: text('instructions'),

		...secureFields
	},
	(table) => [
		// "What is out at a lab, and what is overdue" — the board the clinic works from.
		index('lab_case_status_due_idx').on(table.status, table.dueOn),
		index('lab_case_patient_idx').on(table.patientId),
		index('lab_case_lab_idx').on(table.labId),
		index('lab_case_procedure_idx').on(table.procedureId)
	]
);

export const dentalLabRelations = relations(dentalLab, ({ many }) => ({
	cases: many(labCase)
}));

export const labCaseRelations = relations(labCase, ({ one }) => ({
	patient: one(patient, { fields: [labCase.patientId], references: [patient.id] }),
	lab: one(dentalLab, { fields: [labCase.labId], references: [dentalLab.id] }),
	procedure: one(procedures, { fields: [labCase.procedureId], references: [procedures.id] }),
	service: one(services, { fields: [labCase.serviceId], references: [services.id] }),
	provider: one(provider, { fields: [labCase.providerId], references: [provider.id] }),
	tooth: one(tooth, { fields: [labCase.toothId], references: [tooth.id] })
}));
