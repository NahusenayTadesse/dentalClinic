import { contentCrud } from '$lib/server/crud';
import { pensionRate } from '$lib/server/db/schema/';
import { add, edit } from './schema';

/**
 * The pension rates: two rows, edited in place.
 *
 * No `add` or `delete` action on purpose. Payroll finds each rate by `party`, which is unique, so a
 * third row cannot exist and a deleted one would leave that share at zero on every payslip. The rows
 * are created by `/setup` (`seedPensionRates`).
 */
const crud = contentCrud({
	table: pensionRate,
	label: 'Pension rate',
	addSchema: add,
	editSchema: edit
});

/*
 * Deliberately unannotated. Adding `: PageServerLoad` widens the return to the generic
 * signature, and `PageData` then loses `addForm`/`editForm`/`rows`.
 */
export const load = crud.load;

export const actions = { edit: crud.actions.edit };
