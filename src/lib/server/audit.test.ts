import { describe, expect, it } from 'vitest';
import { auditChanges } from './audit';

/**
 * The delta is the whole cost argument for the audit log (AUDIT.md), so what counts as a change is
 * worth pinning. Each case below is a save that would otherwise record a change that did not
 * happen, or hide one that did.
 */
describe('auditChanges', () => {
	it('keeps only the fields that moved', () => {
		expect(
			auditChanges(
				{ name: 'Abebe', phone: '0911000000', sex: 'male' },
				{ name: 'Abebe', phone: '0922000000', sex: 'male' }
			)
		).toEqual({ phone: ['0911000000', '0922000000'] });
	});

	it('ignores columns the write did not touch', () => {
		expect(auditChanges({ name: 'Abebe', phone: '0911' }, { name: 'Abebe' })).toEqual({});
	});

	it('treats a posted date string and the stored Date as the same day', () => {
		expect(auditChanges({ birthDate: new Date(1990, 4, 17) }, { birthDate: '1990-05-17' })).toEqual(
			{}
		);
		expect(auditChanges({ birthDate: new Date(1990, 4, 17) }, { birthDate: '1990-05-18' })).toEqual(
			{ birthDate: ['1990-05-17', '1990-05-18'] }
		);
	});

	it('reads a date the driver returned at UTC midnight as that day, whatever the server timezone', () => {
		expect(
			auditChanges({ birthDate: new Date('1992-01-01T00:00:00.000Z') }, { birthDate: '1992-01-01' })
		).toEqual({});
	});

	it('treats empty strings and undefined as null, and numeric strings as their number', () => {
		expect(
			auditChanges({ altPhone: null, customerId: 4 }, { altPhone: '', customerId: '4' })
		).toEqual({});
	});

	it('does not record the bookkeeping every write stamps', () => {
		expect(auditChanges({ updatedBy: 'a' }, { updatedBy: 'b', updatedAt: new Date() })).toEqual({});
	});

	it('records that a secret changed, never to what', () => {
		expect(auditChanges({ passwordHash: 'old' }, { passwordHash: 'new' })).toEqual({
			passwordHash: ['[redacted]', '[redacted]']
		});
	});
});
