import { formatEthiopianYear } from '$lib/global.svelte';
import { ACCEPTED_FILE_TYPES, MAX_FILE_SIZE } from '$lib/zodschemas/appointmentSchema';

import { z } from 'zod/v4';

const addFileSchema = z
	.instanceof(File, {
		message: 'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
	})
	.refine((file) => file.size > 0, 'File cannot be empty.')
	.refine((file) => file.size <= MAX_FILE_SIZE, `Max file size is 10MB.`)
	.refine(
		(file) => ACCEPTED_FILE_TYPES.includes(file.type),
		'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
	);

export const add = z
	.object({
		contract: z.number('Contract is required'),
		paymentMethod: z.number('Payment Method is required'),

		paymentRequestFile: addFileSchema,

		penaltyAmount: z.number('Penalty amount is required').default(0),

		fsNumber: z.string('FS number is required').min(1, 'FS number cannot be empty'),

		invoiceNumber: z
			.string('Invoice number is required')
			.min(1, 'Invoice number cannot be empty'),

		requestAmount: z.number('Request amount is required'),
		requestChangeReason: z.string().optional(),

		paymentAmount: z.number('Payment amount is required'),

		beforeVat: z.number('Amount before VAT is required'),

		vat: z.number('VAT amount is required'),

		withholdAmount: z.number('Withhold amount is required'),

		withholdFile: addFileSchema.optional(),

		withholdInvoiceNumber: z.string('Withhold invoice number is required').optional(),
		receiptFile: addFileSchema,

		month: z.string('Month is required'),
		date: z.string('Payment Date is required')
	})
	.superRefine((data, ctx) => {
		if (data.withholdAmount > 0 && !data.withholdFile) {
			ctx.addIssue({
				code: 'custom',
				path: ['withholdFile'],
				message: 'Withhold document is required when withholding is applied.'
			});
		}
	});

export type AddPayment = z.infer<typeof add>;

export const edit = z.object({
	id: z.number('Id Not found'),
	paymentRequestFile: z
		.instanceof(File, {
			message: 'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		})
		.refine((file) => file.size > 0, 'File cannot be empty.')
		.refine((file) => file.size <= MAX_FILE_SIZE, `Max file size is 10MB.`)
		.refine(
			(file) => ACCEPTED_FILE_TYPES.includes(file.type),
			'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		),

	penaltyAmount: z.number('Penalty amount is required').default(0),

	fsNumber: z.string('FS number is required').min(1, 'FS number cannot be empty'),

	invoiceNumber: z.string('Invoice number is required').min(1, 'Invoice number cannot be empty'),

	requestAmount: z.number('Request amount is required'),

	paymentAmount: z.number('Payment amount is required'),

	beforeVat: z.number('Amount before VAT is required'),

	vat: z.number('VAT amount is required'),

	withholdAmount: z.number('Withhold amount is required'),

	withholdFile: z
		.instanceof(File, {
			message: 'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		})
		.refine((file) => file.size > 0, 'File cannot be empty.')
		.refine((file) => file.size <= MAX_FILE_SIZE, `Max file size is 10MB.`)
		.refine(
			(file) => ACCEPTED_FILE_TYPES.includes(file.type),
			'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		),

	withholdInvoiceNumber: z.string('Withhold invoice number is required'),
	paymentMethod: z.number('Payment Method is required'),
	receiptFile: z
		.instanceof(File, {
			message: 'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		})
		.refine((file) => file.size > 0, 'File cannot be empty.')
		.refine((file) => file.size <= MAX_FILE_SIZE, `Max file size is 10MB.`)
		.refine(
			(file) => ACCEPTED_FILE_TYPES.includes(file.type),
			'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		),

	month: z.enum(
		['መስከረም', 'ጥቅምት', 'ህዳር', 'ታህሳስ', 'ጥር', 'የካቲት', 'መጋቢት', 'ሚያዝያ', 'ግንቦት', 'ሰኔ', 'ሐምሌ', 'ነሐሴ'],

		'Please select a valid Ethiopian month'
	),

	year: z.number('Year is required').int(),

	date: z.string('Payment Date is required')
});

export type EditPayment = z.infer<typeof edit>;
