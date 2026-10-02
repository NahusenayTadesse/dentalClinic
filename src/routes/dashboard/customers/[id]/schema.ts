import { z } from 'zod/v4';

export const editDetail = z.object({
	name: z
		.string('Name is Required')
		.min(2, 'Name must be at least 2 characters')
		.max(100, 'Name must be at most 100 characters'),
	email: z.union([z.email('Enter a valid email.'), z.literal('')]).optional(),
	phone: z
		.string('Phone Number is Required')
		.min(2, 'Phone must be at least 2 characters')
		.max(100, 'Phone must be at most 100 characters'),
	status: z.boolean('Status is required').default(true),
	tinNo: z.coerce
		.string('Tin Number is Required')
		.min(10, 'Tin Number must be exactly 10 numbers')
		.max(10, 'Tin Number must be exactly 10 numbers')
});
export type EditDetail = z.infer<typeof editDetail>;

/** The payer's address. Which address is decided on the server, from the payer — never posted. */
export const editAddress = z.object({
	subcity: z.coerce.number('Subcity is required').int().positive('Subcity is required'),
	street: z.string('Street is required'),
	kebele: z.string('Kebele is required'),
	buildingNumber: z.string().optional(),
	floor: z.string().optional(),
	houseNumber: z.string('House Number is Required'),
	status: z.boolean('Status is required').default(true)
});
export type EditAddress = z.infer<typeof editAddress>;

/** How the payer is reached. `isActive` is the column's own name, which `childCrud` writes as is. */
const contact = {
	contactType: z.enum(
		['phone', 'email', 'telegram', 'whatsapp', 'instagram'],
		'Choose a contact type'
	),
	contactDetail: z
		.string('Contact detail is required')
		.trim()
		.min(1, 'Contact detail is required')
		.max(255),
	isActive: z.boolean('Status is required').default(true)
};

export const addContact = z.object(contact);
export const editContact = z.object({ id: z.coerce.number('Contact not found'), ...contact });
