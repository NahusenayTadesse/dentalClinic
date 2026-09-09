// One-off seed script: backfills `payment_request` for every existing site (i.e. every
// customer's sites) across the last 36 real Ethiopian calendar months, with a mix of
// pending/approved/rejected statuses. Uses true Ethiopian years (via
// ethiopian-calendar-new), matching the convention the existing 60 real rows already use
// (e.g. month='ነሐሴ', year=2018), unlike some other modules in this codebase that mislabel
// Gregorian years as Ethiopian ones.
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './db/schema';
import { eq } from 'drizzle-orm';
import { site, siteContracts, employee, paymentRequest } from './db/schema';
import { toEthiopian, toGregorian } from 'ethiopian-calendar-new';

const MONTHS_BACK = 36;
const ADMIN_USER_ID = 'atai5lhwzaaeb5fd2jy74yt5';

const ethiopicMonths = [
	'መስከረም',
	'ጥቅምት',
	'ህዳር',
	'ታህሳስ',
	'ጥር',
	'የካቲት',
	'መጋቢት',
	'ሚያዝያ',
	'ግንቦት',
	'ሰኔ',
	'ሐምሌ',
	'ነሐሴ'
] as const;

type MonthEnum = (typeof ethiopicMonths)[number];

const rejectionReasons = [
	'Invoice amount mismatch with contract',
	'Missing supporting documents',
	'Duplicate request for the same period',
	'Incorrect VAT/withholding calculation',
	'Awaiting customer confirmation of service delivery',
	'Contract on hold pending renewal'
];

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

function weightedStatus(monthsAgo: number): 'pending' | 'approved' | 'rejected' {
	const r = Math.random();
	if (monthsAgo <= 1) {
		// Most recent one to two months: mostly still pending
		if (r < 0.65) return 'pending';
		if (r < 0.85) return 'approved';
		return 'rejected';
	}
	// Older periods: mostly resolved
	if (r < 0.82) return 'approved';
	if (r < 0.94) return 'rejected';
	return 'pending';
}

async function main() {
	const client = mysql.createPool(process.env.DATABASE_URL!);
	const db = drizzle(client, { schema, mode: 'default' });

	const now = new Date();
	const ethNow = toEthiopian(now.getFullYear(), now.getMonth() + 1, now.getDate());

	// Build the last MONTHS_BACK Ethiopian (month, year) periods, oldest first.
	const periods: { monthName: MonthEnum; monthIndex: number; year: number }[] = [];
	let m = ethNow.month;
	let y = ethNow.year;
	const collected: typeof periods = [];
	for (let i = 0; i < MONTHS_BACK; i++) {
		collected.push({ monthName: ethiopicMonths[m - 1], monthIndex: m, year: y });
		m -= 1;
		if (m < 1) {
			m = 12;
			y -= 1;
		}
	}
	collected.reverse();
	periods.push(...collected);

	const sites = await db.select().from(site);
	const contracts = await db.select().from(siteContracts);
	const officeEmployees = await db.select().from(employee).where(eq(employee.departmentId, 8));
	const employeeIds = officeEmployees.map((e) => e.id);

	// Best-effort baseline monthly amount per customer, since site_contracts.site_id is
	// broken (0) in this dataset and can't be trusted to map a contract to a specific site.
	const amountsByCustomer = new Map<number, number[]>();
	for (const c of contracts) {
		const amt = Number(c.monthlyAmount);
		if (!amt) continue;
		const list = amountsByCustomer.get(c.customerId) ?? [];
		list.push(amt);
		amountsByCustomer.set(c.customerId, list);
	}

	function baseAmountFor(customerId: number): number {
		const list = amountsByCustomer.get(customerId);
		if (list && list.length) return list.reduce((a, b) => a + b, 0) / list.length;
		return 15000 + Math.random() * 35000;
	}

	const existing = await db
		.select({ siteId: paymentRequest.siteId, month: paymentRequest.month, year: paymentRequest.year })
		.from(paymentRequest);
	const existingKeys = new Set(existing.map((r) => `${r.siteId}_${r.month}_${r.year}`));

	const rows: (typeof paymentRequest.$inferInsert)[] = [];

	for (const s of sites) {
		const startDate =
			s.startDate && s.startDate !== '0000-00-00' ? new Date(s.startDate) : null;
		const baseAmount = baseAmountFor(s.customerId);

		periods.forEach((period, idx) => {
			const key = `${s.id}_${period.monthName}_${period.year}`;
			if (existingKeys.has(key)) return;

			const periodEndGreg = toGregorian(period.year, period.monthIndex, 30);
			const periodEndDate = new Date(periodEndGreg.year, periodEndGreg.month - 1, periodEndGreg.day);
			if (startDate && startDate > periodEndDate) return;

			const monthsAgo = periods.length - 1 - idx;
			const status = weightedStatus(monthsAgo);

			const variance = 0.95 + Math.random() * 0.1;
			const amount = Math.round(baseAmount * variance * 100) / 100;

			const hasPenalty = Math.random() < 0.12;
			const penalty = hasPenalty ? Math.round(amount * (0.01 + Math.random() * 0.02) * 100) / 100 : 0;

			const reqDayGreg = toGregorian(period.year, period.monthIndex, 3 + Math.floor(Math.random() * 5));
			const requestDate = `${reqDayGreg.year}-${pad(reqDayGreg.month)}-${pad(reqDayGreg.day)}`;

			const requestedBy = employeeIds.length ? pick(employeeIds) : undefined;
			const approvedBy =
				status !== 'pending' && employeeIds.length ? pick(employeeIds) : undefined;
			const rejectedReason = status === 'rejected' ? pick(rejectionReasons) : undefined;

			const timestamp = Date.now() + Math.floor(Math.random() * 1000);
			const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
			const invoiceNumber = `INV-${s.id}-${period.year}${pad(period.monthIndex)}-${randomStr}${idx}${timestamp % 1000}`;

			rows.push({
				siteId: s.id,
				contractId: null,
				invoiceNumber,
				requestDate,
				vat: '15.00',
				withholding: '3.00',
				amount: toMoney(amount),
				month: period.monthName,
				year: period.year,
				penality: toMoney(penalty),
				requestedBy,
				rejectedReason,
				approvedBy,
				status,
				createdBy: ADMIN_USER_ID
			});
		});
	}

	const BATCH = 200;
	for (let i = 0; i < rows.length; i += BATCH) {
		await db.insert(paymentRequest).values(rows.slice(i, i + BATCH));
	}

	const byStatus = rows.reduce<Record<string, number>>((acc, r) => {
		acc[r.status!] = (acc[r.status!] ?? 0) + 1;
		return acc;
	}, {});

	console.log(`✅ Inserted ${rows.length} payment requests across ${sites.length} sites.`);
	console.log('Status breakdown:', byStatus);

	await client.end();
}

main().catch((err) => {
	console.error('❌ Payment request seeding failed:', err);
	process.exit(1);
});
