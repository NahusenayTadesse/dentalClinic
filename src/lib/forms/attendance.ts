import { z } from 'zod/v4';

/*
 * The attendance register's forms. One schema for every act on one person's day — in, out, both
 * times, excused, cleared — because the register posts them from one row; which fields an act
 * needs is the server's to check (`server/attendance.ts`). Times are clinic `HH:MM`; left out on
 * "in" or "out", the server stamps the clinic's clock, so the desk taps once.
 */

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose the day');
const clock = z
	.string()
	.regex(/^(([01]\d|2[0-3]):[0-5]\d)?$/, 'Enter a time')
	.optional();

export const registerAct = z.object({
	staffId: z.coerce.number().int().positive(),
	day: isoDay,
	act: z.enum(['in', 'out', 'times', 'excuse', 'clear']),
	clockIn: clock,
	clockOut: clock,
	note: z.string().trim().max(255).optional()
});

/** Everyone scheduled and not yet recorded, in at their start. */
export const markAllIn = z.object({ day: isoDay });

export type RegisterActForm = z.infer<typeof registerAct>;
