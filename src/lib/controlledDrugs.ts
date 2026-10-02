/**
 * The controlled-medicine register's arithmetic: a running balance down the ledger, and a month
 * added up the way the Ethiopian Food and Drug Authority's return asks — opening balance, received,
 * issued to patients, written off, adjusted, closing balance. Client-safe and pure; the rows come
 * from the stock ledger (`supplies_adjustments`) through `server/controlledDrugs.ts`.
 *
 * **The ledger is the register.** Every movement of stock is already a ledger row naming its lot,
 * and an issue names its patient. A separate register book would be a second copy that drifts;
 * this reads the one copy the stock itself is moved by, and only adds the balance column.
 *
 * **And the shelf is the check.** The balance the ledger arrives at is compared with what the open
 * lots hold now. A difference means stock moved without a ledger row — the one thing a controlled
 * register exists to make impossible — and the screen says so instead of hiding it.
 */

/** The kinds of movement, as the ledger types them. */
export type Movement =
	| 'received'
	| 'dispensed'
	| 'consumed'
	| 'damaged'
	| 'expired'
	| 'returned'
	| 'transferred'
	| 'correction';

/** The columns of the return each movement falls in. */
export type ReturnColumn = 'received' | 'issued' | 'writtenOff' | 'adjusted';

/** Which column of the return a movement belongs in. Used in the clinic is issued, as dispensed is. */
export function returnColumn(movement: Movement): ReturnColumn {
	if (movement === 'received') return 'received';
	if (movement === 'dispensed' || movement === 'consumed') return 'issued';
	if (movement === 'damaged' || movement === 'expired') return 'writtenOff';
	return 'adjusted';
}

/** How a movement reads in the register. */
export const MOVEMENT_LABEL: Record<Movement, string> = {
	received: 'Received',
	dispensed: 'Issued to patient',
	consumed: 'Used in the clinic',
	damaged: 'Damaged',
	expired: 'Expired',
	returned: 'Returned',
	transferred: 'Transferred',
	correction: 'Count correction'
};

/** One row of the register, with the balance after it. */
export type RegisterLine<R> = R & { balance: number };

const round = (n: number) => Math.round(n * 100) / 100;

/** The ledger rows of a period, oldest first, each with the balance it leaves. */
export function withBalance<R extends { quantity: number }>(
	opening: number,
	rows: R[]
): RegisterLine<R>[] {
	let balance = opening;
	return rows.map((row) => {
		balance = round(balance + row.quantity);
		return { ...row, balance };
	});
}

/** A month of one medicine, as the return lists it. Issued and written off are positive numbers. */
export type ReturnRow = {
	opening: number;
	received: number;
	issued: number;
	writtenOff: number;
	adjusted: number;
	closing: number;
};

/** Adds a period up, from its opening balance and its movements. */
export function monthReturn(
	opening: number,
	rows: { movement: Movement; quantity: number }[]
): ReturnRow {
	const sum = { received: 0, issued: 0, writtenOff: 0, adjusted: 0 };
	for (const row of rows) sum[returnColumn(row.movement)] += row.quantity;
	const closing = round(opening + sum.received + sum.issued + sum.writtenOff + sum.adjusted);
	return {
		opening: round(opening),
		received: round(sum.received),
		issued: round(-sum.issued),
		writtenOff: round(-sum.writtenOff),
		adjusted: round(sum.adjusted),
		closing
	};
}

/**
 * What a movement of a controlled medicine is missing, or null. A delivery names its batch and its
 * supplier — the two things the authority traces a consignment by. An issue names the patient it
 * went to, or, for anything else (a count correction), says why in words.
 */
export function controlledRefusal(input: {
	intent: 'add' | 'remove';
	batchNumber: string | null;
	supplierId: number | null;
	patientId: number | null;
	reason: string | null;
}): { field: 'batchNumber' | 'supplierId' | 'patientId'; text: string } | null {
	if (input.intent === 'add') {
		if (!input.batchNumber?.trim())
			return {
				field: 'batchNumber',
				text: 'A controlled medicine is received with its batch number.'
			};
		if (!input.supplierId)
			return {
				field: 'supplierId',
				text: 'A controlled medicine is received from a named supplier.'
			};
		return null;
	}
	if (!input.patientId && (input.reason?.trim().length ?? 0) < 5)
		return {
			field: 'patientId',
			text: 'A controlled medicine is issued to a patient. For anything else, write the reason.'
		};
	return null;
}
