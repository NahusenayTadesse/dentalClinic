// Clinic locations.
import { mysqlTable, int, varchar, date } from 'drizzle-orm/mysql-core';
import { secureFields } from './secureFields';
import { address } from './locations';
import { MAIN_BRANCH_ID } from './mainBranch';

/**
 * A clinic location.
 *
 * Replaces `site`, which came from the facilities business this app was repurposed from: there
 * a site was the *client's* premises and belonged to a customer, which is why it carried a
 * `customerId` and a contract start date. A branch is ours, so it carries neither.
 *
 * Most clinics have one. Everything that references a branch does so through `branchRef()`
 * below — nullable, defaulting to the main branch — so a single-branch clinic never has to
 * think about it, and opening a second location is an insert plus a picker rather than a
 * migration across every table.
 */
export const branch = mysqlTable('branch', {
	id: int('id').primaryKey().autoincrement(),
	name: varchar('name', { length: 100 }).notNull().unique(),
	phone: varchar('phone', { length: 20 }),
	address: int('address').references(() => address.id, { onDelete: 'set null' }),
	openedOn: date('opened_on'),
	...secureFields
});


/**
 * The column every branch-aware table uses.
 *
 * Nullable *and* defaulted, which reads contradictory but is deliberate:
 *
 *   - the default means a single-branch clinic never sets it, and no form needs the field
 *   - nullable means `on delete set null` is a legal rule, so deleting a branch does not
 *     cascade away the employees, money and stock recorded against it
 *
 * `restrict` would be the alternative, but a clinic closing a location should be able to
 * without first reassigning years of history.
 */
export { MAIN_BRANCH_ID };

export const branchRef = () =>
	int('branch_id')
		.default(MAIN_BRANCH_ID)
		.references(() => branch.id, { onDelete: 'set null' });
