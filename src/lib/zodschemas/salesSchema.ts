// salesSchema.ts
import { z } from 'zod/v4';
import { ACCEPTED_FILE_TYPES, MAX_FILE_SIZE } from './appointmentSchema';

const toNum = (v: unknown) => (v === '' || v == null ? 0 : Number(v));

const money = z
	.string()
	.or(z.number())
	.transform(toNum)
	.refine((n) => !Number.isNaN(n), 'Must be a valid number');

const productLineSchema = z.object({
	staff: z.number('Staff is required').int().positive('Staff is required'),
	product: z.number({ message: 'Product is required' }).int().positive('Product is required'),
	noofproducts: z.number().int().positive('Number of products must be at least 1'),
	tip: money
});

const serviceLineSchema = z.object({
	staff: z.number('Staff is required').int().positive('Staff is required'),
	service: z.number({ message: 'Service is required' }).int().positive('Service is required'),
	serviceTip: money
});

export const salesSchema = z
	.object({
		products: z.array(productLineSchema),
		services: z.array(serviceLineSchema),
		paymentMethod: z
			.number('Payment Method is required')
			.int()
			.positive('Payment Method is required'),
		productAmount: z.number().nonnegative('Product Amount cannot be less than zero'),
		serviceAmount: z.number().nonnegative('Service Amount cannot be less than zero'),
		total: z.number().nonnegative('Total cannot be less than zero'),
		receipt: z
			.instanceof(File, {
				message: 'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
			})
			.refine((file) => file.size > 0, 'File cannot be empty.')
			.refine((file) => file.size <= MAX_FILE_SIZE, `Max file size is 10MB.`)
			.refine(
				(file) => ACCEPTED_FILE_TYPES.includes(file.type),
				'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
			)
	})
	.refine(
		(data) => data.products.length > 0 || data.services.length > 0,
		'At least one product or service must be added'
	);

export type SalesForm = z.infer<typeof salesSchema>;
