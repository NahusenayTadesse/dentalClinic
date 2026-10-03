/**
 * Writing a new patient: the row, and the allergies reported at the desk, in the caller's
 * transaction.
 *
 * Two screens create patients — registration, one at a time with someone at the window, and the
 * spreadsheet import, hundreds at a time while a clinic moves onto the system — and a patient must
 * come out of both the same: stamped with the branch being worked at (CLAUDE.md §15), an age turned
 * into a flagged estimated birth date, allergies recorded as "unknown" until a clinician grades
 * them. So the insert lives here once.
 *
 * Non-goals, each the caller's because the two callers differ on it:
 *
 *   - **the duplicate question** — registration asks it of one person and stops; the import asks it
 *     of a whole file and leaves the matches out (`possibleDuplicates`, `matchReason`)
 *   - **the audit row** — registration records one patient; an import records the import, not
 *     each row (AUDIT.md, "bulk operations log the operation")
 */
import { insertReturningId } from '@nahu/admin-kit/server/db/insert.js';
import type { db } from '$lib/server/db';
import { patient, patientAllergies } from '$lib/server/db/schema';
import { birthDateFrom } from '$lib/server/patients';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * A validated registration — the shape of the `registerPatient` form, spelled out here because a
 * `$lib` module does not import from a route. The form's own type is assignable to it.
 */
export type NewPatient = {
	fileNo?: string;
	name: string;
	fatherName: string;
	grandFatherName?: string;
	sex: 'male' | 'female';
	knowsBirthDate: boolean;
	birthDate?: string;
	ageYears?: number;
	phone?: string;
	altPhone?: string;
	bloodType?: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
	medicalNotes?: string;
	referralSourceId?: number;
	referredBy?: string;
	customerId?: number;
	/** Allergen ids as a comma-separated list — what the registration checkbox group posts. */
	allergenIds?: string;
};

/** Who is writing, and where: the user, and the branch the new record is filed under. */
export type WriteStamp = {
	userId: string | undefined;
	/**
	 * The branch being worked at, or null when the user is looking at "all branches" — which is
	 * not a place, so the record falls back to the column default, the main branch, rather than to
	 * whichever branch sorts first.
	 */
	branchId: number | null;
};

/** The allergen ids in a comma-separated list, once each. Anything not a positive id is dropped. */
export function allergenIdList(raw: string | undefined): number[] {
	return [
		...new Set(
			(raw ?? '')
				.split(',')
				.map((v) => Number(v.trim()))
				.filter((n) => Number.isInteger(n) && n > 0)
		)
	];
}

/**
 * Inserts one patient and the allergies reported with them. Returns the new id and how many
 * allergies were recorded, which is what registration's audit row says.
 *
 * Throws on a duplicate file number (a unique key), for the caller to report against the field.
 */
export async function insertPatient(
	tx: Tx,
	data: NewPatient,
	stamp: WriteStamp
): Promise<{ id: number; allergies: number }> {
	const allergenIds = allergenIdList(data.allergenIds);

	const id = await insertReturningId(tx, patient, {
		fileNo: data.fileNo ?? null,
		name: data.name,
		fatherName: data.fatherName,
		grandFatherName: data.grandFatherName ?? null,
		sex: data.sex,
		...birthDateFrom(data),
		phone: data.phone ?? null,
		altPhone: data.altPhone ?? null,
		bloodType: data.bloodType ?? null,
		medicalNotes: data.medicalNotes ?? null,
		referralSourceId: data.referralSourceId ?? null,
		referredBy: data.referredBy ?? null,
		customerId: data.customerId ?? null,
		...(stamp.branchId !== null ? { branchId: stamp.branchId } : {}),
		createdBy: stamp.userId
	});

	if (allergenIds.length) {
		await tx.insert(patientAllergies).values(
			allergenIds.map((allergenId) => ({
				patientId: id,
				allergenId,
				// Reported at the desk, not assessed. A clinician grades it on the chart.
				severity: 'unknown' as const,
				createdBy: stamp.userId
			}))
		);
	}

	return { id, allergies: allergenIds.length };
}
