import { z } from 'zod/v4';

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 5MB limit

// Updated list to include common mobile camera/screenshot formats
export const ACCEPTED_FILE_TYPES = [
	'image/jpeg', // Common for both platforms
	'image/png', // Common for both platforms (and screenshots)
	'image/webp', // Common modern format (often Android screenshots/exports)
	'image/heic', // High Efficiency Image File (iOS default)
	'image/heif',
	'image/avif', // High Efficiency Image File (related to HEIC)
	'application/pdf' // Document format, kept from original
];

export const bookingFeeSchema = z.object({
	// 'Booking Fee Amount' - fe snippet with type='number' and required=true
	amount: z
		.number('Booking Fee Amount is required')
		.nonnegative('Amount cannot be negative')
		.min(0, 'Amount must be 0 or greater'),

	// Hidden input for appointment ID
	appointmentId: z.number().optional(),

	// 'paymentMethod' - combo snippet. Assumes the value is a string ID or name.
	paymentMethod: z.number('Payment Method is required'),

	paymentStatus: z.enum(['paid', 'partially_paid'], { message: 'Payment Status is required' }),

	// 'Upload Reciept or Screenshot of Booking Fee' - fe snippet with type='file' and required=true
	image: z
		.instanceof(File, { message: 'A file is required.' })
		.refine((file) => file.size > 0, 'File cannot be empty.')
		.refine((file) => file.size <= MAX_FILE_SIZE, `Max file size is 10MB.`)
		.refine(
			(file) => ACCEPTED_FILE_TYPES.includes(file.type),
			'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		)
});

export type BookingFeeSchema = z.infer<typeof bookingFeeSchema>;

export const staffSchema = z.object({
	firstName: z.string().min(1, 'First name is required').max(100, 'First name is too long'),

	lastName: z.string().min(1, 'Last name is required').max(100, 'Last name is too long'),

	email: z.email('Invalid email address').min(1, 'Email is required'),

	phone: z
		.string()
		.min(7, 'Phone number must be at least 7 digits')
		.max(20, 'Phone number is too long')
		.regex(/^[\d+\-\s()]+$/, 'Invalid phone number format'),

	position: z.number({ message: 'Position is required' }),

	hiredAt: z.string({ message: 'Hired At date is required' }).min(1, 'Hired At date is required'),

	salary: z
		.number({ message: 'Salary is required' })
		.nonnegative({ message: 'Salary must be a non-negative number' }),

	govId: z
		.instanceof(File, { message: 'A file is required.' })
		.refine((file) => file.size > 0, 'File cannot be empty.')
		.refine((file) => file.size <= MAX_FILE_SIZE, `Max file size is 10MB.`)
		.refine(
			(file) => ACCEPTED_FILE_TYPES.includes(file.type),
			'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		),

	contract: z
		.instanceof(File, { message: 'A file is required.' })
		.refine((file) => file.size > 0, 'File cannot be empty.')
		.refine((file) => file.size <= MAX_FILE_SIZE, `Max file size is 10MB.`)
		.refine(
			(file) => ACCEPTED_FILE_TYPES.includes(file.type),
			'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		)
});

export type StaffForm = z.infer<typeof staffSchema>;

export const editStaff = z.object({
	staffId: z.number(),
	firstName: z.string().min(1, 'First name is required').max(100, 'First name is too long'),

	lastName: z.string().min(1, 'Last name is required').max(100, 'Last name is too long'),

	email: z.string().min(1, 'Email is required').email('Invalid email address'),

	phone: z
		.string()
		.min(7, 'Phone number must be at least 7 digits')
		.max(20, 'Phone number is too long')
		.regex(/^[\d+\-\s()]+$/, 'Invalid phone number format'),

	position: z.number({ message: 'Position is required' }),

	hiredAt: z.string({ message: 'Hired At date is required' }).min(1, 'Hired At date is required'),

	govId: z
		.instanceof(File, { message: 'A file is required.' })
		.refine((file) => file.size > 0, 'File cannot be empty.')
		.refine((file) => file.size <= MAX_FILE_SIZE, `Max file size is 10MB.`)
		.refine(
			(file) => ACCEPTED_FILE_TYPES.includes(file.type),
			'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		)
		.optional(),

	contract: z
		.instanceof(File, { message: 'A file is required.' })
		.refine((file) => file.size > 0, 'File cannot be empty.')
		.refine((file) => file.size <= MAX_FILE_SIZE, `Max file size is 10MB.`)
		.refine(
			(file) => ACCEPTED_FILE_TYPES.includes(file.type),
			'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		)
		.optional()
});

export type EditStaff = z.infer<typeof editStaff>;
