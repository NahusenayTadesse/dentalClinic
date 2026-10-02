import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/mysql-core';

import { db } from '$lib/server/db';
import {
	allergen,
	branch,
	medicine,
	patientAllergies,
	patientMedications,
	prescription,
	prescriptionItem,
	provider,
	user
} from '$lib/server/db/schema';
import { insertReturningId } from '@nahu/admin-kit/server/db/insert.js';
import { isoDate } from '$lib/server/db/dialect';
import { notDeleted, softDeleteOwnedRecord } from '$lib/server/softDelete';
import { recordAudit, type AuditRequest } from '$lib/server/audit';
import { WriteRefused, refuseUnless } from '$lib/server/childCrud';
import {
	checkedProvider,
	checkedVisit,
	providerEmployee,
	providerName
} from '$lib/server/appointments';
import { allergyClashes, type ChartAllergy } from '$lib/allergyClash';
import { clinicToday } from '$lib/clinicTime';

/**
 * Prescriptions: what a clinician gives a patient to take away, on paper.
 *
 * **Written once, then fixed.** A prescription is handed over and taken to a pharmacy; the sheet
 * in the patient's hand is the record. So there is no edit — a wrong one is cancelled (a super
 * admin, audited) and written again, and both stay on the audit trail.
 *
 * **What the write refuses**, each because the schema leaves it to the write path:
 *   - a prescriber who is not recorded as able to prescribe (`provider.canPrescribe`)
 *   - a medicine the clinic does not prescribe, or has retired (`medicine.isPrescribable`)
 *   - no indication — the column the schema says the whole stewardship audit rests on
 *   - a medicine that clashes with an allergy on the chart (`$lib/allergyClash.ts`), unless the
 *     clinician says they know. That acknowledgement is recorded in the audit row, by allergy.
 *
 * Every write is audited (`prescription` and `prescription_item` are on the list). One audit row
 * describes a new prescription with its items rather than one per line, as CLAUDE.md §11 asks of
 * an operation that writes several rows at once.
 *
 * Non-goals: dispensing (the pharmacy is elsewhere), repeat prescriptions, and drug–drug
 * interaction checking — the form lists what the patient already takes, and the clinician judges.
 */

/** A transaction on the database, as `db.transaction` hands it over. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Reader = Tx | typeof db;

/** The most lines on one sheet. A dental prescription is two or three; ten is a mistake. */
export const MAX_ITEMS = 10;

/** One line as the form sends it. */
export type ItemInput = {
	medicineId: number;
	dose: string | null;
	frequency: string | null;
	durationDays: number | null;
	quantity: string | null;
	instructions: string | null;
};

/** A prescription as the form sends it. */
export type PrescriptionInput = {
	providerId: number | null;
	appointmentId: number | null;
	weightKg: number | null;
	indication: string;
	notes: string | null;
	/** The clinician has seen the allergy warning and prescribes anyway. */
	allergyAcknowledged: boolean;
	items: ItemInput[];
};

/** What the clinic prescribes: prescribable, active, not retired — for the picker. */
export async function prescribableMedicines(reader: Reader = db) {
	return reader
		.select({
			id: medicine.id,
			genericName: medicine.genericName,
			strength: medicine.strength,
			form: medicine.form,
			isAntibiotic: medicine.isAntibiotic,
			allergenId: medicine.allergenId,
			notes: medicine.notes
		})
		.from(medicine)
		.where(
			and(eq(medicine.isPrescribable, true), eq(medicine.isActive, true), notDeleted(medicine))
		)
		.orderBy(asc(medicine.sortOrder), asc(medicine.genericName));
}

/** The allergies on the patient's chart, as the clash check reads them. */
export async function chartAllergies(
	patientId: number,
	reader: Reader = db
): Promise<ChartAllergy[]> {
	return reader
		.select({
			allergenId: patientAllergies.allergenId,
			name: allergen.name,
			severity: patientAllergies.severity
		})
		.from(patientAllergies)
		.innerJoin(allergen, eq(allergen.id, patientAllergies.allergenId))
		.where(and(eq(patientAllergies.patientId, patientId), notDeleted(patientAllergies)));
}

