/**
 * What a completed visit leaves behind: the work done, charted on the teeth it was done to, a
 * note, a bill, and sometimes a plan, a prescription or a recall — plus what the examination found
 * and what the patient arrived with.
 *
 * The patient chart shows all of this as counts and totals, and with no rows every chart read
 * "0 · 0 · 0" and "ETB 0.00 billed" — which looks the same whether the feature works or not. These
 * rows hang off appointments that have already happened, so the dates on a chart make sense next to
 * its own visit history.
 *
 * Money follows the schema's rule (CLAUDE.md §9): decimal columns, fixed-point strings, and a
 * payment is a `transactions` row with an `invoice_payment` allocating it — never an amount written
 * onto the invoice.
 */
import { and, eq, isNull } from 'drizzle-orm';

import { appointment } from '../../src/lib/server/db/schema/scheduling';
import { procedures } from '../../src/lib/server/db/schema/procedures';
import { invoice, invoiceLine, invoicePayment } from '../../src/lib/server/db/schema/invoices';
import { transactions } from '../../src/lib/server/db/schema/finance';
import {
	prescription,
	prescriptionItem,
	medicine
} from '../../src/lib/server/db/schema/prescriptions';
import { clinicalNote } from '../../src/lib/server/db/schema/notes';
import { recall } from '../../src/lib/server/db/schema/recalls';
import { patientConsent } from '../../src/lib/server/db/schema/consents';
import { services } from '../../src/lib/server/db/schema/services';
import { isEmpty, localDate, money, randomness, type SeedDb } from './util';
import { backTooth, mouthFor, placeFor } from './chart';
import { dentitionForAge } from '../../src/lib/teeth';
import { patient } from '../../src/lib/server/db/schema/patients';

/**
 * What a child is treated with. No dentures, bridges or crowns, no root canals on teeth that will
 * fall out anyway (a pulpotomy instead), and fissure sealants and fluoride, which are mostly for
 * children.
 */
const CHILD_TREATMENTS = new Set([
	'Consultation',
	'Periapical radiograph',
	'Fluoride application',
	'Fissure sealant',
	'Scaling and polishing',
	'Composite filling',
	'Temporary filling',
	'Pulpotomy'
]);

/** Whole years between a birth date and a visit, or null when the birth date was never recorded. */
function ageAt(birthDate: Date | null, visit: Date): number | null {
	if (!birthDate) return null;
	const years = visit.getFullYear() - birthDate.getFullYear();
	const hadBirthday =
		visit.getMonth() > birthDate.getMonth() ||
		(visit.getMonth() === birthDate.getMonth() && visit.getDate() >= birthDate.getDate());
	return hadBirthday ? years : years - 1;
}

/** A fee for work whose service has no standard price — orthodontics, quoted case by case. */
const FEES = [300, 450, 600, 800, 1200, 1500, 2500, 4000];

