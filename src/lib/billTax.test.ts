import { describe, expect, it } from 'vitest';
import { billTotals } from './billTax';

const registered = { registered: true, rate: 15 };

describe('billTotals', () => {
	it('charges no VAT when the clinic is not registered, whatever the lines say', () => {
		expect(
			billTotals([{ lineTotal: 1000, taxable: true }], 0, { registered: false, rate: 15 })
		).toEqual({ subtotal: 1000, discount: 0, vat: null, rate: null, total: 1000 });
	});

	it('charges VAT on the taxable lines only', () => {
		const lines = [
			{ lineTotal: 2000, taxable: false }, // a filling: exempt
			{ lineTotal: 200, taxable: true } // a toothbrush sold
		];
		expect(billTotals(lines, 0, registered)).toEqual({
			subtotal: 2200,
			discount: 0,
			vat: 30,
			rate: 15,
			total: 2230
		});
	});

	it('takes the discount off the taxable part in proportion before charging VAT', () => {
		// 10% off a bill that is half taxable: VAT on 450, not on 500.
		const lines = [
			{ lineTotal: 500, taxable: false },
			{ lineTotal: 500, taxable: true }
		];
		expect(billTotals(lines, 100, registered)).toEqual({
			subtotal: 1000,
			discount: 100,
			vat: 67.5,
			rate: 15,
			total: 967.5
		});
	});

	it('charges nothing extra on an all-exempt bill, and never discounts below zero', () => {
		expect(billTotals([{ lineTotal: 800, taxable: false }], 900, registered)).toEqual({
			subtotal: 800,
			discount: 800,
			vat: null,
			rate: null,
			total: 0
		});
	});
});
