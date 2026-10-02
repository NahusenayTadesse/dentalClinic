import { z } from 'zod/v4';
import { CONSENT_TYPES } from '$lib/consentForms';

const fields = {
	name: z.string('Name is required').min(2).max(100),
	consentType: z.enum(CONSENT_TYPES, 'Choose what it is consent to'),
	bodyEn: z.string('Write the English wording').trim().min(20).max(10_000),
	bodyAm: z.string('Write the Amharic wording').trim().min(20).max(10_000),
	status: z.boolean('Status is required').default(true)
};

export const add = z.object(fields);

export const edit = z.object({ id: z.coerce.string(), ...fields });
