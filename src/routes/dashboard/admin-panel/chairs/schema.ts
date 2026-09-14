import { z } from 'zod/v4';

const fields = {
	name: z.string('Name is required').min(1).max(50),
	/** Required here even though the column defaults: a chair filed under the wrong branch is booked there. */
	branchId: z.coerce.string('Choose the branch the chair is at').min(1, 'Choose the branch'),
	sortOrder: z.coerce.number().int().min(0).default(0),
	status: z.boolean('Status is required')
};

export const add = z.object(fields);

export const edit = z.object({ id: z.coerce.string(), ...fields });
