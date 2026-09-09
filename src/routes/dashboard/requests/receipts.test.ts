import { describe, expect, it } from 'vitest';
import { groupReceipts, idsField, parseIdsField, receiptKey } from './receipts';

const row = (id: number, invoiceNumber: string, siteId: number, month: string, year = 2018) => ({
	id,
	invoiceNumber,
	siteId,
	month,
	year
});

describe('groupReceipts', () => {
	it('leaves an ordinary one-month request as a receipt of one', () => {
		const receipts = groupReceipts([row(1, 'INV-5-a', 5, 'ሰኔ')]);

		expect(receipts).toHaveLength(1);
		expect(receipts[0].months).toEqual([{ id: 1, month: 'ሰኔ', year: 2018 }]);
		expect(receipts[0].ids).toEqual([1]);
	});

	it('folds a special request back into one receipt covering every month', () => {
		const receipts = groupReceipts([
			row(11, 'INV-5-b', 5, 'ሐምሌ'),
			row(12, 'INV-5-b', 5, 'ሰኔ'),
			row(13, 'INV-5-b', 5, 'ነሐሴ')
		]);

		expect(receipts).toHaveLength(1);
		expect(receipts[0].ids).toEqual([12, 11, 13]);
		// Calendar order, not insertion or id order: ሰኔ (10), ሐምሌ (11), ነሐሴ (12).
		expect(receipts[0].months.map((m) => m.month)).toEqual(['ሰኔ', 'ሐምሌ', 'ነሐሴ']);
		expect(receipts[0].head.id).toBe(12);
	});

	it('orders months across a year boundary', () => {
		const receipts = groupReceipts([
			row(21, 'INV-7-c', 7, 'መስከረም', 2019),
			row(22, 'INV-7-c', 7, 'ነሐሴ', 2018)
		]);

		expect(receipts[0].months.map((m) => `${m.month} ${m.year}`)).toEqual([
			'ነሐሴ 2018',
			'መስከረም 2019'
		]);
	});

	it('keeps two sites apart even if their invoice numbers collide', () => {
		// The generator only randomises within a site, so the key carries siteId.
		const receipts = groupReceipts([row(31, 'INV-dup', 1, 'ሰኔ'), row(32, 'INV-dup', 2, 'ሰኔ')]);

		expect(receipts).toHaveLength(2);
		expect(receipts.map((r) => r.siteId)).toEqual([1, 2]);
	});

	it('preserves the order the rows arrived in', () => {
		const receipts = groupReceipts([
			row(41, 'INV-1-x', 1, 'ሰኔ'),
			row(42, 'INV-2-y', 2, 'ሰኔ'),
			row(43, 'INV-1-x', 1, 'ሐምሌ')
		]);

		expect(receipts.map((r) => r.key)).toEqual(['1::INV-1-x', '2::INV-2-y']);
	});
});

describe('the ids field', () => {
	it('round-trips a receipt through a form', () => {
		expect(parseIdsField(idsField([3, 1, 2]))).toEqual([3, 1, 2]);
	});

	it('drops anything that is not a row id rather than passing NaN to a query', () => {
		expect(parseIdsField('4, , abc,-1,0,5')).toEqual([4, 5]);
		expect(parseIdsField(null)).toEqual([]);
	});
});

describe('receiptKey', () => {
	it('is the site and the invoice number', () => {
		expect(receiptKey(row(1, 'INV-9-z', 9, 'ሰኔ'))).toBe('9::INV-9-z');
	});
});
