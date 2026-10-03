/**
 * Payers whose cover rules actually do something, and patients who belong to them.
 *
 * The two payers seeded with the patients cover everything, with no yearly limit and no
 * pre-authorisation — so a bill to either is never split into a co-payment, never stops at a limit,
 * and never asks for an authorisation. Every one of those paths (`server/payerCover.ts`) was
 * reachable only by setting a payer up by hand first. These three exercise them:
 *
 *   - **Seed Mutual Insurance** — 80%, a 15,000 birr yearly limit per member, pre-authorisation
 *     required; some of its members hold an authorisation (approved, requested, declined, expired)
 *   - **Seed Bank Staff Scheme** — 50%, an 8,000 birr limit, no pre-authorisation
 *   - **Seed Pending Insurer** — waiting in Approvals → Payers, so that queue has something in it
 *
 * Skipped once the first of them exists, like every other step.
 */
import { and, eq, isNull } from 'drizzle-orm';
import { customers, payerAuthorisation } from '../../src/lib/server/db/schema/customers';
import { patient } from '../../src/lib/server/db/schema/patients';
import { localDate, randomness, type SeedDb } from './util';

const MUTUAL = 903;
const BANK = 904;
const PENDING = 905;

export async function seedPayerCover(db: SeedDb) {
	const [already] = await db
		.select({ id: customers.id })
		.from(customers)
		.where(eq(customers.id, MUTUAL));
	if (already) {
		console.log('Payer cover already seeded; skipping.');
		return;
	}

	await db.insert(customers).values([
		{
			id: MUTUAL,
			name: 'Seed Mutual Insurance',
			phone: '0110000903',
			email: 'seed903@example.test',
			tinNo: 'SEED-903',
			approvalStatus: 'approved',
			coveragePercent: 80,
			annualLimit: 15000,
			requiresPreauth: true
		},
		{
			id: BANK,
			name: 'Seed Bank Staff Scheme',
			phone: '0110000904',
			email: 'seed904@example.test',
			tinNo: 'SEED-904',
			approvalStatus: 'approved',
			coveragePercent: 50,
			annualLimit: 8000,
			requiresPreauth: false
		},
		{
			id: PENDING,
			name: 'Seed Pending Insurer',
			phone: '0110000905',
			email: 'seed905@example.test',
			tinNo: 'SEED-905',
			approvalStatus: 'pending',
			coveragePercent: 70
		}
	]);

	// Members: patients who pay cash today, about twenty to each scheme, with member numbers.
	const { pick, chance, between } = randomness(20261003);
	const cashPatients = await db
		.select({ id: patient.id })
		.from(patient)
		.where(and(isNull(patient.customerId), isNull(patient.deletedAt), isNull(patient.mergedIntoId)))
		.limit(40);

	const members: number[] = [];
	for (const [i, p] of cashPatients.entries()) {
		const payer = i % 2 === 0 ? MUTUAL : BANK;
		await db
			.update(patient)
			.set({ customerId: payer, payerMemberNo: `${payer === MUTUAL ? 'SMI' : 'SBS'}-${10000 + i}` })
			.where(eq(patient.id, p.id));
		if (payer === MUTUAL) members.push(p.id);
	}

	// Authorisations for most Mutual members, one in each state, so the pre-auth check has a
	// "yes", a "not yet", a "no" and a "too late" to meet.
	const states = ['approved', 'approved', 'requested', 'declined', 'expired'] as const;
	for (const [i, patientId] of members.entries()) {
		if (!chance(0.8)) continue;
		const state = states[i % states.length];
		const requested = pick([1200, 2500, 4000, 6500, 9000]);
		await db.insert(payerAuthorisation).values({
			patientId,
			customerId: MUTUAL,
			reference: `SMI-PA-${2000 + i}`,
			requestedAmount: requested,
			approvedAmount: state === 'approved' || state === 'expired' ? requested : null,
			status: state === 'expired' ? 'approved' : state,
			validUntil: localDate(state === 'expired' ? -between(5, 40) : between(20, 90)),
			note: state === 'declined' ? 'Cosmetic work is not covered (seed)' : null
		});
	}

	console.log(
		`Seeded 3 payers with cover rules, ${cashPatients.length} members, and their authorisations.`
	);
}
