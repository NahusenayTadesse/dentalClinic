import { contentCrud } from '$lib/server/crud';
import { branch, operatory } from '$lib/server/db/schema/';
import { lookupDeleteAction } from '$lib/server/lookupDelete';
import { branches } from '$lib/server/fastData';
import { add, edit } from './schema';

/** Chairs, as a lookup screen with one reference: the branch each chair is at. */
const crud = contentCrud({
	table: operatory,
	label: 'Chair',
	addSchema: add,
	editSchema: edit,
	references: [
		{ field: 'branchId', table: branch, as: 'branch', options: branches, optionsKey: 'branchList' }
	]
});

/*
 * Deliberately unannotated. Adding `: PageServerLoad` widens the return to the generic
 * signature, and `PageData` then loses `addForm`/`editForm`/`rows`.
 */
export const load = crud.load;

export const actions = {
	add: crud.actions.add,
	edit: crud.actions.edit,
	/**
	 * Soft delete, super admin only. `appointment.operatory_id` is `set null`, and a soft-deleted
	 * chair keeps its row, so past appointments still say where they happened.
	 */
	delete: lookupDeleteAction(operatory, 'chair')
};
