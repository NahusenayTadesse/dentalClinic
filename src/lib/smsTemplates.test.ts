import { describe, expect, it } from 'vitest';
import { DEFAULT_SMS_TEMPLATES, ethiopianMobile, fillTemplate, smsSegments } from './smsTemplates';

describe('fillTemplate', () => {
	it('fills the placeholders it knows, drops empty ones, and leaves a typo visible', () => {
		expect(
			fillTemplate('Hi {name}, {date} at {time}. {nmae}', { name: 'Hana', date: '25 Meskerem' })
		).toBe('Hi Hana, 25 Meskerem at . {nmae}');
	});

	it('fills the default Amharic reminder', () => {
		const text = fillTemplate(DEFAULT_SMS_TEMPLATES.reminder, {
			name: 'ሐና',
			date: '25 መስከረም',
			time: 'ጠዋት 3:00',
			clinic: 'ዋና ቅርንጫፍ',
			phone: '0911000000'
		});
		expect(text).toContain('ሐና');
		expect(text).toContain('ጠዋት 3:00');
		expect(text).not.toMatch(/\{\w+\}/);
	});
});

describe('smsSegments', () => {
	it('counts a Latin message at 160, then 153 a part', () => {
		expect(smsSegments('a'.repeat(160))).toEqual({ segments: 1, encoding: 'gsm7' });
		expect(smsSegments('a'.repeat(161))).toEqual({ segments: 2, encoding: 'gsm7' });
		expect(smsSegments('a'.repeat(306))).toEqual({ segments: 2, encoding: 'gsm7' });
	});

	it('counts any Ethiopic character as UCS-2: 70, then 67 a part', () => {
		expect(smsSegments('ሀ'.repeat(70))).toEqual({ segments: 1, encoding: 'ucs2' });
		expect(smsSegments('ሀ'.repeat(71))).toEqual({ segments: 2, encoding: 'ucs2' });
		// One Amharic word turns a long English message into UCS-2.
		expect(smsSegments(`${'a'.repeat(100)} ሰላም`).encoding).toBe('ucs2');
	});

	it('costs the default reminder two segments, as the cost log will say', () => {
		const text = fillTemplate(DEFAULT_SMS_TEMPLATES.reminder, {
			name: 'ሐና',
			date: '25 መስከረም 2019',
			time: 'ጠዋት 3:00',
			clinic: 'ዋና ቅርንጫፍ',
			phone: '0911000000'
		});
		expect(smsSegments(text).segments).toBe(2);
	});
});

describe('ethiopianMobile', () => {
	it('reads the ways the desk types a mobile number', () => {
		for (const typed of ['0911 23 45 67', '+251 911 234567', '251911234567', '911234567']) {
			expect(ethiopianMobile(typed)).toBe('251911234567');
		}
		expect(ethiopianMobile('0712345678')).toBe('251712345678');
	});

	it('refuses what is not an Ethiopian mobile', () => {
		for (const typed of ['0111234567', '+44 7700 900123', '0911', '', null]) {
			expect(ethiopianMobile(typed)).toBeNull();
		}
	});
});
