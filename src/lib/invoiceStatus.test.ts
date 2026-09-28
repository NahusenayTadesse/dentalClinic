import { describe, expect, it } from 'vitest';
import { canPay, canRequestVoid, discountNeedsApproval, statusAfterPayment } from './invoiceStatus';

describe('invoice rules', () => {
	it('sends a discount to approval only above the threshold', () => {
		expect(discountNeedsApproval(1000, 100, 10)).toBe(false); // exactly 10%
		expect(discountNeedsApproval(1000, 101, 10)).toBe(true);
		expect(discountNeedsApproval(1000, 1, 0)).toBe(true); // 0 sends every discount
		expect(discountNeedsApproval(1000, 0, 0)).toBe(false);
		expect(discountNeedsApproval(1000, 1000, 100)).toBe(false);
	});

	it('follows what has been paid, to the cent', () => {
		expect(statusAfterPayment(6500, 0)).toBe('issued');
		expect(statusAfterPayment(6500, 2000)).toBe('partly');
		expect(statusAfterPayment(6500, 6500)).toBe('paid');
		expect(statusAfterPayment(100.1, 100.1)).toBe('paid');
	});

	it('takes no payment while a discount or a void waits for a manager', () => {
		expect(canPay('issued', 'approved')).toBe(true);
		expect(canPay('issued', 'pending')).toBe(false);
		expect(canPay('draft', 'approved')).toBe(false);
		expect(canPay('paid', 'approved')).toBe(false);
	});

	it('voids only an unpaid issued bill, one request at a time', () => {
		expect(canRequestVoid('issued', 'approved', 0)).toBe(true);
		expect(canRequestVoid('issued', 'approved', 50)).toBe(false);
		expect(canRequestVoid('issued', 'pending', 0)).toBe(false);
		expect(canRequestVoid('draft', 'approved', 0)).toBe(false);
	});
});
