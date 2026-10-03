import { describe, expect, it } from 'vitest';
import { bundleLines, bundlePrices, coverWork, type Allowance } from './packages';

describe('coverWork', () => {
	const allowances: Allowance[] = [
		{
			patientPackageId: 1,
			serviceId: 10,
			left: 1,
			expiresOn: '2027-01-01',
			name: 'Year of cleanings'
		},
		{ patientPackageId: 2, serviceId: 10, left: 3, expiresOn: '2026-11-01', name: 'Spring offer' },
		{ patientPackageId: 3, serviceId: 20, left: 1, expiresOn: '2026-01-01', name: 'Lapsed' }
	];

	it('spends the package expiring soonest first, and stops when the count runs out', () => {
		const work = [1, 2, 3, 4, 5].map((procedureId) => ({ procedureId, serviceId: 10 }));
		const covered = coverWork(allowances, work, '2026-10-03');
		expect([...covered.values()].map((c) => c.patientPackageId)).toEqual([2, 2, 2, 1]);
		expect(covered.has(5)).toBe(false);
	});

	it('does not cover work from an expired package, nor a service it does not include', () => {
		const covered = coverWork(
			allowances,
			[
				{ procedureId: 9, serviceId: 20 },
				{ procedureId: 8, serviceId: 30 }
			],
			'2026-10-03'
		);
		expect(covered.size).toBe(0);
	});
});

describe('bundleLines', () => {
	const items = [
		{ serviceId: 1, quantity: 1 },
		{ serviceId: 2, quantity: 2 }
	];

	it('takes the lines the bundle names, as many as it counts', () => {
		const lines = [
			{ id: 11, serviceId: 2 },
			{ id: 12, serviceId: 1 },
			{ id: 13, serviceId: 2 },
			{ id: 14, serviceId: 3 }
		];
		expect(bundleLines(items, lines)?.map((l) => l.id)).toEqual([12, 11, 13]);
	});

	it('refuses a bill that does not hold the whole bundle', () => {
		expect(
			bundleLines(items, [
				{ id: 11, serviceId: 1 },
				{ id: 12, serviceId: 2 }
			])
		).toBeNull();
	});
});

describe('bundlePrices', () => {
	it('shares the package price in proportion, adding up exactly', () => {
		const prices = bundlePrices([600, 1000, 500], 1500);
		expect(prices).toEqual([428.57, 714.29, 357.14]);
		expect(prices.reduce((s, p) => Math.round((s + p) * 100) / 100, 0)).toBe(1500);
	});

	it('shares equally among lines with no price', () => {
		expect(bundlePrices([0, 0, 0], 100)).toEqual([33.33, 33.33, 33.34]);
	});
});
