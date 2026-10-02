import { z } from 'zod/v4';

const fields = {
	genericName: z.string('Generic name is required').min(2).max(120),
	brandName: z.string().max(120).optional(),
	strength: z.string().max(50).optional(),
	/** Mirrors the `form` enum on `medicine`. Both change together or not at all. */
	form: z.enum(
		['tablet', 'capsule', 'syrup', 'suspension', 'injection', 'mouthwash', 'gel', 'cream', 'other'],
		'Form is required'
	),
	/** The allergy family, or `''` for none — see `medicine.allergenId`. */
	allergenId: z.coerce.string().optional(),
	isPrescribable: z.boolean().default(true),
	isAntibiotic: z.boolean().default(false),
	bleedingRisk: z.boolean().default(false),
	osteonecrosisRisk: z.boolean().default(false),
	immunosuppression: z.boolean().default(false),
	/** `''` for not controlled — see `medicine.controlClass`. */
	controlClass: z.string().optional(),
	isOnEml: z.boolean().default(true),
	notes: z.string().max(255).optional(),
	sortOrder: z.coerce.number().int().min(0).default(0),
	status: z.boolean('Status is required').default(true)
};

export const add = z.object(fields);

export const edit = z.object({ id: z.coerce.string(), ...fields });
