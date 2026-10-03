import { describe, expect, it } from 'vitest';
import { matchOrder, statusFromLines, suggestedQuantity } from './purchasing';

describe('statusFromLines', () => {
	it('follows what has arrived, and leaves drafts and cancellations alone', () => {
		const lines = [
			{ quantity: 10, received: 0 },
			{ quantity: 5, received: 0 }
		];
		expect(statusFromLines('sent', lines)).toBe('sent');
		expect(statusFromLines('sent', [{ quantity: 10, received: 4 }, lines[1]])).toBe('partly');
		expect(
			statusFromLines('partly', [
				{ quantity: 10, received: 10 },
				{ quantity: 5, received: 5 }
			])
		).toBe('received');
		expect(statusFromLines('draft', lines)).toBe('draft');
		expect(statusFromLines('cancelled', lines)).toBe('cancelled');
	});
});

describe('suggestedQuantity', () => {
	it('orders back up to twice the reorder level', () => {
		expect(suggestedQuantity(3, 10)).toBe(17);
		expect(suggestedQuantity(-2, 5)).toBe(10);
		expect(suggestedQuantity(30, 10)).toBe(1);
		expect(suggestedQuantity(0, null)).toBe(1);
	});
});

describe('matchOrder', () => {
	const lines = [
		{ quantity: 10, received: 6, unitCost: 100 },
		{ quantity: 2, received: 2, unitCost: 250 }
	];

	it('sets ordered, received and invoiced side by side', () => {
		expect(matchOrder(lines, [{ amount: 1100 }])).toEqual({
			ordered: 1500,
			received: 1100,
			invoiced: 1100,
			overInvoiced: false,
			short: true,
			unpriced: false
		});
	});

	it('says when the invoice is for more than arrived', () => {
		expect(matchOrder(lines, [{ amount: 1500 }]).overInvoiced).toBe(true);
	});

	it('says when a line has no price to check against', () => {
		expect(matchOrder([{ quantity: 1, received: 1, unitCost: null }], []).unpriced).toBe(true);
	});
});
