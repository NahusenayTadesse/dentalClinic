import { describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';

import { db } from './index';
import { auditLog } from './schema';
import { SESSION_TIME_ZONE } from './connection';
import { inRollback } from '$lib/testing/rollback';
import { today } from './dialect';
import { clinicToday } from '$lib/clinicTime';

/**
 * The database's clock must speak Drizzle's convention. Before the sessions ran in UTC, a
 * `DEFAULT now()` wrote the server's local time and Drizzle read it back as UTC, so every
 * `created_at` in the app was three hours late and a record made after nine at night was dated
 * the next day.
 */
describe('the database clock', () => {
	it('runs every session in UTC', async () => {
		const [row] = await db
			.select({ zone: sql<string>`@@session.time_zone` })
			.from(sql`(SELECT 1) AS one`);
		expect(row.zone).toBe(SESSION_TIME_ZONE);
	});

	it('reads a database-stamped timestamp back as the instant it was made', async () => {
		const stamped = await inRollback(async (tx) => {
			const [created] = await tx
				.insert(auditLog)
				.values({ action: 'create', tableName: 'clock_test', recordId: 'x' })
				.$returningId();
			const [row] = await tx
				.select({ at: auditLog.timestamp })
				.from(auditLog)
				.where(eq(auditLog.id, created.id));
			return row.at;
		});
		// Within a minute of now, not three hours off.
		expect(Math.abs(stamped.getTime() - Date.now())).toBeLessThan(60_000);
	});

	it('says today is the clinic’s day, not the UTC one', async () => {
		const [row] = await db.select({ day: today() }).from(sql`(SELECT 1) AS one`);
		expect(row.day).toBe(clinicToday());
	});
});

/*
 * The period filter, on a `timestamp` column, at the edges of the clinic's day. In a UTC session the
 * old `BETWEEN '2026-09-11' AND <local end of day>` dropped the first three hours of the first day.
 */
describe('a period of clinic days', async () => {
	const { currentMonthFilter } = await import('$lib/global.svelte');

	it('takes in the first minutes of the first day and none of the day after', async () => {
		const found = await inRollback(async (tx) => {
			const at = (iso: string) => new Date(iso);
			const rows = [
				at('2026-09-10T20:59:00Z'), // 23:59 on the 10th in Addis Ababa — before
				at('2026-09-10T21:01:00Z'), // 00:01 on the 11th — the first minute in
				at('2026-09-12T20:59:00Z'), // 23:59 on the 12th — the last minute in
				at('2026-09-12T21:01:00Z') //  00:01 on the 13th — after
			];
			for (const [i, timestamp] of rows.entries()) {
				await tx
					.insert(auditLog)
					.values({ action: 'create', tableName: 'period_test', recordId: String(i), timestamp });
			}
			const inside = await tx
				.select({ id: auditLog.recordId })
				.from(auditLog)
				.where(
					sql`${auditLog.tableName} = 'period_test' AND ${currentMonthFilter(auditLog.timestamp, '2026-9-11', '2026-09-12')}`
				);
			return inside.map((r) => r.id).sort();
		});
		expect(found).toEqual(['1', '2']);
	});
});
