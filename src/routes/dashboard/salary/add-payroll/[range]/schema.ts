import { z } from 'zod/v4';
import { ACCEPTED_FILE_TYPES, MAX_FILE_SIZE } from '$lib/zodschemas/appointmentSchema';

export const payrollSchema = z.object({
	month: z.string('Month is required'),
	start: z.string(),
	end: z.string(),
	paymentDate: z.string('Payment Date is required'),
	paymentMethod: z.number('Payment method is required'),
	employees: z.array(
		z.object({
			id: z.union([z.string(), z.number()]),
			name: z.string(),
			basicSalary: z.coerce.number(),
			positionAllowance: z.coerce.number().default(0),
			housingAllowance: z.coerce.number().default(0),
			transportAllowance: z.coerce.number().default(0),
			nonTaxable: z.coerce.number().default(0),
			account: z.string().nullable(),
			paymentMethodId: z.coerce.number().nullable(),
			employmentStatus: z.string().nullable(),
			overtime: z.coerce.number().default(0),
			bonus: z.coerce.number().default(0),
			absent: z.coerce.number().default(0),
			attendancePenality: z.coerce.number().default(0),
			commission: z.coerce.number().default(0),
			deductions: z.coerce.number().default(0),
			gross: z.coerce.number().default(0),
			taxable: z.coerce.number().default(0),
			taxAmount: z.coerce.number().default(0),
			netPay: z.coerce.number().default(0),
			penEm: z.coerce.number().default(0),
			penOrg: z.coerce.number().default(0)
		})
	),

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

export type EmployeeFormType = z.infer<typeof payrollSchema>['employees'][number];
