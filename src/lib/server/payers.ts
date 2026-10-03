/**
 * Writing a new payer — an employer or insurer that settles some patients' bills — with the
 * address it owns, in the caller's transaction.
 *
 * Shared by the add form and the spreadsheet import, so a payer from either enters the same way:
 * pending, as its maker's request (`asRequested`), until somebody else approves it in Approvals →
 * Payers. An import is not a way round the maker-checker queue; a file of forty payers is forty
 * requests.
 *
 * Not audited: `customers` is not on the audited list (AUDIT.md). Its approval fields already say
 * who asked for it and who let it through, which is the question an audit row would answer.
 *
 * Non-goals: the duplicate checks. The form asks the database about one phone number; the import
 * checks a whole file against every payer at once. Both refuse the same two things — a phone
 * already in use, and a TIN already registered (the unique key) — each in its own way.
 */
import { insertReturningId } from '@nahu/admin-kit/server/db/insert.js';
import type { db } from '$lib/server/db';
import { address, customers } from '$lib/server/db/schema';
import { asRequested } from '$lib/server/approvals';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * A validated payer — the add form's `customerSchema`, spelled out because a `$lib` module does
 * not import from a route. The form's own type is assignable to it.
 */
export type NewPayer = {
	name: string;
	phone: string;
	email?: string;
	tinNo: string;
	subcity: number;
	street: string;
	kebele?: string;
	buildingNumber?: string;
	floor?: number;
	houseNumber?: number;
};

/** Adds a payer and its address. Returns the payer's id. Throws on a TIN already registered. */
export async function addPayer(
	tx: Tx,
	data: NewPayer,
	userId: string | undefined
): Promise<number> {
	const addressId = await insertReturningId(tx, address, {
		subcityId: data.subcity,
		street: data.street,
		kebele: data.kebele,
		buildingNumber: data.buildingNumber,
		floor: data.floor,
		houseNumber: data.houseNumber
	});

	return insertReturningId(tx, customers, {
		...asRequested(userId),
		name: data.name,
		phone: data.phone,
		email: data.email?.trim() || null,
		tinNo: data.tinNo,
		address: addressId,
		createdBy: userId
	});
}
