// One-off seed script: backfills `site_monthly_payments` (+ their backing `transactions` row)
// for every approved `payment_request` whose site has a resolvable contract in `site_contracts`.
// Diversifies payment method, transaction status, and payment date (relative to the request
// date) across rows. Skips requests that can't be tied to a real contract, and skips any
// (contract, month, year) combo that already has a payment on file, since that's effectively
// the natural "already paid" key for this table.
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './db/schema';
import { site, siteContracts, paymentRequest, siteMonthlyPayments, transactions, user } from './db/schema';

const ADMIN_USER_ID = 'atai5lhwzaaeb5fd2jy74yt5';

function pad(n: number): string {
	return String(n).padStart(2, '0');
}

function toMoney(n: number): string {
	if (!isFinite(n) || isNaN(n)) return '0.00';
	return n.toFixed(2);
}

function pick<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)];
}

function weightedPick<T>(items: { value: T; weight: number }[]): T {
	const total = items.reduce((a, i) => a + i.weight, 0);
	let r = Math.random() * total;
	for (const i of items) {
		r -= i.weight;
		if (r <= 0) return i.value;
	}
	return items[items.length - 1].value;
}

// Mimics generateFileName() from $lib/global.svelte closely enough
// for a fake-file placeholder — same shape as real uploaded filenames without depending on it.
const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567';
function fakeFileName(ext: string): string {
	let s = '';
	for (let i = 0; i < 24; i++) s += BASE32[Math.floor(Math.random() * BASE32.length)];
	return `${s}.${ext}`;
}

function fakeFile(): string {
	return fakeFileName(pick(['png', 'jpg', 'webp', 'pdf']));
}