/** What the patient takes now, for the prescriber to read before adding to it. */
export async function currentMedicines(patientId: number) {
	const rows = await db
		.select({
			name: patientMedications.nameAsReported,
			generic: medicine.genericName,
			dose: patientMedications.dose,
			frequency: patientMedications.frequency
		})
		.from(patientMedications)
		.leftJoin(medicine, eq(medicine.id, patientMedications.medicineId))
		.where(
			and(
				eq(patientMedications.patientId, patientId),
				eq(patientMedications.status, 'active'),
				notDeleted(patientMedications)
			)
		);
	return rows.map((r) => ({
		name: r.generic ?? r.name,
		detail: [r.dose, r.frequency].filter(Boolean).join(' · ') || null
	}));
}

/** The live, prescribable medicines among these ids, keyed by id. */
async function checkedMedicines(tx: Tx, ids: number[]) {
	const rows = await tx
		.select({
			id: medicine.id,
			genericName: medicine.genericName,
			allergenId: medicine.allergenId
		})
		.from(medicine)
		.where(
			and(
				inArray(medicine.id, ids),
				eq(medicine.isPrescribable, true),
				eq(medicine.isActive, true),
				notDeleted(medicine)
			)
		);
	const byId = new Map(rows.map((r) => [r.id, r]));
	refuseUnless(
		ids.every((id) => byId.has(id)),
		'One of the medicines is not on the clinic’s prescribing list. Choose it again.',
		'items'
	);
	return byId;
}

/** Writes a prescription and its lines. Returns its id. */
export async function writePrescription(
	tx: Tx,
	event: AuditRequest,
	patientId: number,
	input: PrescriptionInput
): Promise<number> {
	refuseUnless(input.items.length > 0, 'Add at least one medicine.', 'items');
	refuseUnless(
		input.items.length <= MAX_ITEMS,
		`At most ${MAX_ITEMS} medicines on one sheet.`,
		'items'
	);
	const indication = input.indication.trim();
	refuseUnless(indication.length > 0, 'Say what it is being prescribed for.', 'indication');
	refuseUnless(
		input.weightKg === null || (input.weightKg > 0 && input.weightKg < 400),
		'Enter the weight in kilograms, or leave it empty.',
		'weightKg'
	);
	refuseUnless(input.providerId !== null, 'Choose who is prescribing.', 'providerId');
	const providerId = await checkedProvider(tx, input.providerId, { prescriber: true });
	const appointmentId = await checkedVisit(tx, patientId, input.appointmentId);

	const medicines = await checkedMedicines(
		tx,
		input.items.map((item) => item.medicineId)
	);

	// The allergy check, by the same rule the form warned with.
	const allergies = await chartAllergies(patientId, tx);
	const clashes = input.items.flatMap((item) => {
		const med = medicines.get(item.medicineId);
		return med ? allergyClashes(allergies, med).map((a) => `${med.genericName} — ${a.name}`) : [];
	});
	if (clashes.length && !input.allergyAcknowledged) {
		throw new WriteRefused(
			'allergyAcknowledged',
			`This clashes with an allergy on the chart: ${clashes.join('; ')}. Tick that you know, or change the medicine.`
		);
	}

	const id = await insertReturningId(tx, prescription, {
		patientId,
		providerId,
		appointmentId,
		branchId: event.locals.branch?.active ?? undefined,
		prescribedOn: clinicToday(),
		patientWeightKg: input.weightKg,
		indication,
		notes: input.notes?.trim() || null,
		createdBy: event.locals.user?.id
	});
	await tx.insert(prescriptionItem).values(
		input.items.map((item) => ({
			prescriptionId: id,
			medicineId: item.medicineId,
			dose: item.dose?.trim() || null,
			frequency: item.frequency?.trim() || null,
			durationDays: item.durationDays,
			quantity: item.quantity?.trim() || null,
			instructions: item.instructions?.trim() || null,
			createdBy: event.locals.user?.id
		}))
	);
	await recordAudit(tx, event, {
		table: 'prescription',
		recordId: id,
		action: 'create',
		detail: {
			items: input.items.length,
			...(clashes.length ? { allergyAcknowledged: clashes } : {})
		}
	});
	return id;
}

