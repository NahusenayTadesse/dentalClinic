/**
 * The shared parts of the development seed: a repeatable random generator, date helpers, and the
 * guard that keeps every step idempotent.
 *
 * Split out of `seed-dev.ts` when the seed grew past the 500-line ceiling (CLAUDE.md §6). Each
 * step lives in its own module beside this one and is called by `seed-dev.ts` in order.
 *
 * Non-goal: demo data for a customer. These rows exercise the UI; the names are deliberately
 * unreal — "Seedwell", "Probe Supplies" — so nothing here can be mistaken for a real record if it
 * ends up in a screenshot.
 */
import { count } from 'drizzle-orm';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import type { MySqlTable } from 'drizzle-orm/mysql-core';

export type SeedDb = MySql2Database<Record<string, never>>;

/**
 * mulberry32: small, seedable, and the same sequence every run.
 *
 * Determinism is the point. A count noticed on screen today has to be the same count tomorrow, or
 * a seeded database is no better than an empty one for telling whether a change broke something.
 */
export function rng(seed: number) {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** The three things every step does with a generator, bound to one. */
export function randomness(seed: number) {
	const random = rng(seed);
	return {
		random,
		pick: <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)],
		chance: (probability: number) => random() < probability,
		between: (low: number, high: number) => low + Math.floor(random() * (high - low + 1))
	};
}

/**
 * Whether a table is empty, and therefore whether its step should run.
 *
 * Every step is skipped once its table has anything in it, so `npm run db:seed` can be re-run to
 * top up what is missing without duplicating what is there. `--fresh` is what empties them.
 */
export async function isEmpty(db: SeedDb, table: MySqlTable, label: string): Promise<boolean> {
	const [{ rows }] = await db.select({ rows: count() }).from(table);
	if (rows > 0) {
		console.log(`${label} already holds ${rows} rows; skipping.`);
		return false;
	}
	return true;
}

/** A date `days` from today, as `YYYY-MM-DD` — local, never `toISOString()`'s UTC day. */
export function localDate(days = 0): string {
	const d = new Date();
	d.setDate(d.getDate() + days);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The instant `days` from now. */
export function dateAt(days = 0): Date {
	return new Date(Date.now() + days * 86_400_000);
}

/** Money as the `decimal` columns want it: a fixed-point string, never a float. */
export function money(amount: number): string {
	return amount.toFixed(2);
}
