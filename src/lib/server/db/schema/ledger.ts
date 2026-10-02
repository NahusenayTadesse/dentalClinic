// ledger.ts - The clinic's chart-of-accounts codes, for the accounting export.
import { mysqlTable, int, varchar, uniqueIndex } from 'drizzle-orm/mysql-core';
import { secureFields } from './secureFields';

/**
 * Which account in the accountant's ledger each kind of money goes to: a code for each payment
 * method (its cash, bank or wallet account), each expense type, and the fixed accounts in
 * `$lib/journal.ts` (`FIXED_ACCOUNTS`). The export reads these; nothing else does.
 *
 * `target` names what is mapped — `fixed:revenue`, `paymentMethod:3`, `expenseType:5` — rather than
 * a code column on each of those tables, so the mapping is one screen and one table, and a clinic
 * with no accountant never sees an account field on its payment methods.
 */
export const ledgerAccount = mysqlTable(
	'ledger_account',
	{
		id: int('id').primaryKey().autoincrement(),
		target: varchar('target', { length: 40 }).notNull(),
		code: varchar('code', { length: 30 }).notNull(),
		...secureFields
	},
	(table) => [uniqueIndex('ledger_account_target_unique').on(table.target)]
);
