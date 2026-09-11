// cashSessions.ts - Counting the drawer at the end of the day.
import {
	mysqlTable,
	mysqlEnum,
	varchar,
	int,
	decimal,
	datetime,
	text,
	index
} from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';
import { secureFields } from './secureFields';
import { branchRef } from './branches';
import { user } from './user';

/**
 * One shift at the front desk, from opening the drawer to counting it.
 *
 * The control a cash business cannot operate without. Almost every birr this clinic takes is
 * physical, handed across a desk, and the only thing standing between that and quiet loss is
 * somebody counting the money at the end of the day and comparing it to what the system says
 * was taken. A discrepancy is not necessarily theft — a wrong change, a payment entered twice, a
 * receipt never rung up — but it is always worth knowing the same evening rather than at the
 * year's audit.
 *
 * **`expectedAmount` is a snapshot taken at close, not a live sum.** That is the whole point of
 * storing it. If the expected figure were recomputed on demand, then a payment backdated into a
 * closed session would quietly move the variance of a day that was already reconciled and
 * signed off, and the one number the reconciliation exists to produce would be the one number
 * that cannot be trusted. What the drawer was believed to hold at the moment it was counted is a
 * historical fact, so it is written down.
 *
 * `variance` is deliberately *not* stored: it is `countedAmount - expectedAmount`, both of which
 * are already frozen, so it cannot drift and a stored copy could only disagree.
 *
 * Non-goal: multiple drawers per branch per shift. A clinic with two receptionists on one till
 * reconciles one session; if that ever stops being true, the session grows a name, not a
 * redesign.
 */
export const cashSession = mysqlTable(
	'cash_session',
	{
		id: int('id').primaryKey().autoincrement(),

		branchId: branchRef(),

		/** Money in the drawer before trading — the float carried over. */
		openingFloat: decimal('opening_float', { precision: 10, scale: 2, mode: 'number' })
			.notNull()
			.default(0),

		openedAt: datetime('opened_at').notNull(),
		openedBy: varchar('opened_by', { length: 255 }).references(() => user.id, {
			onDelete: 'set null'
		}),

		closedAt: datetime('closed_at'),
		closedBy: varchar('closed_by', { length: 255 }).references(() => user.id, {
			onDelete: 'set null'
		}),

		/** What was physically counted. Null until someone counts it. */
		countedAmount: decimal('counted_amount', { precision: 10, scale: 2, mode: 'number' }),

		/** What the system believed was in the drawer, frozen at the moment of counting. */
		expectedAmount: decimal('expected_amount', { precision: 10, scale: 2, mode: 'number' }),

		/**
		 * What was taken out and banked or handed on, so the next session's float is not the whole
		 * day's takings sitting in a drawer overnight.
		 */
		bankedAmount: decimal('banked_amount', { precision: 10, scale: 2, mode: 'number' }),

		status: mysqlEnum('status', ['open', 'closed']).notNull().default('open'),

		/** Why the count differs. The field that makes a variance useful rather than alarming. */
		note: text('note'),

		...secureFields
	},
	(table) => [
		// "Is there a session open at this branch?" — asked before every cash payment.
		index('cash_session_branch_status_idx').on(table.branchId, table.status),
		index('cash_session_opened_idx').on(table.openedAt)
	]
);

export const cashSessionRelations = relations(cashSession, ({ one }) => ({
	openedByUser: one(user, { fields: [cashSession.openedBy], references: [user.id] }),
	closedByUser: one(user, { fields: [cashSession.closedBy], references: [user.id] })
}));
