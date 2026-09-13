import fs from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { FILES_DIR } from '$lib/server/files';

/**
 * Reconciles the store against the database.
 *
 * Nothing in the app has ever deleted a stored file. Replacing an attachment overwrites the
 * filename in its column and abandons the old file (`contentCrud`'s `fileFields` does exactly
 * this), and deleting a record is a soft delete that keeps the reference. The store therefore
 * only grows, and nobody can say which of its files still matter.
 *
 * This does not delete anything. It answers the two questions that have to be answerable before
 * deleting is safe:
 *
 *   **orphans**   on disk, referenced by no row — wasted space, and patient documents living on
 *                 past the record that explains why they were kept
 *   **missing**   referenced by a row, absent from disk — a broken attachment somebody will
 *                 eventually report as a bug
 *
 * Deliberately reads *every* row, including soft-deleted ones: a deleted record's file is still
 * referenced, and a reconciliation that ignored that would report live documents as orphans.
 *
 * The real fix is a `files` table that records what each upload is attached to. Until that
 * exists, this is the only way to see the drift.
 */

/** Every column that stores a filename, as `table.column` pairs of raw SQL identifiers. */
const FILENAME_COLUMNS: ReadonlyArray<readonly [table: string, column: string]> = [
	['employee', 'photo'],
	['employee', 'govt_id'],
	['employee', 'signiture'],
	['employee', 'pension_card'],
	['employee_guarantor', 'gurantor_document'],
	['employee_guarantor', 'photo'],
	['employee_guarantor', 'govt_id'],
	['leave', 'leave_letter'],
	['employee_termination', 'termination_letter'],
	['qualification', 'certificate'],
	['work_experience', 'certificate'],
	['transactions', 'reciept_link'],
	['payroll_receipts', 'reciept_link'],
	['payroll_entries', 'reciept_link']
];

export type FileAudit = {
	/** On disk, referenced by nothing. */
	orphans: string[];
	/** Referenced by a row, not on disk. */
	missing: string[];
	onDisk: number;
	referenced: number;
};

/** Every filename any row still points at, soft-deleted rows included. */
async function referencedNames(): Promise<Set<string>> {
	const names = new Set<string>();

	for (const [table, column] of FILENAME_COLUMNS) {
		// Identifiers, not values — they come from the list above, never from a request.
		const rows = await db.execute(
			sql.raw(
				`SELECT DISTINCT \`${column}\` AS name FROM \`${table}\` WHERE \`${column}\` IS NOT NULL`
			)
		);

		// `db.execute` types a raw result as mysql2's union; a SELECT always yields rows.
		const selected = rows[0] as unknown as Array<{ name: string | null }>;

		for (const row of selected) {
			if (row.name) names.add(row.name);
		}
	}

	return names;
}

export async function auditFiles(): Promise<FileAudit> {
	const onDisk = fs.existsSync(FILES_DIR)
		? fs.readdirSync(FILES_DIR).filter((name) => fs.statSync(path.join(FILES_DIR, name)).isFile())
		: [];

	const referenced = await referencedNames();
	const present = new Set(onDisk);

	return {
		orphans: onDisk.filter((name) => !referenced.has(name)).sort(),
		missing: [...referenced].filter((name) => !present.has(name)).sort(),
		onDisk: onDisk.length,
		referenced: referenced.size
	};
}
