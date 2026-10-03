import { describe, expect, it } from 'vitest';
import {
	IMPORT_KINDS,
	IMPORT_LISTS,
	choiceCell,
	dateCell,
	headingKey,
	lookupKey,
	matchHeadings,
	moneyText,
	phoneCell,
	SEX_CHOICES,
	yesNoCell
} from './dataImport';

describe('matchHeadings', () => {
	const columns = IMPORT_LISTS.patients.columns;

	it('reads the template’s own headings, star and curly apostrophe included', () => {
		const match = matchHeadings(['Given name *', 'Father’s name *', 'Sex *'], columns);
		expect(match.columns.map((c) => c?.key)).toEqual(['name', 'fatherName', 'sex']);
		expect(match.missing).toEqual([]);
	});

	it('reads a clinic’s own spellings of the same columns', () => {
		const match = matchHeadings(
			['FIRST NAME', "Father's Name", 'gender', 'Mobile', 'D.O.B'],
			columns
		);
		expect(match.columns.map((c) => c?.key)).toEqual([
			'name',
			'fatherName',
			'sex',
			'phone',
			'birthDate'
		]);
	});

	it('names the required columns a file lacks and the headings it ignores', () => {
		const match = matchHeadings(['Given name', 'Favourite colour', ''], columns);
		expect(match.missing.map((c) => c.key)).toEqual(['fatherName', 'sex']);
		expect(match.ignored).toEqual(['Favourite colour']);
	});

	it('reads a column given twice only once', () => {
		const match = matchHeadings(['Phone', 'Mobile'], columns);
		expect(match.columns.map((c) => c?.key)).toEqual(['phone', undefined]);
		expect(match.repeated).toEqual(['Mobile']);
	});

	/*
	 * Two columns of one list sharing a spelling would send a cell to whichever was registered last
	 * — a "Status" meant as the employment status filling something else, with no error anywhere.
	 */
	it('gives no two columns of a list the same heading', () => {
		for (const kind of IMPORT_KINDS) {
			const owners = new Map<string, string>();
			for (const column of IMPORT_LISTS[kind].columns) {
				for (const name of new Set(
					[column.label, column.key, ...(column.aliases ?? [])].map(headingKey)
				)) {
					expect(owners.get(name), `${kind}: "${name}"`).toBeUndefined();
					owners.set(name, column.key);
				}
			}
		}
	});
});

describe('dateCell', () => {
	it('reads ISO and day-first dates in the Gregorian calendar', () => {
		expect(dateCell('1990-03-15', 'gregorian')).toEqual({ ok: true, value: '1990-03-15' });
		expect(dateCell('15/03/1990', 'gregorian')).toEqual({ ok: true, value: '1990-03-15' });
		expect(dateCell('5.3.1990', 'gregorian')).toEqual({ ok: true, value: '1990-03-05' });
	});

	it('reads an Excel date as the day it shows', () => {
		expect(dateCell(new Date(Date.UTC(1990, 2, 15)), 'gregorian')).toEqual({
			ok: true,
			value: '1990-03-15'
		});
	});

	it('turns an Ethiopian date into the Gregorian day the database keeps', () => {
		// Meskerem 1, 2016 was 12 September 2023 (see ethiopianCalendar.ts).
		expect(dateCell('01/01/2016', 'ethiopian')).toEqual({ ok: true, value: '2023-09-12' });
		expect(dateCell(new Date(Date.UTC(2016, 0, 1)), 'ethiopian')).toEqual({
			ok: true,
			value: '2023-09-12'
		});
	});

	it('refuses a day the calendar does not have, rather than running it on into the next month', () => {
		expect(dateCell('31/02/1990', 'gregorian').ok).toBe(false);
		expect(dateCell('31/01/2016', 'ethiopian').ok).toBe(false);
		// 2016 E.C. follows no leap year: Pagume has five days.
		expect(dateCell('06/13/2016', 'ethiopian').ok).toBe(false);
		expect(dateCell('05/13/2016', 'ethiopian').ok).toBe(true);
	});

	it('refuses month-first dates and plain numbers, which cannot be read safely', () => {
		expect(dateCell('03/15/1990', 'gregorian').ok).toBe(false);
		expect(dateCell(32947, 'gregorian').ok).toBe(false);
		expect(dateCell('last March', 'gregorian').ok).toBe(false);
	});

	it('leaves an empty cell empty', () => {
		expect(dateCell(null, 'gregorian')).toEqual({ ok: true, value: undefined });
		expect(dateCell('  ', 'ethiopian')).toEqual({ ok: true, value: undefined });
	});
});

describe('phoneCell', () => {
	it('puts back the 0 Excel takes off an Ethiopian number', () => {
		expect(phoneCell(911234567)).toBe('0911234567');
		expect(phoneCell('111234567')).toBe('0111234567');
	});

	it('leaves every other spelling as written', () => {
		expect(phoneCell('0911 23 45 67')).toBe('0911 23 45 67');
		expect(phoneCell('+251911234567')).toBe('+251911234567');
		expect(phoneCell(null)).toBe('');
	});
});

describe('reading other cells', () => {
	it('reads yes and no in the ways people write them', () => {
		expect(yesNoCell('Yes')).toEqual({ ok: true, value: true });
		expect(yesNoCell('inactive')).toEqual({ ok: true, value: false });
		expect(yesNoCell(true)).toEqual({ ok: true, value: true });
		expect(yesNoCell('')).toEqual({ ok: true, value: undefined });
		expect(yesNoCell('maybe').ok).toBe(false);
	});

	it('reads a choice by any of its spellings, and leaves an unknown one for the schema', () => {
		expect(choiceCell('F', SEX_CHOICES)).toBe('female');
		expect(choiceCell('Male', SEX_CHOICES)).toBe('male');
		expect(choiceCell('ሴት', SEX_CHOICES)).toBe('female');
		expect(choiceCell('other', SEX_CHOICES)).toBe('other');
	});

	it('reads money as people type it', () => {
		expect(moneyText('12,500.00 Birr')).toBe('12500.00');
		expect(moneyText(9500)).toBe('9500');
		expect(moneyText('')).toBe('');
	});

	it('matches names regardless of case and spacing', () => {
		expect(lookupKey('  Penicillin  G ')).toBe(lookupKey('penicillin g'));
	});
});
