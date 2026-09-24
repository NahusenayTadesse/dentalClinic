/**
 * What a completed visit leaves behind: the work done, a note, a bill, and sometimes a plan, a
 * prescription or a recall.
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
import { treatmentPlan, treatmentPlanItem } from '../../src/lib/server/db/schema/treatmentPlans';
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

/** What each service costs, roughly, so a bill is not a round number every time. */
const FEES = [300, 450, 600, 800, 1200, 1500, 2500, 4000];

export async function seedClinicalRecord(db: SeedDb) {
	if (!(await isEmpty(db, invoice, 'invoice'))) return;

	const done = await db
		.select({
			id: appointment.id,
			patientId: appointment.patientId,
			providerId: appointment.providerId,
			branchId: appointment.branchId,
			startsAt: appointment.startsAt
		})
		.from(appointment)
		.where(and(eq(appointment.status, 'completed'), isNull(appointment.deletedAt)))
		.limit(400);

	if (!done.length) {
		console.log('No completed appointments; skipping the clinical record.');
		return;
	}

	const [serviceList, medicines] = await Promise.all([
		db.select({ id: services.id, name: services.name }).from(services),
		db.select({ id: medicine.id }).from(medicine).limit(20)
	]);

	if (!serviceList.length) {
		console.log('No services; skipping the clinical record.');
		return;
	}

	const { pick, chance, between } = randomness(20260928);
	let invoices = 0;
	let paid = 0;

	for (const visit of done) {
		const issuedOn = visit.startsAt.toISOString().slice(0, 10);
		const lines = between(1, 3);
		const chosen = Array.from({ length: lines }, () => ({
			service: pick(serviceList),
			fee: pick(FEES)
		}));
		const subtotal = chosen.reduce((sum, line) => sum + line.fee, 0);
		// Dental treatment is VAT-exempt in many clinics here; the seed bills without it.
		const total = subtotal;

		for (const line of chosen) {
			await db.insert(procedures).values({
				patientId: visit.patientId,
				appointmentId: visit.id,
				serviceId: line.service.id,
				providerId: visit.providerId,
				branchId: visit.branchId,
				status: 'completed',
				fee: line.fee,
				completedOn: issuedOn as never,
				note: 'Seed procedure'
			});
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

		if (chance(0.15)) {
			const [plan] = await db
				.insert(treatmentPlan)
				.values({
					patientId: visit.patientId,
					providerId: visit.providerId,
					branchId: visit.branchId,
					status: pick(['draft', 'presented', 'accepted', 'partial']),
					presentedOn: issuedOn as never,
					validUntil: localDate(between(60, 200)) as never,
					note: 'Seed treatment plan'
				})
				.$returningId();

			const item = pick(serviceList);
			const fee = pick(FEES);
			await db.insert(treatmentPlanItem).values({
				treatmentPlanId: plan.id,
				description: item.name,
				quantity: 1,
				unitPrice: fee,
				lineTotal: fee,
				decision: pick(['pending', 'accepted', 'declined'])
			});
		}

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
