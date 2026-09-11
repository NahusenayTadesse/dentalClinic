// treatmentPlans.ts - What was proposed, and whether the patient said yes.
import {
	mysqlTable,
	mysqlEnum,
	varchar,
	int,
	decimal,
	date,
	text,
	index
} from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';
import { secureFields } from './secureFields';
import { branchRef } from './branches';
import { patient } from './patients';
import { provider } from './providers';

/**
 * A course of treatment presented to a patient as one decision.
 *
 * Planned work already exists as `procedures` with `status = 'planned'`. What could not be
 * recorded is the *conversation*: that a patient was shown 12,000 birr of work and said yes, or
 * no, or yes to half of it. That is not derivable from the procedures — a declined plan and a
 * plan never presented look identical from the chart, and the difference between them is the
 * single most useful thing a clinic can know about itself.
 *
 * Case acceptance — what share of presented work gets agreed — is the standard measure, and it is
 * the one number that separates a clinic losing income to hesitancy from one losing it to price.
 * Neither is fixable without seeing which it is.
 *
 * **`estimatedTotal` is frozen at presentation and is deliberately not the sum of the linked
 * procedures.** They answer different questions: this is what the patient was quoted, the sum is
 * what the work costs today. Re-pricing a crown next year must not change what somebody was told
 * last March, for the same reason an issued invoice does not rewrite itself — and unlike the
 * invoice, here the two numbers are *meant* to drift, because the gap between them is a price
 * change the clinic may want to see.
 */
export const treatmentPlan = mysqlTable(
	'treatment_plan',
	{
		id: int('id').primaryKey().autoincrement(),

		patientId: int('patient_id')
			.notNull()
			.references(() => patient.id, { onDelete: 'cascade' }),

		/** Who proposed it. `set null` — a clinician leaving does not erase what they recommended. */
		providerId: int('provider_id').references(() => provider.id, { onDelete: 'set null' }),

		branchId: branchRef(),

		/**
		 * `draft`     — being assembled, not yet shown to anybody
		 * `presented` — shown, no answer yet. The state that matters: a plan sitting here is work
		 *               the clinic could do and money it has not been told it cannot have
		 * `accepted`  — agreed in full
		 * `partial`   — agreed in part, which is the common answer and would be lost if the only
		 *               options were yes and no
		 * `declined`  — refused
		 * `expired`   — quoted long enough ago that the prices no longer stand
		 * `completed` — the agreed work is done
		 */
		status: mysqlEnum('status', [
			'draft',
			'presented',
			'accepted',
			'partial',
			'declined',
			'expired',
			'completed'
		])
			.notNull()
			.default('draft'),

		presentedOn: date('presented_on'),
		decidedOn: date('decided_on'),

		/**
		 * Why not, when the answer was no or only partly yes.
		 *
		 * Prose, and worth more than the status on its own: "will come back after harvest" and
		 * "wants a second opinion" and "cannot afford it" call for three different follow-ups, and
		 * a clinic that records only `declined` cannot tell which patient to ring in November.
		 */
		declineReason: varchar('decline_reason', { length: 255 }),

		/** What the patient was quoted. Frozen at presentation — see the note above. */
		estimatedTotal: decimal('estimated_total', { precision: 10, scale: 2, mode: 'number' }),

		/** How long the quote stands. Past it, `expired` is honest rather than a stale promise. */
		validUntil: date('valid_until'),

		note: text('note'),

		...secureFields
	},
	(table) => [
		// The follow-up list: everything presented and still unanswered, oldest first.
		index('treatment_plan_status_idx').on(table.status, table.presentedOn),
		index('treatment_plan_patient_idx').on(table.patientId)
	]
);

export const treatmentPlanRelations = relations(treatmentPlan, ({ one }) => ({
	patient: one(patient, { fields: [treatmentPlan.patientId], references: [patient.id] }),
	provider: one(provider, { fields: [treatmentPlan.providerId], references: [provider.id] })
}));
