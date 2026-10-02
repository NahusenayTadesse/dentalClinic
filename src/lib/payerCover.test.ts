import { describe, expect, it } from 'vitest';
import { coverSplit } from './payerCover';

const none = { limitLeft: null, authorisedLeft: null };

describe('coverSplit', () => {
	it('leaves an employer paying in full with the whole bill', () => {
		expect(coverSplit({ total: 1500, coveragePercent: 100, ...none })).toEqual({
			payer: 1500,
			patient: 0,
			cappedBy: null
		});
	});

	it('leaves the co-payment to the patient', () => {
		expect(coverSplit({ total: 1500, coveragePercent: 80, ...none })).toEqual({
			payer: 1200,
			patient: 300,
			cappedBy: null
		});
	});

	it('gives the patient what runs past the yearly limit, and all of it once the limit is spent', () => {
		expect(
			coverSplit({ total: 1500, coveragePercent: 80, limitLeft: 1000, authorisedLeft: null })
		).toEqual({ payer: 1000, patient: 500, cappedBy: 'limit' });
		expect(
			coverSplit({ total: 1500, coveragePercent: 100, limitLeft: -20, authorisedLeft: null })
		).toEqual({ payer: 0, patient: 1500, cappedBy: 'limit' });
	});

	it('pays no more than the pre-authorisation has left', () => {
		expect(
			coverSplit({ total: 2000, coveragePercent: 100, limitLeft: 5000, authorisedLeft: 1200 })
		).toEqual({ payer: 1200, patient: 800, cappedBy: 'authorisation' });
	});
});
