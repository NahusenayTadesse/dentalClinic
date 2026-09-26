import { z } from 'zod/v4';
import { SERVICE_AREAS } from '$lib/serviceAreas';

const fields = {
	name: z.string('Name is required').min(2).max(120),
	categoryId: z.coerce.number('Category is required'),
	description: z.string().max(255).optional(),
	/**
	 * Empty means no standard fee, which is a real answer for work quoted case by case — so an
	 * empty box is `null`, never coerced to 0.
	 */
	price: z.preprocess(
		(v) => (v === '' || v === null || v === undefined ? null : v),
		z.coerce.number().min(0, 'A price cannot be negative').nullable()
	),
	area: z.enum(SERVICE_AREAS, 'Choose where this service is charted'),
	removesTooth: z.boolean().default(false),
	status: z.boolean('Status is required').default(true)
};

export const add = z.object(fields);

export const edit = z.object({ id: z.coerce.string(), ...fields });
export type Edit = z.infer<typeof edit>;
