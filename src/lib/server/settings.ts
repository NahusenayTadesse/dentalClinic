/**
 * The clinic's settings row, read with its defaults.
 *
 * Migration 0036 inserts row 1, so every install that ran the migrations has one. This still
 * falls back to the column defaults when the row is missing — a database restored from before the
 * migration, a test database emptied by hand — because a missing setting should read as the default
 * the clinic would have got, not as an error in the middle of issuing a bill.
 *
 * Non-goal: caching. It is one primary-key read, and a cached threshold would outlive the admin
 * changing it until the process restarted.
 */
import { eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { clinicSettings } from '$lib/server/db/schema';

/** The database, or a transaction on it. */
type Reader = Pick<typeof db, 'select'>;

/** The settings every read gets, whether or not the row is there. */
export type ClinicSettings = { discountApprovalPercent: number };

/** What a clinic that never touched its settings gets — the same values as the column defaults. */
export const DEFAULT_SETTINGS: ClinicSettings = { discountApprovalPercent: 10 };

/** The clinic's settings. */
export async function readSettings(reader: Reader = db): Promise<ClinicSettings> {
	const [row] = await reader
		.select({ discountApprovalPercent: clinicSettings.discountApprovalPercent })
		.from(clinicSettings)
		.where(eq(clinicSettings.id, 1))
		.limit(1);
	return row ?? DEFAULT_SETTINGS;
}
