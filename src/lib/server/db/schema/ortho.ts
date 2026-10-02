// ortho.ts - Orthodontic cases: the appliance, the adjustment visits, and the payment plan.
import {
	mysqlTable,
	mysqlEnum,
	int,
	date,
	decimal,
	text,
	varchar,
	index,
	uniqueIndex
} from 'drizzle-orm/mysql-core';
import { secureFields } from './secureFields';
import { branchRef } from './branches';
import { patient } from './patients';
import { provider } from './providers';
import { appointment } from './scheduling';
import { invoice } from './invoices';
// Relative, not `$lib/…`: drizzle-kit loads the schema without SvelteKit's aliases.
import { APPLIANCES, ORTHO_STATUSES } from '../../../orthoPlan';

/**
 * One course of orthodontic treatment. The rules — schedule, progress, instalment states — are
 * `$lib/orthoPlan.ts`'s; the writes are `server/ortho.ts`'s.
 *
 * The fee, deposit and number of instalments are what was agreed, and are not changed once
 * instalments are billed: the schedule is `ortho_instalment`'s rows, made when the case opens.
 */
export const orthoCase = mysqlTable(
	'ortho_case',
	{
		id: int('id').primaryKey().autoincrement(),
		patientId: int('patient_id')
			.notNull()
			.references(() => patient.id, { onDelete: 'cascade' }),
		/** The orthodontist. `set null`: one leaving must not take the case with them. */
		providerId: int('provider_id').references(() => provider.id, { onDelete: 'set null' }),
		branchId: branchRef(),
		appliance: mysqlEnum('appliance', APPLIANCES).notNull(),
		startedOn: date('started_on', { mode: 'string' }).notNull(),
		plannedMonths: int('planned_months').notNull(),
		totalFee: decimal('total_fee', { precision: 12, scale: 2, mode: 'number' }).notNull(),
		deposit: decimal('deposit', { precision: 12, scale: 2, mode: 'number' }).notNull().default(0),
		instalments: int('instalments').notNull().default(0),
		status: mysqlEnum('status', ORTHO_STATUSES).notNull().default('active'),
		endedOn: date('ended_on', { mode: 'string' }),
		/** The diagnosis and plan in words: "Class II div 1, crowding; non-extraction". */
		notes: text('notes'),
		...secureFields
	},
	(table) => [index('ortho_case_patient_idx').on(table.patientId)]
);

/** An adjustment visit: what was done, by whom, and when the patient comes back. */
export const orthoVisit = mysqlTable(
	'ortho_visit',
	{
		id: int('id').primaryKey().autoincrement(),
		caseId: int('case_id')
			.notNull()
			.references(() => orthoCase.id, { onDelete: 'cascade' }),
		appointmentId: int('appointment_id').references(() => appointment.id, {
			onDelete: 'set null'
		}),
		providerId: int('provider_id').references(() => provider.id, { onDelete: 'set null' }),
		visitedOn: date('visited_on', { mode: 'string' }).notNull(),
		/** "Upper 0.016 NiTi, lower 0.018 SS, class II elastics". */
		work: varchar('work', { length: 255 }).notNull(),
		/** Weeks to the next adjustment, usually four to six. */
		nextInWeeks: int('next_in_weeks'),
		note: text('note'),
		...secureFields
	},
	(table) => [index('ortho_visit_case_idx').on(table.caseId, table.visitedOn)]
);

/**
 * One payment of the plan; `n` 0 is the deposit. Billed when it falls due: `invoiceId` is then the
 * bill, and whether it is paid is that bill's status.
 */
export const orthoInstalment = mysqlTable(
	'ortho_instalment',
	{
		id: int('id').primaryKey().autoincrement(),
		caseId: int('case_id')
			.notNull()
			.references(() => orthoCase.id, { onDelete: 'cascade' }),
		n: int('n').notNull(),
		dueOn: date('due_on', { mode: 'string' }).notNull(),
		amount: decimal('amount', { precision: 12, scale: 2, mode: 'number' }).notNull(),
		invoiceId: int('invoice_id').references(() => invoice.id, { onDelete: 'set null' }),
		...secureFields
	},
	(table) => [
		uniqueIndex('ortho_instalment_case_n_unique').on(table.caseId, table.n),
		index('ortho_instalment_due_idx').on(table.dueOn)
	]
);