/**
 * Cancels a prescription written in error. The caller has checked `requireSuperAdmin` (CLAUDE.md
 * §9 — every delete); the rows stay, soft deleted, and the audit row says who.
 */
export async function cancelPrescription(
	tx: Tx,
	event: AuditRequest,
	patientId: number,
	prescriptionId: number
) {
	const done = await softDeleteOwnedRecord(
		tx,
		prescription,
		prescription.patientId,
		prescriptionId,
		patientId,
		event.locals.user?.id
	);
	refuseUnless(done, 'That prescription is not on this patient’s record.');
	await recordAudit(tx, event, {
		table: 'prescription',
		recordId: prescriptionId,
		action: 'delete'
	});
}

const writer = alias(user, 'prescription_writer');

/** The patient's prescriptions, newest first, each with its medicines named. */
export async function patientPrescriptions(patientId: number, reader: Reader = db) {
	const headers = await reader
		.select({
			id: prescription.id,
			prescribedOn: isoDate(prescription.prescribedOn),
			indication: prescription.indication,
			provider: providerName,
			providerId: prescription.providerId,
			writtenBy: writer.name
		})
		.from(prescription)
		.leftJoin(provider, eq(provider.id, prescription.providerId))
		.leftJoin(providerEmployee, eq(providerEmployee.id, provider.employeeId))
		.leftJoin(writer, eq(writer.id, prescription.createdBy))
		.where(and(eq(prescription.patientId, patientId), notDeleted(prescription)))
		.orderBy(desc(prescription.prescribedOn), desc(prescription.id));
	if (!headers.length) return [];

	const items = await itemsOf(
		reader,
		headers.map((h) => h.id)
	);
	return headers.map((h) => {
		const lines = items.filter((i) => i.prescriptionId === h.id);
		return {
			...h,
			medicines: lines.map((i) => i.medicine).join(', '),
			antibiotic: lines.some((i) => i.isAntibiotic)
		};
	});
}

/** The lines of these prescriptions, in the order they were written. */
function itemsOf(reader: Reader, prescriptionIds: number[]) {
	return reader
		.select({
			id: prescriptionItem.id,
			prescriptionId: prescriptionItem.prescriptionId,
			// The medicine is read even when retired since: the sheet said what it said.
			medicine: medicine.genericName,
			strength: medicine.strength,
			form: medicine.form,
			isAntibiotic: medicine.isAntibiotic,
			dose: prescriptionItem.dose,
			frequency: prescriptionItem.frequency,
			durationDays: prescriptionItem.durationDays,
			quantity: prescriptionItem.quantity,
			instructions: prescriptionItem.instructions
		})
		.from(prescriptionItem)
		.innerJoin(medicine, eq(medicine.id, prescriptionItem.medicineId))
		.where(
			and(inArray(prescriptionItem.prescriptionId, prescriptionIds), notDeleted(prescriptionItem))
		)
		.orderBy(asc(prescriptionItem.id));
}

/**
 * One prescription as the printed sheet needs it: the lines, the prescriber with their licence
 * number, and the branch as the institution line. Null when it is not this patient's.
 */
export async function prescriptionSheet(patientId: number, prescriptionId: number) {
	const [header] = await db
		.select({
			id: prescription.id,
			prescribedOn: isoDate(prescription.prescribedOn),
			weightKg: prescription.patientWeightKg,
			indication: prescription.indication,
			notes: prescription.notes,
			provider: providerName,
			licenceNumber: provider.licenceNumber,
			branchName: branch.name,
			branchAddress: branch.address,
			branchPhone: branch.phone
		})
		.from(prescription)
		.leftJoin(provider, eq(provider.id, prescription.providerId))
		.leftJoin(providerEmployee, eq(providerEmployee.id, provider.employeeId))
		.leftJoin(branch, eq(branch.id, prescription.branchId))
		.where(
			and(
				eq(prescription.id, prescriptionId),
				eq(prescription.patientId, patientId),
				notDeleted(prescription)
			)
		)
		.limit(1);
	if (!header) return null;
	return { ...header, items: await itemsOf(db, [prescriptionId]) };
}
