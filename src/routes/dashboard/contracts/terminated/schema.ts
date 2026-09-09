import { formatEthiopianYear } from '$lib/global.svelte';
import { ACCEPTED_FILE_TYPES, MAX_FILE_SIZE } from '$lib/zodschemas/appointmentSchema';

import { z } from 'zod/v4';

export const editDetail = z.object({
	name: z
		.string('Name is Required')
		.min(2, 'Name must be at least 2 characters')
		.max(100, 'Name must be at most 100 characters'),
	phone: z
		.string('Phone Number is Required')
		.min(2, 'Phone must be at least 2 characters')
		.max(100, 'Phone must be at most 100 characters'),
	customer: z.number('Customer is required'),
	status: z.boolean('Status is required').default(true),
	officeCommission: z.boolean('Office Commission is required').default(true)
});
export type EditDetail = z.infer<typeof editDetail>;

export const editAddress = z.object({
	id: z.number('Address Id not found'),
	subcity: z.number('Subsity is required'),
	street: z.string('Street is required'),
	kebele: z.string('Kebele is required'),
	buildingNumber: z.string().optional(),
	floor: z.string().optional(),
	houseNumber: z.string('House Number is Required'),
	status: z.boolean('Status is required')
});
export type EditAddress = z.infer<typeof editAddress>;

export const addContact = z.object({
	contactType: z.string('Contact Type is Required'),
	contactDetail: z.string('Contact Detail is required'),
	status: z.boolean('Status is Required').default(true)
});
export type AddContact = z.infer<typeof addContact>;

export const editContact = z.object({
	id: z.number('Schedule not found'),
	contactType: z.string('Contact Type is Required'),
	contactDetail: z.string('Contact Detail is required'),

	status: z.boolean('Status is Required').default(true)
});

export type EditContact = z.infer<typeof editContact>;

export const addContract = z.object({
	contractType: z.string('Contact Type is Required'),
	service: z.number('Service is Required'),
	monthlyAmount: z.number('Contract Amount is Required'),
	contractYear: z
		.number('Contract Year is Required')
		.default(Number(formatEthiopianYear(new Date()))),
	contractDate: z.string('Contract Date is Required'),
	startDate: z.string('Start Date is required'),
	endDate: z.string('End Date is required'),
	status: z.boolean('Status is Required').default(true),
	contractFile: z
		.instanceof(File, {
			message: 'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		})
		.refine((file) => file.size > 0, 'File cannot be empty.')
		.refine((file) => file.size <= MAX_FILE_SIZE, `Max file size is 10MB.`)
		.refine(
			(file) => ACCEPTED_FILE_TYPES.includes(file.type),
			'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		),
	commissionConsidered: z.boolean().default(true),
	signingOfficer: z.number().int().nullable().optional()
});
export type AddContract = z.infer<typeof addContract>;

export const editContract = z.object({
	id: z.number('Schedule not found'),
	contractType: z.string('Contact Type is Required'),
	service: z.number('Service is Required'),
	monthlyAmount: z.number('Contract Amount is Required'),
	contractYear: z.number('Contract Year is Required'),
	contractDate: z.string('Contract Date is Required'),
	startDate: z.string('Start Date is required'),
	endDate: z.string('End Date is required'),
	status: z.boolean('Status is Required').default(true),
	contractFile: z
		.instanceof(File, {
			message: 'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		})
		.refine((file) => file.size > 0, 'File cannot be empty.')
		.refine((file) => file.size <= MAX_FILE_SIZE, `Max file size is 10MB.`)
		.refine(
			(file) => ACCEPTED_FILE_TYPES.includes(file.type),
			'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		)
		.optional(),
	commissionConsidered: z.boolean().default(true),
	signingOfficer: z.number().int().nullable().optional()
});

export type EditContract = z.infer<typeof editContract>;

export const addSites = z.object({
	name: z
		.string('Name is Required')
		.min(2, 'Name must be at least 2 characters')
		.max(100, 'Name must be at most 100 characters'),
	phone: z
		.string('Phone Number is Required')
		.min(2, 'Phone must be at least 2 characters')
		.max(100, 'Phone must be at most 100 characters'),
	status: z.boolean('Status is Required').default(true),
	startDate: z.string('Start Date is required'),
	endDate: z.string('End Date is required'),
	subcity: z.number('Subsity is required'),
	street: z.string('Street is required'),
	kebele: z.string('Kebele is required'),
	buildingNumber: z.string().optional(),
	floor: z.string().optional(),
	houseNumber: z.string('House Number is Required')
});
export type AddSites = z.infer<typeof addSites>;

export const editSites = z.object({
	id: z.number('Schedule not found'),
	name: z
		.string('Name is Required')
		.min(2, 'Name must be at least 2 characters')
		.max(100, 'Name must be at most 100 characters'),
	phone: z
		.string('Phone Number is Required')
		.min(2, 'Phone must be at least 2 characters')
		.max(100, 'Phone must be at most 100 characters'),
	status: z.boolean('Status is Required').default(true),
	startDate: z.string('Start Date is required'),
	endDate: z.string('End Date is required')
});

export type EditSites = z.infer<typeof editSites>;
