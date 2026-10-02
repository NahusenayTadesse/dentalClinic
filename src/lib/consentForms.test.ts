import { describe, expect, it } from 'vitest';
import { CONSENT_TYPES, DEFAULT_CONSENT_TEMPLATES, fillConsent } from './consentForms';
import { MESSAGES } from './i18n/messages';

describe('fillConsent', () => {
	it('fills what it knows and leaves a line to write on for what was not chosen', () => {
		const text = fillConsent('I, {patient}, agree to {treatment} by {clinician} at {clinic}.', {
			patient: 'Abebe Kebede',
			clinic: 'Bole Clinic',
			treatment: 'Extraction 38'
		});
		expect(text).toBe(
			'I, Abebe Kebede, agree to Extraction 38 by ________________ at Bole Clinic.'
		);
	});

	it('keeps the paragraphs and leaves an unknown placeholder visible', () => {
		expect(fillConsent('One {pateint}.\n\nTwo.', {})).toBe('One {pateint}.\n\nTwo.');
	});
});

describe('the default consent wording', () => {
	it('has one form per kind of consent, in both languages, using only known placeholders', () => {
		expect(DEFAULT_CONSENT_TEMPLATES.map((t) => t.consentType).sort()).toEqual(
			[...CONSENT_TYPES].sort()
		);
		for (const t of DEFAULT_CONSENT_TEMPLATES) {
			for (const body of [t.bodyEn, t.bodyAm]) {
				expect(fillConsent(body, { patient: 'x', clinic: 'y' })).not.toMatch(/\{\w+\}/);
			}
		}
	});

	it('names every kind on paper in both languages', () => {
		for (const lang of ['en', 'am'] as const) {
			for (const type of CONSENT_TYPES)
				expect(MESSAGES[lang].forms.consent.types[type]).toBeTruthy();
		}
	});
});
