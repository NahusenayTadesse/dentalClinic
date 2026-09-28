import { describe, expect, it } from 'vitest';
import { canComplete, effectiveStatus, isOpen, outcomeOf, planTotals } from './treatmentPlanStatus';

describe('a plan’s answer follows its lines', () => {
	it('has none while any line is unanswered, or when there are no lines', () => {
		expect(outcomeOf([])).toBeNull();
		expect(outcomeOf(['accepted', 'pending'])).toBeNull();
	});

	it('is accepted, partial or declined by how many lines were a yes', () => {
		expect(outcomeOf(['accepted', 'accepted'])).toBe('accepted');
		expect(outcomeOf(['accepted', 'declined'])).toBe('partial');
		expect(outcomeOf(['declined', 'declined'])).toBe('declined');
	});
});

describe('expiry', () => {
	it('expires a presented plan the day after its last valid day, and nothing else', () => {
		expect(effectiveStatus('presented', '2026-09-27', '2026-09-27')).toBe('presented');
		expect(effectiveStatus('presented', '2026-09-26', '2026-09-27')).toBe('expired');
		expect(effectiveStatus('presented', null, '2026-09-27')).toBe('presented');
		// An answered plan does not expire: the patient already said yes.
		expect(effectiveStatus('accepted', '2020-01-01', '2026-09-27')).toBe('accepted');
	});

	it('counts an expired plan as no longer holding its work', () => {
		expect(isOpen('presented')).toBe(true);
		expect(isOpen('expired')).toBe(false);
		expect(isOpen('declined')).toBe(false);
	});
});

describe('completion and totals', () => {
	it('completes only an accepted plan whose accepted work is all done', () => {
		expect(canComplete('partial', 2, 2)).toBe(true);
		expect(canComplete('partial', 1, 2)).toBe(false);
		expect(canComplete('declined', 0, 0)).toBe(false);
		expect(canComplete('accepted', 0, 0)).toBe(false);
	});

	it('derives every total from the lines', () => {
		expect(
			planTotals([
				{ lineTotal: 1200.1, decision: 'accepted' },
				{ lineTotal: 800.2, decision: 'declined' },
				{ lineTotal: 99.7, decision: 'pending' }
			])
		).toEqual({ quoted: 2100, accepted: 1200.1, declined: 800.2 });
	});
});