function addDays(dateStr: string, days: number): string {
	const d = new Date(dateStr);
	d.setDate(d.getDate() + days);
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function main() {
	const client = mysql.createPool(process.env.DATABASE_URL!);
	const db = drizzle(client, { schema, mode: 'default' });

	const sites = await db.select().from(site);
	const contracts = await db.select().from(siteContracts);
	const users = await db.select({ id: user.id }).from(user);
	const userIds = users.map((u) => u.id);

	const contractsBySite = new Map<number, (typeof contracts)[number][]>();
	for (const c of contracts) {
		const list = contractsBySite.get(c.siteId) ?? [];
		list.push(c);
		contractsBySite.set(c.siteId, list);
	}

	const existingPayments = await db
		.select({
			contractId: siteMonthlyPayments.contractId,
			month: siteMonthlyPayments.month,
			year: siteMonthlyPayments.year
		})
		.from(siteMonthlyPayments);
	const existingKeys = new Set(existingPayments.map((p) => `${p.contractId}_${p.month}_${p.year}`));

	const paymentMethodWeights = [
		{ value: 3, weight: 5 }, // CBE
		{ value: 4, weight: 3 }, // Awash
		{ value: 5, weight: 2 }, // Dashen
		{ value: 6, weight: 2 }, // Abyssinia
		{ value: 7, weight: 1 }, // Coop Bank of Oromia
		{ value: 9, weight: 1 }, // Nib
		{ value: 10, weight: 1 }, // Birhan
		{ value: 2, weight: 2 }, // CBE Birr
		{ value: 1, weight: 2 }, // Telebirr
		{ value: 8, weight: 1 } // Cash
	];

	const statusWeights: { value: 'pending' | 'approved' | 'rejected'; weight: number }[] = [
		{ value: 'approved', weight: 80 },
		{ value: 'pending', weight: 14 },
		{ value: 'rejected', weight: 6 }
	];

	const txStatusForPaymentStatus: Record<string, { value: string; weight: number }[]> = {
		approved: [
			{ value: 'paid', weight: 85 },
			{ value: 'partially_paid', weight: 8 },
			{ value: 'overpaid', weight: 3 },
			{ value: 'disputed', weight: 2 },
			{ value: 'refunded', weight: 2 }
		],
		pending: [
			{ value: 'pending', weight: 70 },
			{ value: 'partially_paid', weight: 30 }
		],
		rejected: [
			{ value: 'unpaid', weight: 60 },
			{ value: 'disputed', weight: 40 }
		]
	};

	const rows = await db.select().from(paymentRequest);
	const approved = rows.filter((r) => r.status === 'approved');

	let skippedNoContract = 0;
	let skippedDuplicate = 0;
	let inserted = 0;
	const byMethod: Record<number, number> = {};
	const byTxStatus: Record<string, number> = {};

	for (const req of approved) {
		const candidateContracts = req.contractId
			? contracts.filter((c) => c.id === req.contractId)
			: contractsBySite.get(req.siteId) ?? [];

		if (!candidateContracts.length) {
			skippedNoContract++;
			continue;
		}

		const contract = pick(candidateContracts);
		const key = `${contract.id}_${req.month}_${req.year}`;
		if (existingKeys.has(key)) {
			skippedDuplicate++;
			continue;
		}
		existingKeys.add(key); // reserve, in case multiple requests resolve to the same contract/period

		const requestAmount = Number(req.amount) > 0 ? Number(req.amount) : Number(contract.monthlyAmount) || 50000;
		const vatRate = Number(req.vat) || 15;
		const withholdRate = Number(req.withholding) || 3;
		const penaltyAmount = Number(req.penality) || 0;

		const beforeVat = requestAmount / (1 + vatRate / 100);
		const withholdAmount = Math.round(beforeVat * (withholdRate / 100) * 100) / 100;
		const paymentAmount = Math.round((requestAmount - withholdAmount - penaltyAmount) * 100) / 100;

		const paymentMethodId = weightedPick(paymentMethodWeights);
		const paymentStatus = weightedPick(statusWeights);
		const txStatus = weightedPick(txStatusForPaymentStatus[paymentStatus]) as
			| 'pending'
			| 'paid'
			| 'unpaid'
			| 'refunded'
			| 'partially_paid'
			| 'partially_refunded'
			| 'overpaid'
			| 'disputed';

		// Payment lands anywhere from a few days to ~6 weeks after the request went in.
		const paymentDate = addDays(req.requestDate, 4 + Math.floor(Math.random() * 40));

		const createdBy = userIds.length ? pick(userIds) : ADMIN_USER_ID;
		const approvedByUser =
			paymentStatus !== 'pending' && userIds.length ? pick(userIds) : undefined;

		const [txId] = await db
			.insert(transactions)
			.values({
				description: 'Customer Monthly Payment',
				amount: toMoney(paymentAmount),
				paymentStatus: txStatus,
				paymentMethodId,
				recieptLink: fakeFile(),
				createdBy
			})
			.$returningId();

		const hasWithholdFile = withholdAmount > 0 && Math.random() < 0.85;

		await db.insert(siteMonthlyPayments).values({
			contractId: contract.id,
			paymentRequestFile: fakeFile(),
			penaltyAmount: toMoney(penaltyAmount),
			fsNumber: `FS-${req.year}-${1000 + Math.floor(Math.random() * 9000)}`,
			invoiceNumber: req.invoiceNumber,
			requestAmount: toMoney(requestAmount),
			paymentAmount: toMoney(paymentAmount),
			beforeVat: toMoney(beforeVat),
			vat: toMoney(vatRate),
			withholdAmount: toMoney(withholdAmount),
			withholdFile: hasWithholdFile ? fakeFile() : undefined,
			withholdInvoiceNumber: withholdAmount > 0 ? `WH-${1000 + Math.floor(Math.random() * 9000)}` : undefined,
			month: req.month,
			year: req.year,
			date: paymentDate,
			status: paymentStatus,
			approvedBy: approvedByUser,
			transactionId: txId.id,
			createdBy
		});

		inserted++;
		byMethod[paymentMethodId] = (byMethod[paymentMethodId] ?? 0) + 1;
		byTxStatus[txStatus] = (byTxStatus[txStatus] ?? 0) + 1;
	}

	console.log(`✅ Inserted ${inserted} payments.`);
	console.log(`Skipped (no contract found for site): ${skippedNoContract}`);
	console.log(`Skipped (duplicate contract/month/year): ${skippedDuplicate}`);
	console.log('By payment method id:', byMethod);
	console.log('By transaction status:', byTxStatus);

	await client.end();
}

main().catch((err) => {
	console.error('❌ Payment seeding failed:', err);
	process.exit(1);
});
