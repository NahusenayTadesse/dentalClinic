import { formatEthiopianYear } from '$lib/global.svelte';
import { ACCEPTED_FILE_TYPES, MAX_FILE_SIZE } from '$lib/zodschemas/appointmentSchema';

import { z } from 'zod/v4';

export const editContract = z.object({
	id: z.number('Payment not found'), // 1
	transactionId: z.number('Reciept Id not found'), // 2
	paymentMethod: z.number('Payment Method is required'), // 3

	paymentRequestFile: z
		.instanceof(File, {
			message: 'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		})
		.refine((file) => file.size > 0, 'File cannot be empty.')
		.refine((file) => file.size <= MAX_FILE_SIZE, `Max file size is 10MB.`)
		.refine(
			(file) => ACCEPTED_FILE_TYPES.includes(file.type),
			'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		)
		.optional(), // 4

	penaltyAmount: z.number('Penalty amount is required').default(0), // 5

	fsNumber: z.string('FS number is required').min(1, 'FS number cannot be empty'), // 6

	invoiceNumber: z.string('Invoice number is required').min(1, 'Invoice number cannot be empty'), // 7

	requestAmount: z.number('Request amount is required'), // 8

	paymentAmount: z.number('Payment amount is required'), // 9

	beforeVat: z.number('Amount before VAT is required'), // 10

	vat: z.number('VAT amount is required').default(15), // 11

	withholdAmount: z.number('Withhold amount is required'), // 12

	withholdFile: z
		.instanceof(File, {
			message: 'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		})
		.refine((file) => file.size > 0, 'File cannot be empty.')
		.refine((file) => file.size <= MAX_FILE_SIZE, `Max file size is 10MB.`)
		.refine(
			(file) => ACCEPTED_FILE_TYPES.includes(file.type),
			'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		)
		.optional(), // 13

	withholdInvoiceNumber: z.string('Withhold invoice number is required').optional(), // 14
	receiptFile: z
		.instanceof(File, {
			message: 'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		})
		.refine((file) => file.size > 0, 'File cannot be empty.')
		.refine((file) => file.size <= MAX_FILE_SIZE, `Max file size is 10MB.`)
		.refine(
			(file) => ACCEPTED_FILE_TYPES.includes(file.type),
			'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		)
		.optional(), // 15

	month: z.string('Month is required'), // 16
	date: z.string('Payment Date is required'), // 17
	status: z.enum(['approved', 'pending', 'rejected'])
});

export type EditContract = z.infer<typeof editContract>;

export const approveContract = z.object({
	ids: z.array(z.number('No Contract Selected')),
	status: z.enum(['approved', 'rejected'])
});

export type ApproveContract = z.infer<typeof approveContract>;
