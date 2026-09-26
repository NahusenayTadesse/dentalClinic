import { describe, expect, it } from 'vitest';
import {
	CHART_ROWS,
	dentitionForAge,
	isFdiTooth,
	normaliseSurfaces,
	parseToothRange,
	surfacesOf,
	toothStates
} from './teeth';

describe('FDI codes', () => {
	it('accepts the 32 permanent and 20 primary teeth, and nothing else', () => {
		const all = Array.from({ length: 90 }, (_, i) => i + 10).filter(isFdiTooth);
		expect(all).toHaveLength(52);
		expect(isFdiTooth(18)).toBe(true);
		expect(isFdiTooth(19)).toBe(false);
		expect(isFdiTooth(55)).toBe(true);
		// A child has no premolars: 56 is not a tooth.
		expect(isFdiTooth(56)).toBe(false);
		expect(isFdiTooth(10)).toBe(false);
		expect(isFdiTooth(90)).toBe(false);
	});

	it('draws every tooth exactly once', () => {
		const drawn = [
			...CHART_ROWS.permanent.upper.flat(),
			...CHART_ROWS.permanent.lower.flat(),
			...CHART_ROWS.primary.upper.flat(),
			...CHART_ROWS.primary.lower.flat()
		];
		expect(new Set(drawn).size).toBe(52);
		expect(drawn.every(isFdiTooth)).toBe(true);
	});
});

describe('surfaces', () => {
	it('gives a molar an occlusal surface and an incisor an incisal edge', () => {
		expect(surfacesOf(36)).toEqual(['M', 'O', 'D', 'B', 'L']);
		expect(surfacesOf(11)).toEqual(['M', 'I', 'D', 'B', 'L']);
		// Primary canine (53) is anterior; primary first molar (54) is not.
		expect(surfacesOf(53)).toContain('I');
		expect(surfacesOf(54)).toContain('O');
	});

	it('writes surfaces the way a dentist does, whatever order they were ticked in', () => {
		expect(normaliseSurfaces('dom', 36)).toEqual({ surfaces: 'MOD' });
		expect(normaliseSurfaces('D, I, M', 21)).toEqual({ surfaces: 'MID' });
		expect(normaliseSurfaces('OO', 46)).toEqual({ surfaces: 'O' });
	});

	/*
	 * The mistake that actually happens: a molar's "O" carried onto a front tooth. Saved, it would
	 * count as an occlusal restoration in every report.
	 */
	it('refuses a surface the tooth does not have', () => {
		expect(normaliseSurfaces('MO', 11)).toHaveProperty('error');
		expect(normaliseSurfaces('I', 36)).toHaveProperty('error');
		expect(normaliseSurfaces('X', 36)).toHaveProperty('error');
		expect(normaliseSurfaces('', 36)).toHaveProperty('error');
	});
});

describe('tooth spans', () => {
	it('reads lists and dashes into chart order', () => {
		expect(parseToothRange('16, 14 15')).toEqual({ teeth: [16, 15, 14] });
		expect(parseToothRange('14-16')).toEqual({ teeth: [16, 15, 14] });
		expect(parseToothRange('24-26')).toEqual({ teeth: [24, 25, 26] });
		// Across the midline, still in the order the chart reads.
		expect(parseToothRange('21,11,12')).toEqual({ teeth: [12, 11, 21] });
	});

	it('refuses what is not a span of real teeth', () => {
		expect(parseToothRange('14')).toHaveProperty('error');
		expect(parseToothRange('14,19')).toHaveProperty('error');
		expect(parseToothRange('16-24')).toHaveProperty('error');
		expect(parseToothRange('abc')).toHaveProperty('error');
	});
});

describe('the chart a patient starts on', () => {
	it('follows age, and assumes an adult when age is unknown', () => {
		expect(dentitionForAge(4)).toBe('primary');
		expect(dentitionForAge(8)).toBe('mixed');
		expect(dentitionForAge(30)).toBe('permanent');
		expect(dentitionForAge(null)).toBe('permanent');
	});
});

describe('tooth states', () => {
	const row = (over: Partial<Parameters<typeof toothStates>[0][number]>) => ({
		status: 'completed',
		toothId: 36,
		surfaces: null,
		toothRange: null,
		removesTooth: false,
		...over
	});

	it('keeps a finding, planned work and done work apart on one tooth', () => {
		const states = toothStates([
			row({ status: 'existing', surfaces: 'O' }),
			row({ status: 'condition', surfaces: 'MD' }),
			row({ status: 'planned', surfaces: 'DM' })
		]);
		const s = states.get(36);
		expect(s).toMatchObject({ missing: false, condition: true, planned: true, done: true });
		expect(s?.surfaces).toEqual({ condition: 'MD', planned: 'MD', done: 'O' });
	});

	it('marks a tooth missing once an extraction is done, or recorded as already done', () => {
		expect(toothStates([row({ removesTooth: true })]).get(36)?.missing).toBe(true);
		expect(toothStates([row({ status: 'existing', removesTooth: true })]).get(36)?.missing).toBe(
			true
		);
		// Planned is not done: the tooth is still there.
		expect(toothStates([row({ status: 'planned', removesTooth: true })]).get(36)?.missing).toBe(
			false
		);
	});

	it('draws a bridge on every tooth it spans, and ignores cancelled and referred work', () => {
		const states = toothStates([
			row({ toothId: 14, toothRange: '14,15,16' }),
			row({ toothId: 21, status: 'cancelled' }),
			row({ toothId: 22, status: 'referred' })
		]);
		expect([...states.keys()].sort()).toEqual([14, 15, 16]);
	});
});
