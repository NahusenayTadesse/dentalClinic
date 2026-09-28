/**
 * Numbers for the documents a clinic hands over — bills, receipts and refunds — from a counter that cannot
 * give two documents the same number (`document_sequence`).
 *
 * Non-goal: a number on a draft. A number is taken when a document is issued, inside the issuing
 * transaction, so a draft that is thrown away never burns one.
 */
import { eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { documentSequence } from '$lib/server/db/schema';
import { clinicToday } from '$lib/clinicTime';
import { getEthiopianYearMonth } from '$lib/global.svelte';

/** A transaction on the database, as `db.transaction` hands it over. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * The next number in a series, taken inside the issuing transaction: `INV-2019-00042`. The
 * counter row is locked (`FOR UPDATE`), so two receptionists issuing at the same moment get two
 * numbers rather than one number and a failed save. Numbered per Ethiopian year, the year the
 * clinic's books are kept in.
 */
export async function nextNumber(
	tx: Tx | typeof db,
	series: 'invoice' | 'receipt' | 'refund'
): Promise<string> {
	const year = getEthiopianYearMonth(new Date(`${clinicToday()}T12:00:00Z`))?.year ?? 0;
	const name = `${series}-${year}`;

	let [row] = await tx
		.select({ next: documentSequence.nextValue })
		.from(documentSequence)
		.where(eq(documentSequence.name, name))
		.for('update');
	if (!row) {
		// The year's first document. Inserted rather than upserted: the upsert is spelled
		// differently on every engine (§10), and a racing first insert fails on the primary key,
		// which the caller's transaction reports as a failure to retry.
		await tx.insert(documentSequence).values({ name, nextValue: 1 });
		row = { next: 1 };
	}
	await tx
		.update(documentSequence)
		.set({ nextValue: row.next + 1 })
		.where(eq(documentSequence.name, name));

	const prefix = { invoice: 'INV', receipt: 'RCT', refund: 'RFD' }[series];
	return `${prefix}-${year}-${String(row.next).padStart(5, '0')}`;
}
