import { z } from 'zod/v4';
import { ACCEPTED_FILE_TYPES, MAX_FILE_SIZE } from '$lib/zodschemas/appointmentSchema';

export const addLeave = z.object({
	leaveType: z.coerce.number('Leave Type is Required'),
	requestDate: z.string('Request Date is Required'),
	startDate: z.string('Start Date is Required'),
	endDate: z.string('End Date is Required'),
	// Each boundary day can be taken as a half. On a single-day leave the two refer to the same
	// day, so computeLeaveDays only ever docks it once.
	halfDayStart: z.boolean().default(false),
	halfDayEnd: z.boolean().default(false),
	reason: z.string('Reason is Required').max(255).optional(),
	leavesLetter: z
		.instanceof(File, {
			message: 'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		})
		.refine((file) => file.size > 0, 'File cannot be empty.')
		.refine((file) => file.size <= MAX_FILE_SIZE, `Max file size is 10MB.`)
		.refine(
			(file) => ACCEPTED_FILE_TYPES.includes(file.type),
			'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		)
		.optional()
});
