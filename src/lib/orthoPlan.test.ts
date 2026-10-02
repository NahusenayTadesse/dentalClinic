import { describe, expect, it } from 'vitest';
import { caseProgress, instalmentSchedule, instalmentState, planProblem } from './orthoPlan';

describe('instalmentSchedule', () => {
	it('takes the deposit on the first day and the rest monthly, adding up to the fee', () => {
		const plan = instalmentSchedule({
			totalFee: 60000,
			deposit: 15000,
			count: 18,
			startedOn: '2026-01-31'
		});
		expect(plan).toHaveLength(19);
		expect(plan[0]).toEqual({ n: 0, dueOn: '2026-01-31', amount: 15000 });
		expect(plan[1]).toEqual({ n: 1, dueOn: '2026-02-28', amount: 2500 });
		expect(plan[18].dueOn).toBe('2027-07-31');
		expect(plan.reduce((sum, i) => sum + i.amount, 0)).toBe(60000);
	});

	it('puts the cents a division leaves on the last instalment', () => {
		const plan = instalmentSchedule({
			totalFee: 1000,
			deposit: 0,
			count: 3,
			startedOn: '2026-03-10'
		});
		expect(plan.map((i) => i.amount)).toEqual([333.33, 333.33, 333.34]);
	});
});

describe('planProblem', () => {
	it('wants a fee, a deposit within it, and instalments for any rest', () => {
		expect(planProblem({ totalFee: 0, deposit: 0, count: 0 })).toMatch(/fee/);
		expect(planProblem({ totalFee: 100, deposit: 200, count: 1 })).toMatch(/deposit/);
		expect(planProblem({ totalFee: 100, deposit: 20, count: 0 })).toMatch(/instalments/);
		expect(planProblem({ totalFee: 100, deposit: 100, count: 0 })).toBeNull();
	});
});

describe('caseProgress', () => {
	it('counts whole months, and says when a case runs over', () => {
		expect(caseProgress('2025-01-15', 18, '2025-07-14')).toMatchObject({ months: 5, percent: 28 });
		expect(caseProgress('2025-01-15', 18, '2027-01-20')).toMatchObject({
			months: 24,
			overrun: true
		});
	});
});

describe('instalmentState', () => {
	it('reads an instalment from its date and its bill', () => {
		const due = { dueOn: '2026-10-01' };
		expect(instalmentState(due, null, '2026-09-30')).toBe('upcoming');
		expect(instalmentState(due, null, '2026-10-01')).toBe('due');
		expect(instalmentState(due, { status: 'issued' }, '2026-10-01')).toBe('billed');
		expect(instalmentState(due, { status: 'partly' }, '2026-10-02')).toBe('overdue');
		expect(instalmentState(due, { status: 'paid' }, '2026-12-01')).toBe('paid');
		expect(instalmentState(due, { status: 'void' }, '2026-12-01')).toBe('cancelled');
	});
});
