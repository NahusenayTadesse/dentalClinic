import { formatEthiopianYear } from '$lib/global.svelte';
import { ACCEPTED_FILE_TYPES, MAX_FILE_SIZE } from '$lib/zodschemas/appointmentSchema';

import { z } from 'zod/v4';

export const editContract = z.object({
	id: z.number('Schedule not found'),
	contractType: z.string('Contact Type is Required'),
	service: z.number('Service is Required'),
	monthlyAmount: z.number('Contract Amount is Required'),
	contractYear: z.number('Contract Year is Required'),
	contractDate: z.string('Contract Date is Required'),
	startDate: z.string('Start Date is required'),
	endDate: z.string('End Date is required'),
	status: z.boolean('Status is Required').default(true),
	contractFile: z
		.instanceof(File, {
			message: 'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		})
		.refine((file) => file.size > 0, 'File cannot be empty.')
		.refine((file) => file.size <= MAX_FILE_SIZE, `Max file size is 10MB.`)
		.refine(
			(file) => ACCEPTED_FILE_TYPES.includes(file.type),
			'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		)
		.optional(),
	commissionConsidered: z.boolean().default(true),
	signingOfficer: z.number().int().nullable().optional()
});

export type EditContract = z.infer<typeof editContract>;
