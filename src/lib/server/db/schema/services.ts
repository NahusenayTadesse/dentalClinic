// services.ts - What the clinic does for patients, and what it charges for it.
import { mysqlTable, mysqlEnum, varchar, int, decimal, boolean } from 'drizzle-orm/mysql-core';
import { lesserFields } from './secureFields';
// Relative, not `$lib/…`: drizzle-kit loads the schema without SvelteKit's aliases.
import { SERVICE_AREAS } from '../../../serviceAreas';

export const serviceCategories = mysqlTable('service_categories', {
	id: int('id').autoincrement().primaryKey(),
	name: varchar('name', { length: 50 }).notNull().unique(),
	description: varchar('description', { length: 255 }),
	...lesserFields
});

/**
 * The clinic's catalogue of treatments: what a procedure is, and its standard fee.
 *
 * **`price` is the list price, not what anyone was charged.** A procedure copies it into its own
 * `fee` when it is charted, and an invoice line copies that again when it is issued. Changing a
 * price here therefore never moves a quote already given or a bill already printed. It only
 * changes what the next procedure starts from. Nullable, because some work has no standard fee:
 * orthodontics is quoted case by case, and a made-up default would be copied onto every quote as
 * though somebody had decided it.
 *
 * `name` was 50 characters, which is too short for how dental work is actually described: "Root
 * canal treatment, molar (three canals)" is 42 before anyone adds a material.
 */
export const services = mysqlTable('services', {
	id: int('id').primaryKey().autoincrement(),
	name: varchar('name', { length: 120 }).notNull().unique(),
	categoryId: int('category_id').references(() => serviceCategories.id, { onDelete: 'set null' }),
	description: varchar('description', { length: 255 }),
	/** Standard fee in birr. `mode: 'number'` per CLAUDE.md §9. */
	price: decimal('price', { precision: 10, scale: 2, mode: 'number' }),
	/** What the charting form asks for — see `$lib/serviceAreas.ts`. */
	area: mysqlEnum('area', SERVICE_AREAS).notNull().default('mouth'),
	/**
	 * The tooth is gone once this is done — an extraction. What lets the chart draw a missing tooth
	 * rather than a healthy one with an old filling on it.
	 *
	 * Charted as `existing`, it records a tooth lost before the patient came here, which is how a
	 * first examination records the gaps. A flag on the service rather than a name match: "Simple
	 * extraction" and "Surgical extraction" are two services and a third will be added one day
	 * under a name nobody predicted.
	 */
	removesTooth: boolean('removes_tooth').notNull().default(false),
	...lesserFields
});
