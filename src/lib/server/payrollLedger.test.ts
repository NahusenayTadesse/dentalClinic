import { describe, expect, it } from 'vitest';
import { and, eq, inArray, isNull } from 'drizzle-orm';

import { db } from './db';
import {
	bonuses,
	employee,
	overTime,
	overTimeType,
	payrollEntries,
	payrollRuns,
	salaries
} from './db/schema';
import { inRollback, type TestTx } from '$lib/testing/rollback';
import { WriteRefused } from './childCrud';
import { HOURS_PER_MONTH, recordAdjustments, removeAdjustment } from './payrollLedgerWrites';
import { insertReturningId } from './db/insert';

/**
 * The adjustment rules the old month pages broke: overtime priced from the salary in force (one
 * entry per employee, however long their pay history), refusals that roll back, and a paid month
 * closed. Built inside rollbacks; two approved employees and an overtime type are borrowed, and
 * each is given a salary history of its own here.
 */
describe('pay adjustment ledgers', async () => {
	const staff = await db
		.select({ id: employee.id })
		.from(employee)
		.where(
			and(
				eq(employee.isActive, true),
				eq(employee.approvalStatus, 'approved'),
				isNull(employee.deletedAt)
			)
		)
		.limit(2);
	const [type] = await db
		.select({ id: overTimeType.id, rate: overTimeType.rate })
		.from(overTimeType)
		.where(isNull(overTimeType.deletedAt))
		.limit(1);
	const ready = staff.length === 2 && Boolean(type);

	const request = {
		locals: { user: null, branch: { active: null } },
		getClientAddress: () => '127.0.0.1'
	};
	const day = '2031-03-15';

	/** Replaces the borrowed employees' salaries with a known history: an old one, then 19,200. */
	async function salaryHistory(tx: TestTx) {
		const ids = staff.map((s) => s.id);
		await tx.delete(salaries).where(inArray(salaries.staffId, ids));
		for (const id of ids) {
			await tx.insert(salaries).values([
				{
					staffId: id,
					amount: '9600',
					startDate: '2030-01-01',
					endDate: '2030-12-31',
					approvalStatus: 'approved'
				},
				{ staffId: id, amount: '19200', startDate: '2031-01-01', approvalStatus: 'approved' }
			]);
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

	it.skipIf(!ready)(
		'prices overtime from the salary in force, once per employee, for several at once',
		async () => {
			const rows = await inRollback(async (tx) => {
				await salaryHistory(tx);
				await recordAdjustments(
					tx,
					request,
					'overtime',
					staff.map((s) => s.id),
					{ date: day, typeId: type.id, type: null, hours: 4, amount: null, reason: 'Test' }
				);
				return tx
					.select({ staffId: overTime.staffId, total: overTime.total })
					.from(overTime)
					.where(
						and(
							inArray(
								overTime.staffId,
								staff.map((s) => s.id)
							),
							eq(overTime.date, day)
						)
					);
			});

			// One each, however many salary rows; priced from 19,200, not the old 9,600.
			expect(rows).toHaveLength(2);
			const expected = (19200 / HOURS_PER_MONTH) * Number(type.rate) * 4;
			for (const row of rows) expect(Number(row.total)).toBeCloseTo(expected, 2);
		}
	);

	it.skipIf(!ready)(
		'refuses everyone when one has no salary that day, and records nothing',
		async () => {
			const result = await inRollback(async (tx) => {
				await salaryHistory(tx);
				// The second employee's current salary starts after the day.
				await tx
					.update(salaries)
					.set({ startDate: '2031-06-01' })
					.where(and(eq(salaries.staffId, staff[1].id), isNull(salaries.endDate)));
				const reason = await refused(
					recordAdjustments(
						tx,
						request,
						'overtime',
						staff.map((s) => s.id),
						{ date: day, typeId: type.id, type: null, hours: 2, amount: null, reason: null }
					)
				);
				const made = await tx
					.select({ id: overTime.id })
					.from(overTime)
					.where(and(eq(overTime.date, day), eq(overTime.staffId, staff[0].id)));
				return { reason, made };
			});

			expect(result.reason).toMatch(/No approved salary/);
			// Refused before anything was written: the first employee, who had a salary, got nothing
			// either — all or none.
			expect(result.made).toHaveLength(0);
		}
	);

	it.skipIf(!ready)('closes a paid month to new entries and to removing old ones', async () => {
		const result = await inRollback(async (tx) => {
			const [first] = staff;
			await recordAdjustments(tx, request, 'bonuses', [first.id], {
				date: day,
				typeId: null,
				type: null,
				hours: null,
				amount: 500,
				reason: 'Before the run'
			});

			// The month is paid: a payslip covering the day.
			const runId = await insertReturningId(tx, payrollRuns, {
				month: 'መጋቢት',
				year: 2023,
				totalGross: '0',
				totalTax: '0',
				totalPosition: '0',
				totalPenalities: '0',
				totalHousing: '0',
				totalNet: '0',
				totalDeductions: '0',
				penEm: '0',
				penOrg: '0'
			});
			await insertReturningId(tx, payrollEntries, {
				payrollId: runId,
				staffId: first.id,
				month: 'መጋቢት',
				year: 2023,
				payPeriodStart: '2031-03-10',
				payPeriodEnd: '2031-04-08',
				status: 'paid'
			});

			const adding = await refused(
				recordAdjustments(tx, request, 'deductions', [first.id], {
					date: day,
					typeId: null,
					type: 'Penalty',
					hours: null,
					amount: 100,
					reason: 'Late'
				})
			);
			const [bonus] = await tx
				.select({ id: bonuses.id })
				.from(bonuses)
				.where(and(eq(bonuses.staffId, first.id), eq(bonuses.bonusDate, day)));
			const removing = await refused(removeAdjustment(tx, request, 'bonuses', bonus.id));
			return { adding, removing };
		});

		expect(result.adding).toMatch(/Already paid for that month/);
		expect(result.removing).toMatch(/Already paid for that month/);
	});
});
