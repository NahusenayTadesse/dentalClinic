import { contentCrud } from '$lib/server/crud';
import { branch, clinicClosure } from '$lib/server/db/schema/';
import { lookupDeleteAction } from '$lib/server/lookupDelete';
import { branches } from '$lib/server/fastData';
import { add, edit } from './schema';

/**
 * Clinic closures.
 *
 * The `branch` reference is optional here, unlike every other lookup that carries one: a closure
 * with no branch applies to all of them, which is what a public holiday is.
 */
const crud = contentCrud({
	table: clinicClosure,
	label: 'Closure',
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
	/** Soft delete, super admin only. A clinic that works a public holiday deletes its row. */
	delete: lookupDeleteAction(clinicClosure, 'closure')
};
