import { describe, expect, it } from 'vitest';
import { canMoveLabCase, isOverdue } from './labCaseStatus';

describe('lab case status', () => {
	it('goes out, comes back, and is fitted — or goes back for a remake', () => {
		expect(canMoveLabCase('draft', 'sent')).toBe(true);
		expect(canMoveLabCase('sent', 'received')).toBe(true);
		expect(canMoveLabCase('received', 'remake')).toBe(true);
		expect(canMoveLabCase('remake', 'received')).toBe(true);
		expect(canMoveLabCase('received', 'fitted')).toBe(true);
	});

	it('does not re-open fitted work or cancel work that has come back', () => {
		expect(canMoveLabCase('fitted', 'remake')).toBe(false);
		expect(canMoveLabCase('received', 'cancelled')).toBe(false);
		expect(canMoveLabCase('draft', 'fitted')).toBe(false);
	});

	it('is overdue only while it is out at the lab', () => {
		expect(isOverdue({ status: 'sent', dueOn: '2026-09-01' }, '2026-09-28')).toBe(true);
		expect(isOverdue({ status: 'remake', dueOn: '2026-09-01' }, '2026-09-28')).toBe(true);
		expect(isOverdue({ status: 'received', dueOn: '2026-09-01' }, '2026-09-28')).toBe(false);
		expect(isOverdue({ status: 'sent', dueOn: '2026-09-28' }, '2026-09-28')).toBe(false);
	});
});