export async function seedClinicalRecord(db: SeedDb) {
	if (!(await isEmpty(db, invoice, 'invoice'))) return;

	const done = await db
		.select({
			id: appointment.id,
			patientId: appointment.patientId,
			providerId: appointment.providerId,
			branchId: appointment.branchId,
			startsAt: appointment.startsAt,
			birthDate: patient.birthDate
		})
		.from(appointment)
		.innerJoin(patient, eq(patient.id, appointment.patientId))
		.where(and(eq(appointment.status, 'completed'), isNull(appointment.deletedAt)))
		.limit(400);

	if (!done.length) {
		console.log('No completed appointments; skipping the clinical record.');
		return;
	}

	const [serviceList, medicines] = await Promise.all([
		db
			.select({
				id: services.id,
				name: services.name,
				price: services.price,
				area: services.area,
				removesTooth: services.removesTooth
			})
			.from(services),
		db.select({ id: medicine.id }).from(medicine).limit(20)
	]);

	if (!serviceList.length) {
		console.log('No services; skipping the clinical record.');
		return;
	}

	const random = randomness(20260928);
	const { pick, chance, between } = random;
	// Findings are charted, never billed: a visit's work is drawn from the treatments.
	const treatments = serviceList.filter((s) => s.price !== null && !s.removesTooth);
	const childTreatments = treatments.filter((s) => CHILD_TREATMENTS.has(s.name));
	const extractions = serviceList.filter((s) => s.removesTooth);
	const byName = (name: string) => serviceList.find((s) => s.name === name);
	const caries = byName('Caries');
	const filling = byName('Composite filling');
	const oldFilling = byName('Amalgam filling');
	const lostTooth = byName('Simple extraction');
	let invoices = 0;
	let paid = 0;

	for (const visit of done) {
		const issuedOn = visit.startsAt.toISOString().slice(0, 10);
		const dentition = dentitionForAge(ageAt(visit.birthDate, visit.startsAt));
		const mouth = mouthFor(dentition);
		const child = dentition !== 'permanent';
		const menu = child && childTreatments.length ? childTreatments : treatments;
		const lines = between(1, 3);
		const chosen = Array.from({ length: lines }, () => {
			const service = chance(0.08) && extractions.length ? pick(extractions) : pick(menu);
			const place = placeFor(service.area, random, mouth);
			return { service, fee: service.price ?? pick(FEES), place };
		});
		const subtotal = chosen.reduce((sum, line) => sum + line.fee, 0);
		// Dental treatment is VAT-exempt in many clinics here; the seed bills without it.
		const total = subtotal;

		const procedureIds: number[] = [];
		for (const line of chosen) {
			const [row] = await db
				.insert(procedures)
				.values({
					patientId: visit.patientId,
					appointmentId: visit.id,
					serviceId: line.service.id,
					providerId: visit.providerId,
					branchId: visit.branchId,
					status: 'completed',
					...line.place,
					fee: line.fee,
					completedOn: issuedOn
				})
				.$returningId();
			procedureIds.push(row.id);
		}

		/*
		 * What the examination at a first visit found and did not treat that day: decay charted as
		 * a finding, with the filling for it planned on the same tooth and surfaces. Most charts
		 * carry some, and a chart with none cannot show the difference between the two.
		 */
		if (caries && filling && chance(0.45)) {
			for (let i = between(1, 2); i > 0; i--) {
				const place = placeFor('surface', random, mouth, backTooth(random, mouth));
				const common = {
					patientId: visit.patientId,
					providerId: visit.providerId,
					branchId: visit.branchId,
					...place
				};
				await db
					.insert(procedures)
					.values({ ...common, serviceId: caries.id, status: 'condition', fee: null });
				await db
					.insert(procedures)
					.values({ ...common, serviceId: filling.id, status: 'planned', fee: filling.price });
			}
		}

		/*
		 * Work the patient arrived with: old fillings, and teeth already lost. Never billed here.
		 * An adult's alone — a child's missing tooth is usually just a baby tooth that came out.
		 */
		if (oldFilling && lostTooth && !child && chance(0.35)) {
			const arrivedWith = [
				{ service: oldFilling, place: placeFor('surface', random, mouth) },
				...(chance(0.5) ? [{ service: lostTooth, place: placeFor('tooth', random, mouth) }] : [])
			];
			for (const { service, place } of arrivedWith) {
				await db.insert(procedures).values({
					patientId: visit.patientId,
					serviceId: service.id,
					branchId: visit.branchId,
					status: 'existing',
					...place,
					fee: null
				});
			}
		}

		const [inv] = await db
			.insert(invoice)
			.values({
				patientId: visit.patientId,
				appointmentId: visit.id,
				providerId: visit.providerId,
				branchId: visit.branchId,
				invoiceNumber: `SEED-${visit.id}`,
				issuedOn: issuedOn as never,
				status: 'issued',
				subtotal,
				total,
				approvalStatus: 'approved'
			} as never)
			.$returningId();
		invoices++;

		await db.insert(invoiceLine).values(
			chosen.map((line, i) => ({
				invoiceId: inv.id,
				procedureId: procedureIds[i],
				toothId: line.place.toothId,
				description: line.service.name,
				quantity: 1,
				unitPrice: line.fee,
				lineTotal: line.fee,
				sortOrder: i
			}))
		);

		// Most bills are settled at the desk on the day; some are left part-paid or open.
		const settlement = chance(0.75) ? 'paid' : chance(0.5) ? 'partly' : 'open';
		if (settlement !== 'open') {
			const amount = settlement === 'paid' ? total : Math.round(total / 2);
			const [txn] = await db
				.insert(transactions)
				.values({
					description: `Payment for invoice SEED-${visit.id}`,
					amount: money(amount),
					direction: 'in',
					paymentStatus: 'paid',
					patientId: visit.patientId,
					branchId: visit.branchId,
					occurredOn: issuedOn as never,
					// Numbered like the bill it pays, so a seeded receipt is never blank on paper.
					receiptNumber: `SEED-R-${visit.id}`,
					approvalStatus: 'approved'
				} as never)
				.$returningId();

			await db.insert(invoicePayment).values({
				invoiceId: inv.id,
				transactionId: txn.id,
				amount
			});

			await db
				.update(invoice)
				.set({ status: settlement === 'paid' ? 'paid' : 'partly' })
				.where(eq(invoice.id, inv.id));
			paid++;
		}

		if (chance(0.5)) {
			await db.insert(clinicalNote).values({
				patientId: visit.patientId,
				appointmentId: visit.id,
				providerId: visit.providerId,
				kind: pick(['examination', 'treatment', 'note']),
				summary: 'Seed clinical note',
				body: 'Seeded note: examined, treated as planned, patient advised on aftercare.',
				signedAt: visit.startsAt
			});
		}

		// Treatment plans are seeded from the planned work on the chart, by `./plans.ts`.

		if (medicines.length && chance(0.2)) {
			const [script] = await db
				.insert(prescription)
				.values({
					patientId: visit.patientId,
					providerId: visit.providerId,
					branchId: visit.branchId,
					prescribedOn: issuedOn as never,
					indication: 'Seed prescription'
				})
				.$returningId();

			await db.insert(prescriptionItem).values({
				prescriptionId: script.id,
				medicineId: pick(medicines).id,
				dose: '500 mg',
				frequency: 'Three times a day',
				durationDays: 5,
				instructions: 'After food'
			});
		}

		if (chance(0.25)) {
			await db.insert(recall).values({
				patientId: visit.patientId,
				branchId: visit.branchId,
				dueOn: localDate(between(30, 220)) as never,
				lastVisitOn: issuedOn as never,
				status: 'due',
				note: 'Six-month check-up (seed)'
			});
		}

		if (chance(0.2)) {
			await db.insert(patientConsent).values({
				patientId: visit.patientId,
				consentType: pick(['treatment', 'surgical', 'anaesthetic', 'radiograph']),
				method: 'written',
				givenOn: issuedOn as never,
				givenBy: 'The patient',
				note: 'Seed consent'
			});
		}
	}

	console.log(`Seeded ${invoices} invoices (${paid} with payments) and their clinical rows.`);
}
