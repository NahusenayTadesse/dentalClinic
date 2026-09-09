import { z } from 'zod/v4';

const ethiopianPhoneRegex = /^(?:\+251|251|0)?([79]\d{8})$/;

export const customerSchema = z.object({
	name: z
		.string('Name is Required')
		.min(2, 'Name must be at least 2 characters')
		.max(100, 'Name must be at most 100 characters'),
	email: z.string().optional(),
	phone: z.coerce
		.string()
		.trim()
		.regex(ethiopianPhoneRegex, 'Invalid Ethiopian phone number')
		// Optional: Transform the input to a standardized format (e.g., +251...)
		.transform((val) => {
			const match = val.match(ethiopianPhoneRegex);
			const mainNumber = match?.[1];
			return `+251${mainNumber}`;
		}),
	tinNo: z
		.string()
		.min(1, 'Tin Number is Required')
		.length(10, 'Tin Number must be exactly 10 digits')
		.regex(/^\d+$/, 'Tin Number must only contain numbers'),
	customer: z.number('Customer is Required').positive('Customer is required'),
	startDate: z.string('Start Date is required'),
	street: z
		.string('Street is Required')
		.min(2, 'Street must be at least 2 characters')
		.max(100, 'Street must be at most 100 characters'),
	subcity: z.coerce.number('Subcity is Required'),
	floor: z.coerce.number().optional(),
	kebele: z.string().optional(),
	buildingNumber: z.string().optional(),
	houseNumber: z.coerce.number().optional()
});
