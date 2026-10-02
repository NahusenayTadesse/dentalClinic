import { and, count, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import type { MySqlColumn, MySqlTable } from 'drizzle-orm/mysql-core';

import { db } from '$lib/server/db';
import {
	appointment,
	clinicalNote,
	invoice,
	labCase,
	perioExam,
	patient,
	patientAllergies,
	patientConditions,
	patientConsent,
	patientContacts,
	patientEmergencyContacts,
	patientFile,
	patientMedications,
	payerAuthorisation,
	prescription,
	procedures,
	recall,
	smsMessage,
	suppliesAdjustments,
	transactions,
	treatmentPlan
} from '$lib/server/db/schema';
import { recordAudit, type AuditRequest } from '$lib/server/audit';
import { refuseUnless } from '$lib/server/childCrud';

/**
 * Merging a duplicate registration into the record that stays.
 *
 * **Why this exists.** A second registration is the most likely way this system hurts somebody
 * (`possibleDuplicates` says how): the allergy stays on the first record and the prescription is
 * written on the second. Registration warns; this is the repair when the warning was missed.
 *
 * **What it does**, in one transaction, and the caller has checked `requireSuperAdmin`:
 *   - every row that belongs to the duplicate is moved to the survivor — `OWNED` below is the list,
 *     and a test fails when a new table points at `patient` without being on it
 *   - an allergy, condition or medicine both records hold is kept once: the survivor's stays and
 *     the duplicate's copy is soft deleted, since the table allows one live row of each — but an
 *     allergy keeps the **worse** severity of the two, and any reaction the survivor lacked
 *   - a contact both records hold stays on the duplicate, since it is the same contact
 *   - a field the survivor left empty is filled from the duplicate — a phone, a birth date
 *   - the duplicate becomes a tombstone (`mergedIntoId`), so its file number still leads to the
 *     survivor, and records merged into it earlier are pointed straight at the survivor
 *   - **one** `merge` audit row, on the survivor, with what moved (CLAUDE.md §11: the operation,
 *     not its rows)
 *
 * **What it does not move:** `patient_access_log`. That table is append-only evidence of who
 * looked at *which* record, and rewriting it would be rewriting evidence. The chart reads views
 * across a patient and the records merged into it instead.
 *
 * Non-goals: un-merging (the audit row says what moved, which is what a manual repair needs), and
 * merging across a conflict a person must decide — two different birth dates keep the survivor's.
 */

/** A transaction on the database, as `db.transaction` hands it over. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** A table with a `patient_id` pointing at `patient`, by its SQL name. */
type Owned = { name: string; table: MySqlTable; patientId: MySqlColumn };

/**
 * Every table whose rows belong to a patient. `patientMerge.test.ts` compares it with the
 * database's own foreign keys, so a table added later cannot be forgotten here.
 */
export const OWNED: Owned[] = [
	{ name: 'appointment', table: appointment, patientId: appointment.patientId },
	{ name: 'clinical_note', table: clinicalNote, patientId: clinicalNote.patientId },
	{ name: 'invoice', table: invoice, patientId: invoice.patientId },
	{ name: 'lab_case', table: labCase, patientId: labCase.patientId },
	{ name: 'patient_allergies', table: patientAllergies, patientId: patientAllergies.patientId },
	{ name: 'patient_conditions', table: patientConditions, patientId: patientConditions.patientId },
	{ name: 'patient_consent', table: patientConsent, patientId: patientConsent.patientId },
	{ name: 'patient_contacts', table: patientContacts, patientId: patientContacts.patientId },
	{
		name: 'patient_emergency_contacts',
		table: patientEmergencyContacts,
		patientId: patientEmergencyContacts.patientId
	},
	{ name: 'patient_file', table: patientFile, patientId: patientFile.patientId },
	{
		name: 'patient_medications',
		table: patientMedications,
		patientId: patientMedications.patientId
	},
	// What a payer agreed to pay for this person's treatment follows them.
	{
		name: 'payer_authorisation',
		table: payerAuthorisation,
		patientId: payerAuthorisation.patientId
	},
	// A periodontal chart is the baseline the next is compared with: it follows the patient.
	{ name: 'perio_exam', table: perioExam, patientId: perioExam.patientId },
	{ name: 'prescription', table: prescription, patientId: prescription.patientId },
	{ name: 'procedures', table: procedures, patientId: procedures.patientId },
	{ name: 'recall', table: recall, patientId: recall.patientId },
	// A text sent to the duplicate was sent to this person: its log row follows them.
	{ name: 'sms_message', table: smsMessage, patientId: smsMessage.patientId },
	{
		name: 'supplies_adjustments',
		table: suppliesAdjustments,
		patientId: suppliesAdjustments.patientId
	},
	{ name: 'transactions', table: transactions, patientId: transactions.patientId },
	{ name: 'treatment_plan', table: treatmentPlan, patientId: treatmentPlan.patientId }
];

/**
 * Tables that point at `patient` and deliberately are not moved: the access log (evidence, see
 * above) and `patient` itself, whose `mergedIntoId` is handled on its own.
 */
export const NOT_MOVED = ['patient_access_log', 'patient'];

/** The survivor's columns a merge may fill when the survivor left them empty. */
const FILLABLE = [
	'birthDate',
	'phone',
	'altPhone',
	'bloodType',
	'medicalNotes',
	'referralSourceId',
	'referredBy',
	'customerId',
	'historyTakenAt',
	'historyTakenBy'
] as const;

/** Allergy severities, least to most — for keeping the worse of two. */
const SEVERITY = ['unknown', 'mild', 'moderate', 'severe'] as const;

/**
 * Before a shared allergy's duplicate copy is dropped, the survivor's copy takes the worse
 * severity and any reaction it lacked. Found in testing: a "moderate" penicillin allergy survived
 * a merge while the "severe" one on the other record was dropped — the one direction a merge must
 * never lose information in. Returns the allergens whose severity was raised.
 */
async function keepWorseAllergy(tx: Tx, survivorId: number, duplicateId: number, userId?: string) {
	const live = (id: number) =>
		tx
			.select({
				id: patientAllergies.id,
				allergenId: patientAllergies.allergenId,
				severity: patientAllergies.severity,
				reaction: patientAllergies.reaction
			})
			.from(patientAllergies)
			.where(and(eq(patientAllergies.patientId, id), isNull(patientAllergies.deletedAt)));
	const [kept, theirs] = await Promise.all([live(survivorId), live(duplicateId)]);
	const raised: number[] = [];
	for (const mine of kept) {
		const other = theirs.find((t) => t.allergenId === mine.allergenId);
		if (!other) continue;
		const worse = SEVERITY.indexOf(other.severity) > SEVERITY.indexOf(mine.severity);
		if (!worse && (mine.reaction || !other.reaction)) continue;
		await tx
			.update(patientAllergies)
			.set({
				severity: worse ? other.severity : mine.severity,
				reaction: mine.reaction ?? other.reaction,
				updatedBy: userId ?? null
			})
			.where(eq(patientAllergies.id, mine.id));
		if (worse) raised.push(mine.allergenId);
	}
	return raised;
}

/**
 * The duplicate's copies of what the survivor already has: the same allergen, condition or coded
 * medicine, live on both. Soft deleted rather than moved, which the table's unique key would refuse.
 */
async function dropSharedCodes(tx: Tx, survivorId: number, duplicateId: number, userId?: string) {
	const coded = [
		{ table: patientAllergies, code: patientAllergies.allergenId },
		{ table: patientConditions, code: patientConditions.conditionId },
		{ table: patientMedications, code: patientMedications.medicineId }
	] as const;
	let dropped = 0;
	for (const { table, code } of coded) {
		const kept = await tx
			.select({ code })
			.from(table)
			.where(and(eq(table.patientId, survivorId), isNull(table.deletedAt), isNotNull(code)));
		const codes = kept.map((row) => row.code).filter((c): c is number => c !== null);
		if (!codes.length) continue;
		const shared = and(
			eq(table.patientId, duplicateId),
			isNull(table.deletedAt),
			inArray(code, codes)
		);
		const [{ n }] = await tx.select({ n: count() }).from(table).where(shared);
		if (!n) continue;
		await tx
			.update(table)
			.set({ deletedAt: new Date(), deletedBy: userId ?? null })
			.where(shared);
		dropped += n;
	}
	return dropped;
}

/** The duplicate's contacts the survivor does not already hold, by type and value. */
async function contactsToMove(tx: Tx, survivorId: number, duplicateId: number) {
	const held = await tx
		.select({ type: patientContacts.contactTypeId, value: patientContacts.value })
		.from(patientContacts)
		.where(eq(patientContacts.patientId, survivorId));
	const theirs = await tx
		.select({
			id: patientContacts.id,
			type: patientContacts.contactTypeId,
			value: patientContacts.value
		})
		.from(patientContacts)
		.where(eq(patientContacts.patientId, duplicateId));
	return theirs
		.filter((c) => !held.some((h) => h.type === c.type && h.value === c.value))
		.map((c) => c.id);
}

/**
 * Merges `duplicateId` into `survivorId`. Returns what moved, by table, as the audit row records it.
 */
export async function mergePatients(
	tx: Tx,
	event: AuditRequest,
	{ survivorId, duplicateId }: { survivorId: number; duplicateId: number }
): Promise<Record<string, number>> {
	refuseUnless(survivorId !== duplicateId, 'A record cannot be merged into itself.');
	const rows = await tx
		.select()
		.from(patient)
		.where(inArray(patient.id, [survivorId, duplicateId]))
		.for('update');
	const survivor = rows.find((r) => r.id === survivorId);
	const duplicate = rows.find((r) => r.id === duplicateId);
	refuseUnless(
		Boolean(survivor && !survivor.deletedAt && !survivor.mergedIntoId),
		'The record to keep is not a live patient.'
	);
	refuseUnless(
		Boolean(duplicate && !duplicate.deletedAt && !duplicate.mergedIntoId),
		'That record is not a live patient — it may already have been merged.'
	);
	if (!survivor || !duplicate) return {};
	const userId = event.locals.user?.id;

	const moved: Record<string, number> = {};
	const raised = await keepWorseAllergy(tx, survivorId, duplicateId, userId);
	const dropped = await dropSharedCodes(tx, survivorId, duplicateId, userId);
	const contactIds = await contactsToMove(tx, survivorId, duplicateId);

	for (const { name, table, patientId } of OWNED) {
		if (name === 'patient_contacts') {
			if (contactIds.length) {
				await tx
					.update(patientContacts)
					.set({ patientId: survivorId })
					.where(inArray(patientContacts.id, contactIds));
				moved[name] = contactIds.length;
			}
			continue;
		}
		const [{ n }] = await tx.select({ n: count() }).from(table).where(eq(patientId, duplicateId));
		if (!n) continue;
		await tx
			.update(table)
			.set({ [keyOf(table, patientId)]: survivorId })
			.where(eq(patientId, duplicateId));
		moved[name] = n;
	}

	// Records merged into the duplicate earlier now lead straight to the survivor.
	await tx
		.update(patient)
		.set({ mergedIntoId: survivorId })
		.where(eq(patient.mergedIntoId, duplicateId));

	const filled: Record<string, unknown> = {};
	for (const field of FILLABLE) {
		if (survivor[field] === null && duplicate[field] !== null) filled[field] = duplicate[field];
	}
	if ('birthDate' in filled) filled.birthDateEstimated = duplicate.birthDateEstimated;
	await tx
		.update(patient)
		.set({ ...filled, updatedBy: userId })
		.where(eq(patient.id, survivorId));
	await tx
		.update(patient)
		.set({ mergedIntoId: survivorId, updatedBy: userId })
		.where(eq(patient.id, duplicateId));

	await recordAudit(tx, event, {
		table: 'patient',
		recordId: survivorId,
		action: 'merge',
		detail: {
			merged: duplicateId,
			moved,
			...(dropped ? { keptOnce: dropped } : {}),
			...(raised.length ? { severityRaised: raised } : {}),
			...(Object.keys(filled).length ? { filled: Object.keys(filled) } : {})
		}
	});
	return moved;
}

/** The Drizzle key of a column on a table — what `update().set()` is keyed by. */
function keyOf(table: MySqlTable, column: MySqlColumn): string {
	const entry = Object.entries(table).find(([, value]) => value === column);
	if (!entry) throw new Error(`patientMerge: column ${column.name} is not on its table`);
	return entry[0];
}

/** The records merged into this one, for reading across them — the access log, say. */
export async function mergedInto(patientId: number): Promise<number[]> {
	const rows = await db
		.select({ id: patient.id })
		.from(patient)
		.where(eq(patient.mergedIntoId, patientId));
	return rows.map((r) => r.id);
}
