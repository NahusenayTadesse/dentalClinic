// branches.ts - Clinic locations.
//
// **This file must not import `secureFields` or `locations`.** It sits inside an import cycle
// and is the only place that cycle can be cut.
//
// `user` carries a `branch_id`, so `user` imports this file. `secureFields` carries a
// `created_by` pointing at `user`, so it imports `user`. Every link in that loop is a lazy
// `.references(() => …)` callback and a partially-built module is fine for those — but a
// `...secureFields` spread runs the instant the module does. Let this file spread it and the
// loop becomes `secureFields -> user -> branches -> secureFields`, where the last step reads a
// binding still in its temporal dead zone. `locations` is out for the same reason: it spreads
// `lesserFields`, so importing it for an `address` foreign key would drag the same eager read
// back into the loop.
//
// The cost is the audit columns below, written out rather than spread. `user.ts` already does
// this and says why; the two files are the schema's only exceptions, and both are exceptions for
// this one reason. If `secureFields` ever gains a column, these two are what drift.
import {
	mysqlTable,
	int,
	varchar,
	date,
	datetime,
	boolean,
	timestamp
} from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';
import { user } from './user';
import { MAIN_BRANCH_ID } from './mainBranch';

/**
 * A clinic location.
 *
 * Replaces `site`, which came from the facilities business this app was repurposed from: there a
 * site was the *client's* premises and belonged to a customer, which is why it carried a
 * `customerId` and a contract start date. A branch is ours, so it carries neither.
 *
 * Most clinics have one. Everything that references a branch does so through `branchRef()`
 * below — nullable, defaulting to the main branch — so a single-branch clinic never has to think
 * about it, and opening a second location is an insert plus a picker rather than a migration
 * across every table.
 */
export const branch = mysqlTable('branch', {
	id: int('id').primaryKey().autoincrement(),
	name: varchar('name', { length: 100 }).notNull().unique(),
	phone: varchar('phone', { length: 20 }),

	/**
	 * A plain address line, not a foreign key into `address` like `patient` and `customers` use.
	 *
	 * Partly the import rule at the top of this file, and partly that the structured form earns
	 * nothing here: an address is decomposed into region, city, subcity and kebele so it can be
	 * searched and grouped across thousands of rows. There are one or two branches, and what the
	 * clinic actually needs is a line to print on a receipt.
	 */
	address: varchar('address', { length: 255 }),

	openedOn: date('opened_on'),

	// Written out rather than spread from `secureFields` — see the file header. The `.references`
	// callbacks are lazy, which is what makes them safe inside the cycle; the spread would not be.
	isActive: boolean('is_active').default(true).notNull(),
	createdBy: varchar('created_by', { length: 255 }).references(() => user.id, {
		onDelete: 'set null'
	}),
	updatedBy: varchar('updated_by', { length: 255 }).references(() => user.id, {
		onDelete: 'set null'
	}),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at')
		.default(sql`CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3)`)
		.notNull(),
	deletedAt: datetime('deleted_at'),
	deletedBy: varchar('deleted_by', { length: 255 }).references(() => user.id, {
		onDelete: 'set null'
	})
});

export { MAIN_BRANCH_ID };

/**
 * The column every branch-aware table uses.
 *
 * Nullable *and* defaulted, which reads contradictory but is deliberate:
 *
 *   - the default means a single-branch clinic never sets it, and no form needs the field
 *   - nullable means `on delete set null` is a legal rule, so deleting a branch does not
 *     cascade away the employees, money and stock recorded against it
 *
 * `restrict` would be the alternative, but a clinic closing a location should be able to without
 * first reassigning years of history.
 */
export const branchRef = () =>
	int('branch_id')
		.default(MAIN_BRANCH_ID)
		.references(() => branch.id, { onDelete: 'set null' });
