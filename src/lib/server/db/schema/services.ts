// services.ts - Handles services and their categories (suggested new category for service offerings)
import { mysqlTable, varchar, int, decimal } from 'drizzle-orm/mysql-core';
import { lesserFields, secureFields } from './secureFields';

export const serviceCategories = mysqlTable('service_categories', {
	id: int('id').autoincrement().primaryKey(),
	name: varchar('name', { length: 50 }).notNull().unique(),
	description: varchar('description', { length: 255 }),
	...lesserFields
});

export const services = mysqlTable('services', {
	id: int('id').primaryKey().autoincrement(),
	name: varchar('name', { length: 50 }).notNull().unique(),
	categoryId: int('category_id').references(() => serviceCategories.id, { onDelete: 'set null' }),
	description: varchar('description', { length: 255 }),
	...lesserFields
});
