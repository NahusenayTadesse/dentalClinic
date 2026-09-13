import { describe, expect, it } from 'vitest';
import { birthDateFrom, phoneDigits, searchWords } from './patients';

describe('searchWords', () => {
	it('splits names into words, in whatever order they were typed', () => {
		expect(searchWords('  kebede   abebe ')).toEqual(['kebede', 'abebe']);
	});

	it('keeps a phone number typed in groups as one word', () => {
		expect(searchWords('0911 23 45 67')).toEqual(['0911234567']);
		expect(searchWords('+251 911-234 567')).toEqual(['+251911234567']);
	});

	it('does not glue a name onto a number beside it', () => {
		expect(searchWords('abebe 0911 23')).toEqual(['abebe', '091123']);
	});
});

describe('phoneDigits', () => {
	it('reduces every spelling of one number to the part they share', () => {
		expect(phoneDigits('0911 23 45 67')).toBe('911234567');
		expect(phoneDigits('+251911234567')).toBe('911234567');
		expect(phoneDigits('911234567')).toBe('911234567');
	});
});

describe('birthDateFrom', () => {
	it('stores a known date as given', () => {
		expect(birthDateFrom({ knowsBirthDate: true, birthDate: '1990-05-17' })).toEqual({
			birthDate: '1990-05-17',
			birthDateEstimated: false
		});
	});

	it('turns an approximate age into 1 January of that year, flagged', () => {
		const year = new Date().getFullYear();
		expect(birthDateFrom({ knowsBirthDate: false, ageYears: 40 })).toEqual({
			birthDate: `${year - 40}-01-01`,
			birthDateEstimated: true
		});
	});

	it('records nothing when nobody asked', () => {
		expect(birthDateFrom({ knowsBirthDate: false })).toEqual({
			birthDate: null,
			birthDateEstimated: false
		});
	});
});
