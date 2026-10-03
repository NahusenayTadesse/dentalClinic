import { z } from 'zod/v4';
import { PACKAGE_KINDS } from '$lib/packages';

const fields = {
	name: z.string('Name is required').min(2).max(100),
	kind: z.enum(PACKAGE_KINDS, 'Choose how it is sold'),
	price: z.coerce.number('Give the package price').min(0),
	/** `''` for no limit; the server reads it as none. */
	validDays: z.coerce.string().optional(),
	description: z.string().max(255).optional(),
	status: z.boolean().default(true)
};

export const add = z.object(fields);

export const edit = z.object({ id: z.coerce.string(), ...fields });

/** A package's services, posted as JSON: a list of service and count. */
export const packageItems = z.object({
	id: z.number().int().positive(),
	items: z
		.array(
			z.object({
				serviceId: z.number().int().positive('Choose the service'),
				quantity: z.number().int().min(1).max(100)
			})
		)
		.max(50)
});

export type PackageItems = z.infer<typeof packageItems>;
