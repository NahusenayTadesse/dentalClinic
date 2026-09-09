// One-off seed script: backfills payroll_runs / payroll_entries for every existing
// employee for the last 36 (Gregorian) calendar months, using each employee's current
// salary record. Mirrors the month-labeling convention already used across the app
// (formatEthiopianYearMonth in src/lib/global.svelte.ts), which maps the Gregorian
// month number onto the Ethiopic month-name enum and keeps the Gregorian year as-is.
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './db/schema';
import { and, asc, eq, isNull, or } from 'drizzle-orm';
import {
	employee,
	salaries,
	staffAccounts,
	taxType,
	payrollRuns,
	payrollEntries
} from './db/schema';

const ADMIN_USER_ID = 'atai5lhwzaaeb5fd2jy74yt5';
const MONTHS_BACK = 36;

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

function toMoney(n: number): string {
	if (!isFinite(n) || isNaN(n)) return '0.00';
	return n.toFixed(2);
}

function pad(n: number): string {
	return String(n).padStart(2, '0');
}

function lastDayOfMonth(year: number, month: number): number {
	return new Date(year, month, 0).getDate();
}

async function main() {
	const client = mysql.createPool(process.env.DATABASE_URL!);
	const db = drizzle(client, { schema, mode: 'default' });

	// Build the list of the last MONTHS_BACK Gregorian calendar months, oldest first.
	const now = new Date();
	const periods: { monthName: MonthEnum; year: number; gMonth: number }[] = [];
	for (let i = MONTHS_BACK - 1; i >= 0; i--) {
		const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
		const gMonth = d.getMonth() + 1; // 1-12
		periods.push({
			monthName: ethiopicMonths[gMonth - 1],
			year: d.getFullYear(),
			gMonth
		});
	}

	const employees = await db.select().from(employee);

	const salaryRows = await db.select().from(salaries);
	// Pick each employee's most recent salary row (highest id) as their "current" salary.
	const salaryByStaff = new Map<number, (typeof salaryRows)[number]>();
	for (const s of salaryRows) {
		const existing = salaryByStaff.get(s.staffId);
		if (!existing || s.id > existing.id) salaryByStaff.set(s.staffId, s);
	}

	const accounts = await db
		.select()
		.from(staffAccounts)
		.where(eq(staffAccounts.isActive, true));
	const accountByStaff = new Map<number, (typeof accounts)[number]>();
	for (const a of accounts) {
		if (!accountByStaff.has(a.staffId)) accountByStaff.set(a.staffId, a);
	}

	const taxBrackets = await db
		.select()
		.from(taxType)
		.where(eq(taxType.status, true))
		.orderBy(asc(taxType.threshold));

	function computeTax(taxable: number): number {
		for (const bracket of taxBrackets) {
			const threshold = bracket.threshold ? Number(bracket.threshold) : Infinity;
			if (taxable <= threshold) {
				return Math.max(0, taxable * Number(bracket.rate) - Number(bracket.deduction));
			}
		}
		return 0;
	}

	let periodsSkipped = 0;
	let periodsCreated = 0;
	let entriesCreated = 0;

	for (const period of periods) {
		const existingRun = await db
			.select({ id: payrollRuns.id })
			.from(payrollRuns)
			.where(and(eq(payrollRuns.month, period.monthName), eq(payrollRuns.year, period.year)))
			.then((r) => r[0]);

		if (existingRun) {
			periodsSkipped++;
			continue;
		}

		const lastDay = lastDayOfMonth(period.year, period.gMonth);
		const payPeriodStart = `${period.year}-${pad(period.gMonth)}-01`;
		const payPeriodEnd = `${period.year}-${pad(period.gMonth)}-${pad(lastDay)}`;

		const entryValues: (typeof payrollEntries.$inferInsert)[] = [];

		let totalSalaries = 0;
		let totalTransport = 0;
		let totalHousing = 0;
		let totalPosition = 0;
		let totalNet = 0;
		let totalTax = 0;
		let totalGross = 0;

		for (const emp of employees) {
			const salary = salaryByStaff.get(emp.id);
			if (!salary) continue;

			const basic = Number(salary.amount);
			const transport = Number(salary.transportationAllowance);
			const housing = Number(salary.housingAllowance);
			const nonTax = Number(salary.nonTaxAllowance);
			const position = Number(salary.positionAllowance);

			const gross = basic + transport + housing + nonTax + position;
			const taxable = gross - nonTax;
			const tax = computeTax(taxable);
			const net = gross - tax;

			totalSalaries += basic;
			totalTransport += transport;
			totalHousing += housing;
			totalPosition += position;
			totalNet += net;
			totalTax += tax;
			totalGross += gross;

			const account = accountByStaff.get(emp.id);

			entryValues.push({
				staffId: emp.id,
				month: period.monthName,
				year: period.year,
				payPeriodStart,
				payPeriodEnd,
				basicSalary: toMoney(basic),
				overtimeAmount: '0.00',
				deductions: '0.00',
				commissionAmount: '0.00',
				bonusAmount: '0.00',
				allowances: '0.00',
				transportAllowance: toMoney(transport),
				positionAllowance: toMoney(position),
				housingAllowance: toMoney(housing),
				nonTaxableAllowance: toMoney(nonTax),
				grossAmount: toMoney(gross),
				netAmount: toMoney(net),
				paidAmount: toMoney(net),
				attendancePenality: '0.00',
				taxAmount: toMoney(tax),
				penEm: '0.00',
				penOrg: '0.00',
				status: 'paid',
				paymentMethodId: account?.paymentMethodId ?? null,
				paymentDate: payPeriodEnd,
				notes: 'Seeded payroll history',
				createdBy: ADMIN_USER_ID
			});
		}

		if (entryValues.length === 0) continue;

		const [run] = await db
			.insert(payrollRuns)
			.values({
				month: period.monthName,
				year: period.year,
				totalSalaries: toMoney(totalSalaries),
				totalOvertime: '0.00',
				totalTransport: toMoney(totalTransport),
				totalHousing: toMoney(totalHousing),
				totalPosition: toMoney(totalPosition),
				totalNet: toMoney(totalNet),
				totalDeductions: '0.00',
				totalPenalities: '0.00',
				totalTax: toMoney(totalTax),
				totalGross: toMoney(totalGross),
				penEm: '0.00',
				penOrg: '0.00',
				finalized: true,
				finalizedByUserId: ADMIN_USER_ID,
				finalizedAt: new Date(`${payPeriodEnd}T00:00:00`),
				createdBy: ADMIN_USER_ID
			})
			.$returningId();

		await db.insert(payrollEntries).values(
			entryValues.map((v) => ({ ...v, payrollId: run.id }))
		);

		periodsCreated++;
		entriesCreated += entryValues.length;
		console.log(
			`Seeded ${period.monthName} ${period.year} (${payPeriodStart}..${payPeriodEnd}): ${entryValues.length} entries`
		);
	}

	console.log(
		`\n✅ Done. Created ${periodsCreated} payroll runs (${entriesCreated} entries). Skipped ${periodsSkipped} periods that already had data.`
	);
	await client.end();
}

main().catch((err) => {
	console.error('❌ Payroll history seeding failed:', err);
	process.exit(1);
});
