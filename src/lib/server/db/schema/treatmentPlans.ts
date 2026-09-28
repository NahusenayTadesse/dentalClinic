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
	index,
	json,
	boolean,
	datetime,
	foreignKey
} from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';
import { secureFields } from './secureFields';
import { branchRef } from './branches';
import { patient } from './patients';
import { provider } from './providers';
import { procedures } from './procedures';
import { tooth } from './teeth';
import { user } from './user';

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

		/*
		 * Calendar days, `mode: 'string'` — as a JavaScript `Date` the driver hands a day back as
		 * the server's midnight, which is the day before once converted to the clinic's time.
		 */
		presentedOn: date('presented_on', { mode: 'string' }),
		decidedOn: date('decided_on', { mode: 'string' }),

		/**
		 * Why not, when the answer was no or only partly yes.
		 *
		 * Prose, and worth more than the status on its own: "will come back after harvest", "wants
		 * a second opinion" and "cannot afford it" call for three different follow-ups, and a
		 * clinic that records only `declined` cannot tell which patient to ring in November.
		 */
		declineReason: varchar('decline_reason', { length: 255 }),

		/** How long the quote stands. Past it, `expired` is honest rather than a stale promise. */
		validUntil: date('valid_until', { mode: 'string' }),

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

/**
 * Every change made to a quote after the patient has seen it — the record that lets a presented
 * quote be corrected without the original being lost.
 *
 * **Why a ledger and not an edit.** A presented quote is what a patient was told. It used to be
 * frozen outright, which was honest and unworkable: a price agreed down in the chair, a crown
 * that turned into a root canal on the X-ray, a line quoted twice by mistake all had to become a
 * whole new plan. Now the lines may change, and each change writes a row here saying what it
 * was, what it became, why, who, and when. The lines hold the quote as it stands; this table
 * holds how it got there, and the original is those rows read backwards.
 *
 * **Kept forever.** No `deletedAt`, no `updatedAt`, and no code path that updates or deletes a
 * row. A removed line is soft-deleted and its removal is a row here, so the line and the reason
 * it went both survive. This is the business record of a price changing; `audit_log` carries the
 * same event as the security record, and neither stands in for the other.
 *
 * `lineTotalBefore`/`lineTotalAfter` are the line's total either side of the change — 0 before
 * an added line, 0 after a removed one — so the quote's original total is today's total less the
 * sum of the differences, with no replay of the changes needed.
 *
 * Changes to a **draft** are not recorded here: nobody has seen a draft, so there is nothing to
 * have changed from.
 */
export const treatmentPlanAdjustment = mysqlTable(
	'treatment_plan_adjustment',
	{
		id: int('id').primaryKey().autoincrement(),

		treatmentPlanId: int('treatment_plan_id').notNull(),

		/** The line changed. Lines are only ever soft-deleted, so this always leads somewhere. */
		treatmentPlanItemId: int('treatment_plan_item_id').notNull(),

		/**
		 * `changed` — wording, quantity or price of an existing line
		 * `added`   — a line put on the quote after it was presented
		 * `removed` — a line taken off it
		 */
		kind: mysqlEnum('kind', ['changed', 'added', 'removed']).notNull(),

		/** `{ field: [before, after] }` for the fields that moved, as `audit_log.changes`. */
		changes: json('changes'),

		lineTotalBefore: decimal('line_total_before', { precision: 10, scale: 2, mode: 'number' })
			.notNull()
			.default(0),
		lineTotalAfter: decimal('line_total_after', { precision: 10, scale: 2, mode: 'number' })
			.notNull()
			.default(0),

		/**
		 * Why. Required: "discount agreed", "X-ray showed it needs a root canal", "quoted twice"
		 * are the difference between a correction and a price quietly moving.
		 */
		reason: varchar('reason', { length: 255 }).notNull(),

		/**
		 * Made after the patient had answered. A price that moves on work they already agreed to is
		 * the change a clinic most needs to see — and to have discussed with them again.
		 */
		afterAnswer: boolean('after_answer').notNull().default(false),

		createdBy: varchar('created_by', { length: 255 }).references(() => user.id, {
			onDelete: 'set null'
		}),
		/**
		 * When, written by the app as an instant — a `datetime`, never a `timestamp` with the
		 * database's `now()` as default. That default writes the server's local clock, which Drizzle
		 * reads back as UTC, so every change made after nine at night was dated the next day
		 * (CLAUDE.md §9). No default here, so no write can take the wrong clock by leaving it out.
		 */
		createdAt: datetime('created_at').notNull()
	},
	(table) => [
		index('treatment_plan_adjustment_plan_idx').on(table.treatmentPlanId, table.id),
		/*
		 * Named by hand: the generated name for the line's key is 72 characters, over MySQL's limit
		 * of 64, and the migration failed halfway with the table already made. NO ACTION on both, so a
		 * hard delete of a plan or a line with history is refused rather than taking the history.
		 */
		foreignKey({
			name: 'tp_adjustment_plan_fk',
			columns: [table.treatmentPlanId],
			foreignColumns: [treatmentPlan.id]
		}),
		foreignKey({
			name: 'tp_adjustment_item_fk',
			columns: [table.treatmentPlanItemId],
			foreignColumns: [treatmentPlanItem.id]
		})
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
