import { z } from 'zod/v4';

const fields = {
	name: z.string('Name is required').min(1).max(100),
	kind: z.enum(['autoclaveB', 'autoclaveN', 'autoclaveS', 'dryHeat'], 'Choose the kind'),
	serialNo: z.string().max(60).optional(),
	/** Required: a steriliser's cycles are its branch's log (`BRANCH_SCOPED`). */
	branchId: z.coerce.string('Choose the branch it is at').min(1, 'Choose the branch'),
	status: z.boolean('Status is required').default(true)
};

export const add = z.object(fields);

export const edit = z.object({ id: z.coerce.string(), ...fields });
