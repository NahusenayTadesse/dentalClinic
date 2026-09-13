/**
 * Getting an id back from an insert — the one write the three target engines spell differently.
 *
 * MySQL and MariaDB have no `RETURNING`, so Drizzle offers `$returningId()`, which reads the
 * driver's `insertId`. Postgres and SQLite have `RETURNING` and no `$returningId()`. A route that
 * calls either directly is a line to find and rewrite on a port (CLAUDE.md §10); a route that
 * calls `insertReturningId` is not. `PORTABILITY.md` carries the fourteen older call sites that
 * still reach for `$returningId()` themselves.
 *
 * Non-goal: multi-row inserts. `$returningId()` gives back one id per row on MySQL only when the
 * ids are contiguous, which is an auto-increment detail no caller should lean on. Insert rows one
 * at a time when each id matters.
 */
import type { MySqlTable } from 'drizzle-orm/mysql-core';
import type { db } from '$lib/server/db';

/** The database or a transaction on it — both can insert. */
type Writer = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Inserts one row and returns its new id.
 *
 *     const id = await insertReturningId(tx, patient, values);
 *
 * `values` is typed loosely because callers assemble rows at runtime — `childCrud` builds one from
 * form data — and Drizzle's insert type cannot be named generically over an arbitrary table.
 */
export async function insertReturningId(
	writer: Writer,
	table: MySqlTable,
	values: Record<string, unknown>
): Promise<number> {
	const [row] = await writer
		.insert(table)
		.values(values as never)
		.$returningId();

	/*
	 * `$returningId()` keys the id by the primary key's property name, which is `id` on every
	 * audited table. Read it without assuming the key so a table keyed otherwise fails loudly here
	 * rather than writing `undefined` into an audit row.
	 */
	const id = Object.values((row ?? {}) as Record<string, unknown>)[0];
	if (typeof id !== 'number') throw new Error('insertReturningId: the insert returned no id');

	return id;
}
