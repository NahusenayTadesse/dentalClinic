import { z } from 'zod/v4';

const fields = {
	name: z.string('Name is required').min(2).max(50),
	/**
	 * The top of the band in birr a month. Empty is the top band, with no limit — so an empty box
	 * stays `null`, never 0, which would make it the lowest band instead.
	 */
	threshold: z.preprocess(
		(v) => (v === '' || v === undefined ? null : v),
		z.coerce.number().min(0, 'A limit cannot be negative').nullable()
	),
	/** A percentage: 15 for 15%. */
	rate: z.coerce
		.number('Rate is required')
		.min(0, 'A rate cannot be negative')
		.max(100, 'A rate is a percentage, at most 100'),
	deduction: z.coerce.number('Deduction is required').min(0, 'A deduction cannot be negative'),
	status: z.boolean('Status is required').default(true)
};

export const add = z.object(fields);

export const edit = z.object({ id: z.coerce.number(), ...fields });
export type Edit = z.infer<typeof edit>;
