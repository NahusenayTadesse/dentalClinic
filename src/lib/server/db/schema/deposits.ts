// deposits.ts - Money a patient pays before there is a bill for it.
import { mysqlTable, int, varchar, index, uniqueIndex } from 'drizzle-orm/mysql-core';
import { secureFields } from './secureFields';
import { patient } from './patients';
import { transactions } from './finance';

/**
 * A deposit: a payment taken from a patient with no bill yet — towards a crown, before the lab
 * makes it. The money is an ordinary receipted `transactions` row, through the drawer like any
 * payment; this row says it is a deposit and whose. Applying it to a bill later is an
 * `invoice_payment` row pointing at the same transaction, so what is left of it is the payment's
 * amount less what has been applied (`server/deposits.ts`) — never a stored balance.
 */
export const patientDeposit = mysqlTable(
	'patient_deposit',
	{
		id: int('id').primaryKey().autoincrement(),
		patientId: int('patient_id')
			.notNull()
			.references(() => patient.id, { onDelete: 'cascade' }),
		transactionId: int('transaction_id')
			.notNull()
			.references(() => transactions.id),
		/** What it is towards: "Crown on 36". */
		note: varchar('note', { length: 255 }),
		...secureFields
	},
	(table) => [
		uniqueIndex('patient_deposit_transaction_unique').on(table.transactionId),
		index('patient_deposit_patient_idx').on(table.patientId)
	]
);
