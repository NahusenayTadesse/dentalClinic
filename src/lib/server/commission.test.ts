import { describe, expect, it } from 'vitest';
import { eq, isNotNull } from 'drizzle-orm';

import { db } from './db';
import {
	employee,
	patient,
	payrollEntries,
	procedures,
	provider,
	salaries,
	services
} from './db/schema';
import { inRollback } from '$lib/testing/rollback';
import { commissionByStaff } from './commission';

/**
 * Commission is money, and the rules that decide it are easy to get subtly wrong: which work
 * counts, and which rate applies when the rate changed mid-month. Built inside a rollback in
 * January 2031, a month no seed data reaches; the dentist, a patient and a service are borrowed.
 */
describe('commission', async () => {
	const [dentist] = await db
		.select({ id: provider.id, employeeId: provider.employeeId })
		.from(provider)
		.limit(1);
	const [someone] = await db.select({ id: patient.id }).from(patient).limit(1);
	const [service] = await db
		.select({ id: services.id })
		.from(services)
		.where(isNotNull(services.price))
		.limit(1);
	const ready = Boolean(dentist && someone && service);

	it.skipIf(!ready)(
		'pays each completed procedure at the rate in force on the day, and nothing else',
		async () => {
			const rows = await inRollback(async (tx) => {
				// Whatever the borrowed dentist is really paid must not leak into January 2031.
				await tx
					.update(salaries)
					.set({ officeCommission: false })
					.where(eq(salaries.staffId, dentist.employeeId));

				const salary = (startDate: string, endDate: string | null, percentage: string) => ({
					staffId: dentist.employeeId,
					amount: '10000',
					startDate,
					endDate,
					officeCommission: true,
					percentage,
					approvalStatus: 'approved' as const
				});
				await tx
					.insert(salaries)
					.values([salary('2031-01-01', '2031-01-15', '20'), salary('2031-01-16', null, '30')]);

				const work = (status: 'completed' | 'planned', completedOn: string, fee: number) => ({
					patientId: someone.id,
					serviceId: service.id,
					providerId: dentist.id,
					status,
					completedOn,
					fee
				});
				await tx.insert(procedures).values([
					work('completed', '2031-01-10', 1000), // 20% → 200
					work('completed', '2031-01-20', 2000), // 30% → 600
					work('planned', '2031-01-20', 5000), // not done: nothing
					work('completed', '2031-02-05', 999) // next month: nothing
				]);

				const sub = commissionByStaff('2031-01-01', '2031-01-30', tx);
				return tx.select().from(sub).where(eq(sub.staffId, dentist.employeeId));
			});

			expect(rows).toHaveLength(1);
			expect(Number(rows[0].production)).toBe(3000);
			expect(Number(rows[0].commission)).toBe(800);
		}
	);

	it.skipIf(!ready)(
		'pays nothing on a salary without commission, or not yet approved',
		async () => {
			const rows = await inRollback(async (tx) => {
				await tx
					.update(salaries)
					.set({ officeCommission: false })
					.where(eq(salaries.staffId, dentist.employeeId));
				await tx.insert(salaries).values({
					staffId: dentist.employeeId,
					amount: '10000',
					startDate: '2031-01-01',
					officeCommission: true,
					percentage: '30',
					approvalStatus: 'pending'
				});
				await tx.insert(procedures).values({
					patientId: someone.id,
					serviceId: service.id,
					providerId: dentist.id,
					status: 'completed',
					completedOn: '2031-01-10',
					fee: 1000
				});

				const sub = commissionByStaff('2031-01-01', '2031-01-30', tx);
				return tx.select().from(sub).where(eq(sub.staffId, dentist.employeeId));
			});

			expect(rows).toHaveLength(0);
		}
	);

	/*
	 * The payroll run joins this beside `payroll_entries`. Drizzle names a subquery's columns
	 * unqualified, and an alias of `commission_amount` — a column of that table — made the whole
	 * payroll page fail as an ambiguous reference while the tests above still passed.
	 */
	it('joins beside payroll entries the way the run does', async () => {
		const sub = commissionByStaff('2031-01-01', '2031-01-30');
		await expect(
			db
				.select({ id: employee.id, commission: sub.commission, production: sub.production })
				.from(employee)
				.leftJoin(sub, eq(sub.staffId, employee.id))
				.leftJoin(payrollEntries, eq(payrollEntries.staffId, employee.id))
				.limit(1)
		).resolves.toBeDefined();
	});
});
