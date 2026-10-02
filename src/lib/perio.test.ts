import { describe, expect, it } from 'vitest';
import {
	PERIO_TEETH,
	attachmentChanges,
	changeCounts,
	emptyTooth,
	hasFurcation,
	perioProblem,
	perioSummary,
	sitesOnScreen,
	type ToothReading
} from './perio';

/** A tooth with every site at one depth. */
function toothAt(tooth: number, depth: number, extra: Partial<ToothReading> = {}): ToothReading {
	const t = emptyTooth(tooth);
	for (const site of Object.values(t.sites)) site.depth = depth;
	return { ...t, ...extra };
}

describe('the chart layout', () => {
	it('has the 32 adult teeth once each', () => {
		expect(PERIO_TEETH).toHaveLength(32);
		expect(new Set(PERIO_TEETH).size).toBe(32);
	});

	it('draws the distal site nearest the edge of the chart on both halves', () => {
		expect(sitesOnScreen(16, 'buccal')).toEqual(['DB', 'B', 'MB']);
		expect(sitesOnScreen(26, 'buccal')).toEqual(['MB', 'B', 'DB']);
		expect(sitesOnScreen(46, 'lingual')).toEqual(['DL', 'L', 'ML']);
		expect(sitesOnScreen(36, 'lingual')).toEqual(['ML', 'L', 'DL']);
	});

	it('grades furcation on molars and upper first premolars only', () => {
		expect(hasFurcation(16)).toBe(true);
		expect(hasFurcation(24)).toBe(true);
		expect(hasFurcation(34)).toBe(false);
		expect(hasFurcation(11)).toBe(false);
	});
});

describe('perioSummary', () => {
	it('counts the deep pockets and ignores missing teeth', () => {
		const teeth = [toothAt(16, 5), toothAt(11, 2), toothAt(26, 7, { missing: true })];
		teeth[0].sites.DB.bleeding = true;
		teeth[0].sites.DB.depth = 6;
		const summary = perioSummary(teeth);
		expect(summary.teethPresent).toBe(2);
		expect(summary.sitesMeasured).toBe(12);
		expect(summary.deep).toBe(6);
		expect(summary.veryDeep).toBe(1);
		expect(summary.bleedingPercent).toBe(8);
		expect(summary.worstAttachment).toBe(6);
	});

	it('says nothing rather than zero when nothing is measured', () => {
		const summary = perioSummary([emptyTooth(11)]);
		expect(summary.meanDepth).toBeNull();
		expect(summary.worstAttachment).toBeNull();
	});
});

describe('attachmentChanges', () => {
	it('counts recession, so a shallower pocket over a receding gum is still worse', () => {
		const before = [toothAt(16, 4)];
		const after = [toothAt(16, 3)];
		after[0].sites.B.recession = 3;
		const changes = attachmentChanges(before, after);
		expect(changes.get('16B')).toBe(2);
		expect(changes.get('16DB')).toBe(-1);
		expect(changeCounts(changes)).toEqual({ worse: 1, better: 0 });
	});

	it('does not compare a tooth lost in between', () => {
		const changes = attachmentChanges([toothAt(16, 4)], [toothAt(16, 9, { missing: true })]);
		expect(changes.size).toBe(0);
	});
});

describe('perioProblem', () => {
	it('accepts a full chart', () => {
		expect(perioProblem(PERIO_TEETH.map((t) => toothAt(t, 3)))).toBeNull();
	});

	it('refuses a child’s tooth, a repeat, a furcation on one root and an impossible pocket', () => {
		expect(perioProblem([emptyTooth(55)])).toMatch(/not an adult tooth/);
		expect(perioProblem([emptyTooth(11), emptyTooth(11)])).toMatch(/twice/);
		expect(perioProblem([{ ...emptyTooth(11), furcation: 1 }])).toMatch(/one root/);
		expect(perioProblem([toothAt(11, 16)])).toMatch(/0 to 15/);
	});
});
