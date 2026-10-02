import { contentCrud } from '$lib/server/crud';
import { branch, steriliser } from '$lib/server/db/schema/';
import { lookupDeleteAction } from '$lib/server/lookupDelete';
import { branches } from '$lib/server/fastData';
import { add, edit } from './schema';

/** Sterilisers, as a lookup screen with one reference: the branch each stands in. */
const crud = contentCrud({
	table: steriliser,
	label: 'Steriliser',
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
	/** Soft delete, super admin only. Its cycles keep pointing at it: a log is not rewritten. */
	delete: lookupDeleteAction(steriliser, 'steriliser')
};
