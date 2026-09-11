// treatmentPlans.ts - What was proposed, and whether the patient said yes.
import {
	mysqlTable,
	mysqlEnum,
	varchar,
	int,
	smallint,
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
import { procedures } from './procedures';
import { tooth } from './teeth';

/**
 * A course of treatment presented to a patient as one decision.
 *
 * Planned work already exists as `procedures` with `status = 'planned'`. What could not be
 * recorded is the *conversation*: that a patient was shown 12,000 birr of work and said yes, or
 * no, or yes to half of it. A declined plan and a plan never presented look identical from the
 * chart, and the difference between them is the most useful thing a clinic can know about itself.
 *
 * Case acceptance — what share of presented work gets agreed — is the standard measure, and the
 * one number that separates a clinic losing income to hesitancy from one losing it to price.
 *
 * **There is no `estimatedTotal` column, and there was.** It held the figure quoted at
 * presentation while the linked procedures stayed live and re-pricable, which was the worst of
 * both arrangements: the total could not be verified against anything, and what had actually been
 * quoted — which item, at what price — could not be reconstructed at all. A single frozen scalar
 * beside live rows is not a snapshot, it is a number with no provenance.
 *
 * `treatment_plan_item` snapshots the quote line by line, the same way `invoice_line` does and
 * for the same reason. Every total is then derived from rows that cannot silently change:
 *
 *     quoted    SUM(line_total)
 *     accepted  SUM(line_total) WHERE decision = 'accepted'
 *     declined  SUM(line_total) WHERE decision = 'declined'
 *
 * Three numbers instead of one, none of them stored, and none able to disagree with the lines
 * they came from. A plan carries a handful of items, so the sum costs nothing.
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
		 * `partial`   — agreed in part, which is the common answer
		 * `declined`  — refused
		 * `expired`   — quoted long enough ago that the prices no longer stand
		 * `completed` — the agreed work is done
		 *
		 * Kept even though `partial` is implied by the item decisions. This is the outcome of a
		 * conversation, recorded once; the items are the arithmetic. A plan can also be declined
		 * outright without anyone going through it line by line, and that is a real answer that
		 * per-item decisions alone would represent as an untouched plan.
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
		 * Prose, and worth more than the status on its own: "will come back after harvest", "wants
		 * a second opinion" and "cannot afford it" call for three different follow-ups, and a
		 * clinic that records only `declined` cannot tell which patient to ring in November.
		 */
		declineReason: varchar('decline_reason', { length: 255 }),

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

/**
 * One line of a quote, as it was quoted.
 *
 * **Snapshots, for the same reason `invoice_line` does.** The description and the price are
 * written here at presentation and never read back through the procedure, so re-pricing a crown
 * next year cannot change what a patient was told last March. The difference from an invoice is
 * only what happens next: an invoice line is a debt, this is an offer.
 *
 * `procedureId` is traceability and nothing else — which charted treatment this line was quoting,
 * `set null` so re-charting cannot orphan the quote. It is also nullable at the other end: a plan
 * can be drawn up and priced before anything is charted, which is how a consultation actually
 * runs.
 *
 * **`decision` is per line, and that is what makes partial acceptance real data.** "Yes to the
 * two fillings, not the crown" is the ordinary answer, and recording it only as a plan status
 * leaves the clinic unable to say which work to book or what the patient actually owes. With it,
 * the accepted total is a `WHERE` clause rather than a conversation somebody has to remember.
 */
export const treatmentPlanItem = mysqlTable(
	'treatment_plan_item',
	{
		id: int('id').primaryKey().autoincrement(),

		treatmentPlanId: int('treatment_plan_id')
			.notNull()
			.references(() => treatmentPlan.id, { onDelete: 'cascade' }),

		/** Traceability only. Never read to render the line — see above. */
		procedureId: int('procedure_id').references(() => procedures.id, { onDelete: 'set null' }),

		/** Snapshot. What the patient was told this line was, in the words used at the time. */
		description: varchar('description', { length: 255 }).notNull(),

		/** Which tooth, on a dental quote. A tooth cannot be re-priced, so the link is safe. */
		toothId: smallint('tooth_id').references(() => tooth.id),

		quantity: decimal('quantity', { precision: 10, scale: 2, mode: 'number' }).notNull().default(1),
		/** Snapshot. */
		unitPrice: decimal('unit_price', { precision: 10, scale: 2, mode: 'number' }).notNull(),
		/** Snapshot, stored rather than computed: quantity × price is what was on the paper. */
		lineTotal: decimal('line_total', { precision: 10, scale: 2, mode: 'number' }).notNull(),

		/**
		 * What the patient said to *this* line. `pending` until they answer, which is the honest
		 * state for everything on a plan that has been presented and not yet decided.
		 */
		decision: mysqlEnum('decision', ['pending', 'accepted', 'declined'])
			.notNull()
			.default('pending'),

		sortOrder: int('sort_order').notNull().default(0),

		...secureFields
	},
	(table) => [
		index('treatment_plan_item_plan_idx').on(table.treatmentPlanId, table.decision),
		index('treatment_plan_item_procedure_idx').on(table.procedureId)
	]
);

export const treatmentPlanRelations = relations(treatmentPlan, ({ one, many }) => ({
	patient: one(patient, { fields: [treatmentPlan.patientId], references: [patient.id] }),
	provider: one(provider, { fields: [treatmentPlan.providerId], references: [provider.id] }),
	items: many(treatmentPlanItem)
}));

export const treatmentPlanItemRelations = relations(treatmentPlanItem, ({ one }) => ({
	plan: one(treatmentPlan, {
		fields: [treatmentPlanItem.treatmentPlanId],
		references: [treatmentPlan.id]
	}),
	procedure: one(procedures, {
		fields: [treatmentPlanItem.procedureId],
		references: [procedures.id]
	}),
	tooth: one(tooth, { fields: [treatmentPlanItem.toothId], references: [tooth.id] })
}));
