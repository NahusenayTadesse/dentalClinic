// packages.ts - Treatment packages: bundles of services at a price of their own.
import {
	mysqlTable,
	mysqlEnum,
	int,
	varchar,
	date,
	decimal,
	index,
	uniqueIndex
} from 'drizzle-orm/mysql-core';
import { secureFields } from './secureFields';
import { branchRef } from './branches';
import { patient } from './patients';
import { services } from './services';
import { invoice } from './invoices';
// Relative, not `$lib/…`: drizzle-kit loads the schema without SvelteKit's aliases.
import { PACKAGE_KINDS } from '../../../packages';

/**
 * A package the clinic offers. The rules for each kind are `$lib/packages.ts`'s; edited under
 * Clinic Setup → Treatment Packages. A retired one (`isActive` off) is no longer sold or applied,
 * and patients who bought it keep what they bought.
 */
export const treatmentPackage = mysqlTable('treatment_package', {
	id: int('id').primaryKey().autoincrement(),
	name: varchar('name', { length: 100 }).notNull(),
	kind: mysqlEnum('kind', PACKAGE_KINDS).notNull().default('bundle'),
	price: decimal('price', { precision: 12, scale: 2, mode: 'number' }).notNull(),
	/** How long a prepaid package can be used after it is sold. Null: no limit. Unused by bundles. */
	validDays: int('valid_days'),
	description: varchar('description', { length: 255 }),
	...secureFields
});

/** A service in a package, and how many of it. */
export const treatmentPackageItem = mysqlTable(
	'treatment_package_item',
	{
		id: int('id').primaryKey().autoincrement(),
		packageId: int('package_id')
			.notNull()
			.references(() => treatmentPackage.id),
		serviceId: int('service_id')
			.notNull()
			.references(() => services.id),
		quantity: int('quantity').notNull().default(1),
		...secureFields
	},
	(table) => [index('treatment_package_item_package_idx').on(table.packageId)]
);

/**
 * A prepaid package a patient bought: the bill it was sold on, and until when it can be used.
 * What is left of it is derived — its items' counts less the bill lines it has covered
 * (`invoice_line.patient_package_id`) — never a stored balance.
 */
export const patientPackage = mysqlTable(
	'patient_package',
	{
		id: int('id').primaryKey().autoincrement(),
		patientId: int('patient_id')
			.notNull()
			.references(() => patient.id, { onDelete: 'cascade' }),
		packageId: int('package_id')
			.notNull()
			.references(() => treatmentPackage.id),
		invoiceId: int('invoice_id').references(() => invoice.id, { onDelete: 'set null' }),
		branchId: branchRef(),
		soldOn: date('sold_on', { mode: 'string' }).notNull(),
		expiresOn: date('expires_on', { mode: 'string' }),
		...secureFields
	},
	(table) => [
		index('patient_package_patient_idx').on(table.patientId),
		uniqueIndex('patient_package_invoice_unique').on(table.invoiceId)
	]
);
