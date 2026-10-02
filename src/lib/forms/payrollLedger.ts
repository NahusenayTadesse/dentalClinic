import { z } from 'zod/v4';

/*
 * The pay adjustment forms, one for all three kinds (`$lib/payrollLedger.ts`). Which fields a kind
 * needs — hours and a type for overtime, an amount for the others — is the server's to check
 * (`server/payrollLedger.ts`), so one schema serves every dialog. Optional choices stay strings,
 * read as none when empty (CLAUDE.md §13).
 */

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose the date');

/** Recording an adjustment for one or more employees at once. */
export const ledgerEntry = z.object({
	staffIds: z.array(z.coerce.number().int().positive()).min(1, 'Choose at least one employee.'),
	date: isoDay,
	/** Overtime: the type, which carries the rate and the hour limit. */
	typeId: z.coerce.string().optional(),
	/** Deductions: what kind — a penalty, an advance repaid. */
	type: z.string().trim().max(100).optional(),
	hours: z.coerce.number().min(0).max(744).optional(),
	amount: z.coerce.number().min(0, 'An amount cannot be negative.').max(10_000_000).optional(),
	reason: z.string().trim().max(255).optional()
});

/** Changing one recorded adjustment. Its employee does not change; record it again instead. */
export const ledgerEdit = ledgerEntry.omit({ staffIds: true }).extend({
	id: z.coerce.number().int().positive()
});

/** Removing one. */
export const ledgerRemove = z.object({ id: z.coerce.number().int().positive() });

export type LedgerEntry = z.infer<typeof ledgerEntry>;
export type LedgerEdit = z.infer<typeof ledgerEdit>;
