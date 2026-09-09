import { z } from 'zod/v4';

export const customerSchema = z.object({
	name: z
		.string('Name is Required')
		.min(2, 'Name must be at least 2 characters')
		.max(100, 'Name must be at most 100 characters'),
	email: z.string().optional(),
	phone: z
		.string('Phone Number is Required')
		.min(2, 'Phone must be at least 2 characters')
		.max(100, 'Phone must be at most 100 characters'),
	tinNo: z
		.string()
		.min(1, 'Tin Number is Required')
		.length(10, 'Tin Number must be exactly 10 digits')
		.regex(/^\d+$/, 'Tin Number must only contain numbers'),
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
