import { z } from 'zod/v4';
import { ACCEPTED_FILE_TYPES, MAX_FILE_SIZE } from '$lib/zodschemas/appointmentSchema';

/**
 * Paying a month's payroll. The form says **who** — the ticked employees — and how it was paid:
 * the account, the day and the bank receipt. It carries no amount: the action recomputes every
 * payslip inside the transaction that pays it (`server/payrollRun.ts`). It used to post each
 * employee's whole payslip back, and write what it was given.
 */
export const payrollSchema = z.object({
	/** The run's month, `<month>_<year>`. Checked against the page's own month by the action. */
	month: z.string('Month is required'),
	paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose the payment date'),
	paymentMethod: z.coerce
		.number('Choose the account it was paid from')
		.int()
		.positive('Choose the account it was paid from'),
	staffIds: z.array(z.coerce.number().int().positive()).min(1, 'Tick who is being paid.'),
	reciept: z
		.instanceof(File, {
			message: 'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		})
		.refine((file) => file.size > 0, 'File cannot be empty.')
		.refine((file) => file.size <= MAX_FILE_SIZE, `Max file size is 10MB.`)
		.refine(
			(file) => ACCEPTED_FILE_TYPES.includes(file.type),
			'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		)
});

export type PayrollForm = z.infer<typeof payrollSchema>;
