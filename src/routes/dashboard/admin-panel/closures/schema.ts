import { z } from 'zod/v4';

const fields = {
	name: z.string('Name is required').min(2).max(100),
	startsOn: z.string('Start date is required'),
	endsOn: z.string('End date is required'),
	/** Empty means every branch — see the table comment on `clinic_closure`. */
	branchId: z.coerce.string().optional(),
	note: z.string().max(255).optional(),
	status: z.boolean('Status is required')
};

export const add = z.object(fields);

export const edit = z.object({ id: z.coerce.string(), ...fields });
