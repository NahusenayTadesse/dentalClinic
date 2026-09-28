import { describe, expect, it } from 'vitest';
import { and, desc, eq } from 'drizzle-orm';

import { db } from './db';
import { allergen, auditLog, medicine, patient, patientAllergies, provider } from './db/schema';
import { inRollback } from '$lib/testing/rollback';
import { WriteRefused } from './childCrud';
import { patientPrescriptions, writePrescription, type PrescriptionInput } from './prescriptions';

/**
 * What a prescription refuses, since every one of those rules is the write path's alone: a
 * prescriber who may not prescribe, a medicine the clinic does not write, no indication, and an
 * allergy clash nobody acknowledged. Built inside rollbacks; a patient, a provider, the penicillin
 * allergen and amoxicillin are borrowed.
 */
describe('prescriptions', async () => {
	const [someone] = await db.select({ id: patient.id }).from(patient).limit(1);
	const [clinician] = await db.select({ id: provider.id }).from(provider).limit(1);
	const [penicillin] = await db
		.select({ id: allergen.id })
		.from(allergen)
		.where(eq(allergen.name, 'Penicillin'))
		.limit(1);
	const [amoxicillin] = await db
		.select({ id: medicine.id, allergenId: medicine.allergenId })
		.from(medicine)
		.where(eq(medicine.genericName, 'Amoxicillin'))
		.limit(1);
	const [warfarin] = await db
		.select({ id: medicine.id })
		.from(medicine)
		.where(eq(medicine.isPrescribable, false))
		.limit(1);
	const ready = Boolean(someone && clinician && penicillin && amoxicillin && warfarin);

	const request = {
		locals: { user: null, branch: { active: null } },
		getClientAddress: () => '127.0.0.1'
	};

	const sheet = (change: Partial<PrescriptionInput> = {}): PrescriptionInput => ({
		providerId: clinician.id,
		appointmentId: null,
		weightKg: null,
		indication: 'Acute apical abscess 36',
		notes: null,
		allergyAcknowledged: false,
		items: [
			{
				medicineId: amoxicillin.id,
				dose: '500mg',
				frequency: 'Three times a day',
				durationDays: 5,
				quantity: '15 capsules',
				instructions: null
			}
		],
		...change
	});

	/** The borrowed clinician, allowed to prescribe; the patient with no allergies but penicillin. */
	async function prepare(tx: Parameters<Parameters<typeof inRollback>[0]>[0], allergic: boolean) {
		await tx
			.update(provider)
			.set({ canPrescribe: true, isActive: true })
			.where(eq(provider.id, clinician.id));
		await tx
			.update(medicine)
			.set({ allergenId: penicillin.id })
			.where(eq(medicine.id, amoxicillin.id));
		await tx.delete(patientAllergies).where(eq(patientAllergies.patientId, someone.id));
		if (allergic) {
			await tx.insert(patientAllergies).values({
				patientId: someone.id,
				allergenId: penicillin.id,
				severity: 'severe'
			});
		}
	}

	const refused = async (write: Promise<unknown>) => {
		try {
			await write;
		} catch (err) {
			if (err instanceof WriteRefused) return err.message;
			throw err;
		}
		return null;
	};

	it.skipIf(!ready)('writes a prescription and lists it with its medicines', async () => {
		const list = await inRollback(async (tx) => {
			await prepare(tx, false);
			await writePrescription(tx, request, someone.id, sheet());
			return patientPrescriptions(someone.id, tx);
		});
		expect(list[0].medicines).toBe('Amoxicillin');
		expect(list[0].antibiotic).toBe(true);
		expect(list[0].indication).toBe('Acute apical abscess 36');
	});

	it.skipIf(!ready)(
		'refuses a penicillin for a penicillin allergy unless it is acknowledged, and records that',
		async () => {
			const result = await inRollback(async (tx) => {
				await prepare(tx, true);
				const unacknowledged = await refused(writePrescription(tx, request, someone.id, sheet()));
				const id = await writePrescription(
					tx,
					request,
					someone.id,
					sheet({ allergyAcknowledged: true })
				);
				const [audit] = await tx
					.select({ changes: auditLog.changes })
					.from(auditLog)
					.where(and(eq(auditLog.tableName, 'prescription'), eq(auditLog.recordId, String(id))))
					.orderBy(desc(auditLog.id))
					.limit(1);
				return { unacknowledged, audit };
			});
			expect(result.unacknowledged).toMatch(/Amoxicillin — Penicillin/);
			expect(JSON.stringify(result.audit.changes)).toMatch(/Amoxicillin — Penicillin/);
		}
	);

	it.skipIf(!ready)(
		'refuses a prescriber who may not prescribe, a record-only medicine, and no indication',
		async () => {
			const result = await inRollback(async (tx) => {
				await prepare(tx, false);
				const recordOnly = await refused(
					writePrescription(
						tx,
						request,
						someone.id,
						sheet({
							items: [
								{
									medicineId: warfarin.id,
									dose: null,
									frequency: null,
									durationDays: null,
									quantity: null,
									instructions: null
								}
							]
						})
					)
				);
				const noIndication = await refused(
					writePrescription(tx, request, someone.id, sheet({ indication: ' ' }))
				);
				await tx.update(provider).set({ canPrescribe: false }).where(eq(provider.id, clinician.id));
				const notPrescriber = await refused(writePrescription(tx, request, someone.id, sheet()));
				return { recordOnly, noIndication, notPrescriber };
			});
			expect(result.recordOnly).toMatch(/prescribing list/);
			expect(result.noIndication).toMatch(/what it is being prescribed for/);
			expect(result.notPrescriber).toMatch(/able to prescribe/);
		}
	);
});
