import { z } from 'zod/v4';

const day = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Choose a date');

const fields = {
	title: z.string('Say what happened in a line').min(3).max(150),
	discoveredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'When it was found'),
	occurredOn: day.optional(),
	severity: z.enum(['low', 'medium', 'high']),
	description: z.string('What happened, and what data it touched').trim().min(10).max(5000),
	peopleAffected: z.coerce.number().int().min(0).optional(),
	actions: z.string().trim().max(5000).optional(),
	reportedOn: day.optional(),
	notifiedOn: day.optional(),
	/** Still open. */
	status: z.boolean().default(true)
};

export const add = z.object(fields);

export const edit = z.object({ id: z.coerce.string(), ...fields });
