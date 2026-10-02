import { describe, expect, it } from 'vitest';
import {
	UNMAPPED,
	balances,
	entryLines,
	journalCsv,
	peachtreeCsv,
	type JournalEntry
} from './journal';

const fixed = {
	revenue: '4000',
	vatPayable: '2200',
	inventory: '1300',
	salaries: '6000',
	suspense: '9999'
};

describe('entryLines', () => {
	it('splits a bill payment into revenue and the VAT inside it', () => {
		const lines = entryLines({
			kind: 'billPayment',
			direction: 'in',
			amount: 1150,
			vat: 150,
			money: '1010',
			other: null,
			fixed
		});
		expect(lines).toEqual([
			{ account: '1010', debit: 1150, credit: 0 },
			{ account: '4000', debit: 0, credit: 1000 },
			{ account: '2200', debit: 0, credit: 150 }
		]);
		expect(balances(lines)).toBe(true);
	});

	it('reverses a refund, takes the sign from the kind not the stored amount, and flags an unmapped expense', () => {
		const refund = entryLines({
			kind: 'refund',
			direction: 'out',
			amount: -500,
			vat: 0,
			money: '1010',
			other: null,
			fixed
		});
		expect(refund).toEqual([
			{ account: '4000', debit: 500, credit: 0 },
			{ account: '1010', debit: 0, credit: 500 }
		]);
		const expense = entryLines({
			kind: 'expense',
			direction: 'out',
			amount: 300,
			vat: 0,
			money: '1000',
			other: null,
			fixed
		});
		expect(expense[0].account).toBe(UNMAPPED);
	});

	it('sends what it cannot place to suspense, on the right side', () => {
		const lines = entryLines({
			kind: 'other',
			direction: 'in',
			amount: 80,
			vat: 0,
			money: '1000',
			other: null,
			fixed
		});
		expect(lines).toEqual([
			{ account: '1000', debit: 80, credit: 0 },
			{ account: '9999', debit: 0, credit: 80 }
		]);
	});
});

describe('the files', () => {
	const entries: JournalEntry[] = [
		{
			date: '2026-10-03',
			reference: 'RCT-2019-00012',
			description: 'Payment, Abebe "Abe" Kebede',
			lines: [
				{ account: '1010', debit: 1150, credit: 0 },
				{ account: '4000', debit: 0, credit: 1150 }
			]
		}
	];

	it('writes Peachtree’s general journal: US dates, the line count, signed amounts', () => {
		expect(peachtreeCsv(entries).split('\r\n')).toEqual([
			'Date,Reference,Number of Distributions,G/L Account,Description,Amount',
			'10/03/26,RCT-2019-00012,2,1010,"Payment, Abebe ""Abe"" Kebede",1150.00',
			'10/03/26,RCT-2019-00012,2,4000,"Payment, Abebe ""Abe"" Kebede",-1150.00',
			''
		]);
	});

	it('writes a plain journal with debit and credit columns', () => {
		expect(journalCsv(entries).split('\r\n')[2]).toBe(
			'2026-10-03,RCT-2019-00012,4000,"Payment, Abebe ""Abe"" Kebede",,1150.00'
		);
	});
});
