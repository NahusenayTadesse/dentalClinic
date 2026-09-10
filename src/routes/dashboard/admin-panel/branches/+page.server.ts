import { contentCrud } from '$lib/server/crud';
import { branch } from '$lib/server/db/schema/';
import { lookupDeleteAction } from '$lib/server/lookupDelete';
import { add, edit } from './schema';

/**
 * Clinic locations, as a plain lookup screen.
 *
 * Most clinics run one branch and never open this page — `/setup` creates the main one, and
 * `branchRef()` defaults every other table to it. It exists so opening a second location is an
 * insert rather than a migration.
 */
const crud = contentCrud({
	table: branch,
	label: 'Branch',
	addSchema: add,
	editSchema: edit,
	uniqueField: 'name'
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
	 * Soft delete, super admin only. Safe even for the main branch: every `branch_id` is
	 * `on delete set null`, so history survives a location closing. See `branchRef`.
	 */
	delete: lookupDeleteAction(branch, 'branch')
};
