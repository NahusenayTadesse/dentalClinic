import { describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/mysql2';
import { and, asc, eq, isNull } from 'drizzle-orm';

import { allergen, city, region, educationalLevel } from './db/schema';

/**
 * The SQL `contentCrud` builds for a lookup list.
 *
 * The factory awaits its own query, so it cannot be run without a database. What can be pinned
 * down without one is the shape it assembles, and that shape carries three decisions worth
 * protecting:
 *
 *   1. with no references it is a plain `select()`, unchanged from before references existed
 *   2. with one, the projection is **flat** — every column of the table plus one joined name.
 *      A bare joined `select()` would nest into `{ city: {...}, region: {...} }`, which the
 *      table components cannot read
 *   3. `notDeleted` on the joined table sits in the `ON`, never the `WHERE`. In the `WHERE` a
 *      left join silently behaves like an inner one, and a city whose region was deleted would
 *      vanish from the list rather than losing its region name (CLAUDE.md §9)
 *
 * These mirror `load` rather than calling it. That is a real limitation — a change to `load`
 * that is not made here would go unnoticed — so they are written to read like the source.
 */
const db = drizzle.mock();

/**
 * The projection as Drizzle's `select()` wants it. A table spread carries more than columns at the
 * type level, so the cast is named here once rather than at each call (CLAUDE.md §3).
 */
type Projection = Parameters<typeof db.select>[0];

const listSql = (projection?: Record<string, unknown>) => {
	const fields = projection as Projection;
	let q = (fields ? db.select(fields) : db.select()).from(city).$dynamic();
	q = q.leftJoin(region, and(eq(region.id, city.regionId), isNull(region.deletedAt)));
	return q.where(isNull(city.deletedAt)).orderBy(asc(city.id)).toSQL().sql;
};

describe('contentCrud list query', () => {
	it('selects every column of the table, flat, plus the joined name', () => {
		const sql = listSql({ ...city, region: region.name });

		for (const column of [
			'`city`.`id`',
			'`city`.`name`',
			'`city`.`region_id`',
			'`city`.`status`'
		]) {
			expect(sql).toContain(column);
		}
		expect(sql).toContain('`region`.`name`');
	});

	it('filters the joined table in the ON clause, not the WHERE', () => {
		const sql = listSql({ ...city, region: region.name });
		const on = sql.slice(sql.indexOf('left join'), sql.indexOf('where'));

		// A city whose region was deleted must keep its row and lose only the name.
		expect(on).toContain('`region`.`deleted_at` is null');
		expect(sql.slice(sql.indexOf('where'))).not.toContain('`region`.`deleted_at`');
	});

	it('always excludes deleted rows of the table itself', () => {
		expect(listSql()).toContain('`city`.`deleted_at` is null');
	});

	/*
	 * The read half of the `status`/`isActive` rename. Without it every screen on a `secureFields`
	 * table showed "Inactive" for every row — twelve active allergens read as thirteen inactive —
	 * and the edit dialog then saved that `false` back, switching rows off on an unrelated save.
	 */
	it('aliases isActive to status for tables that call it that', () => {
		const projection: Record<string, unknown> = { ...allergen, status: allergen.isActive };
		const sql = db
			.select(projection as Projection)
			.from(allergen)
			.toSQL().sql;

		// The column is selected twice — once under its own name, once as the alias the row is
		// keyed by — which is exactly what makes `row.status` exist for a `secureFields` table.
		expect(sql.split('`is_active`').length - 1).toBe(2);
		expect(Object.keys(projection)).toContain('status');
	});

	it('spreads a Drizzle table to exactly its columns', () => {
		// The flat projection relies on this: Drizzle keeps its internals on symbols, which
		// object spread does not copy. If that ever changed, the projection would carry junk.
		const keys = Object.keys({ ...educationalLevel });
		expect(keys).toContain('id');
		expect(keys).toContain('name');
		expect(keys.every((k) => !k.startsWith('_'))).toBe(true);
	});
});

describe('childCrud scoping', () => {
	it('narrows a child list to one owner and excludes deleted rows', () => {
		// What `childCrud.load` builds: the owner predicate is not optional.
		const sql = db
			.select()
			.from(city)
			.where(and(eq(city.regionId, 7), isNull(city.deletedAt)))
			.orderBy(asc(city.id))
			.toSQL();

		expect(sql.sql).toContain('`city`.`region_id` = ?');
		expect(sql.sql).toContain('`city`.`deleted_at` is null');
		expect(sql.params).toContain(7);
	});
});
