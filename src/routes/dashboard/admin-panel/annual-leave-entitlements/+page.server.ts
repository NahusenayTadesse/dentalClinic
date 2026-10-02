import { contentCrud } from '$lib/server/crud';
import { annualLeaveEntitlement } from '$lib/server/db/schema/';
import { lookupDeleteAction } from '$lib/server/lookupDelete';
import { add, edit } from './schema';

/**
 * The annual-leave brackets, as a lookup screen. It was written out by hand — a page, an edit
 * dialog and two actions that showed the database's error text to the user — and is now
 * `contentCrud`; the bracket's ordering rule stays in its schema, where both paths check it.
 */
const crud = contentCrud({
	table: annualLeaveEntitlement,
	label: 'Entitlement',
	addSchema: add,
	editSchema: edit,
	// No unique column: brackets are told apart by their range, which the schema checks.
	uniqueField: 'fromYears'
});

/*
 * Deliberately unannotated. Adding `: PageServerLoad` widens the return to the generic
 * signature, and `PageData` then loses `addForm`/`editForm`/`rows`.
 */
export const load = crud.load;

export const actions = {
	add: crud.actions.add,
	edit: crud.actions.edit,
	/** Soft delete, super admin only. See `lookupDeleteAction`. */
	delete: lookupDeleteAction(annualLeaveEntitlement, 'entitlement')
};
