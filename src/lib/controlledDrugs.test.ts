import { describe, expect, it } from 'vitest';
import { controlledRefusal, monthReturn, returnColumn, withBalance } from './controlledDrugs';

describe('the register', () => {
	it('carries the balance down from the opening', () => {
		const lines = withBalance(20, [{ quantity: 100 }, { quantity: -10 }, { quantity: -2.5 }]);
		expect(lines.map((l) => l.balance)).toEqual([120, 110, 107.5]);
	});

	it('files issues and use together, and damage with expiry', () => {
		expect(returnColumn('consumed')).toBe('issued');
		expect(returnColumn('expired')).toBe('writtenOff');
		expect(returnColumn('transferred')).toBe('adjusted');
	});

	it('adds a month up the way the return asks, the closing being the register’s last balance', () => {
		const rows = [
			{ movement: 'received' as const, quantity: 100 },
			{ movement: 'dispensed' as const, quantity: -12 },
			{ movement: 'expired' as const, quantity: -5 },
			{ movement: 'correction' as const, quantity: -1 }
		];
		const sheet = monthReturn(30, rows);
		expect(sheet).toEqual({
			opening: 30,
			received: 100,
			issued: 12,
			writtenOff: 5,
			adjusted: -1,
			closing: 112
		});
		expect(withBalance(30, rows).at(-1)?.balance).toBe(sheet.closing);
	});
});

describe('controlledRefusal', () => {
	const base = { batchNumber: null, supplierId: null, patientId: null, reason: null };

	it('receives only with a batch and a supplier', () => {
		expect(controlledRefusal({ ...base, intent: 'add' })?.field).toBe('batchNumber');
		expect(controlledRefusal({ ...base, intent: 'add', batchNumber: 'B12' })?.field).toBe(
			'supplierId'
		);
		expect(
			controlledRefusal({ ...base, intent: 'add', batchNumber: 'B12', supplierId: 3 })
		).toBeNull();
	});

	it('issues only to a patient, or with the reason written', () => {
		expect(controlledRefusal({ ...base, intent: 'remove' })?.field).toBe('patientId');
		expect(controlledRefusal({ ...base, intent: 'remove', patientId: 9 })).toBeNull();
		expect(
			controlledRefusal({ ...base, intent: 'remove', reason: 'Count on 30 Meskerem' })
		).toBeNull();
	});
});
