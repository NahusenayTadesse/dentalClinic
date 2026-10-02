import { describe, expect, it } from 'vitest';
import { cycleStatus, packCode, packState, parseLoad, parsePackCodes } from './sterilisation';

describe('cycleStatus', () => {
	it('fails on either indicator, waits on a spore test, and passes otherwise', () => {
		expect(cycleStatus('pass', 'pass')).toBe('passed');
		expect(cycleStatus('pass', 'none')).toBe('passed');
		expect(cycleStatus('pass', 'pending')).toBe('pending');
		expect(cycleStatus('fail', 'pending')).toBe('failed');
		expect(cycleStatus('pass', 'fail')).toBe('failed');
	});
});

describe('packState', () => {
	const pack = { usedAt: null, expiresOn: '2026-10-30' };

	it('lets a pack from a pending cycle be used, but never one from a failed cycle', () => {
		expect(packState(pack, 'pending', '2026-10-03')).toBe('ready');
		expect(packState(pack, 'failed', '2026-10-03')).toBe('withdrawn');
	});

	it('stops an expired pack, and says a used one is used whatever happened since', () => {
		expect(packState(pack, 'passed', '2026-10-31')).toBe('expired');
		expect(packState(pack, 'passed', '2026-10-30')).toBe('ready');
		expect(packState({ ...pack, usedAt: new Date() }, 'failed', '2026-11-30')).toBe('used');
	});
});

describe('pack codes', () => {
	it('are padded so they sort and read the same length', () => {
		expect(packCode(2, 118, 3)).toBe('2-0118-03');
	});

	it('are read from whatever the chair typed, once each', () => {
		expect(parsePackCodes(' 2-0118-03\n2-0118-04, 2-0118-03 ;1-0007-01 ')).toEqual([
			'2-0118-03',
			'2-0118-04',
			'1-0007-01'
		]);
	});
});

describe('parseLoad', () => {
	it('reads one kind a line, the number first, and one pack where there is none', () => {
		expect(parseLoad('6 exam kit\n2 x Extraction set\n\nScaler tips')).toEqual({
			packs: [
				{ contents: 'exam kit', count: 6 },
				{ contents: 'Extraction set', count: 2 },
				{ contents: 'Scaler tips', count: 1 }
			]
		});
	});

	it('refuses an impossible count by its line', () => {
		expect(parseLoad('0 exam kit')).toEqual({
			error: '"0 exam kit": between 1 and 100 packs a line.'
		});
	});
});
