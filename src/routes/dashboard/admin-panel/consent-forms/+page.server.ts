import { contentCrud } from '$lib/server/crud';
import { consentTemplate } from '$lib/server/db/schema/';
import { lookupDeleteAction } from '$lib/server/lookupDelete';
import { add, edit } from './schema';

/** The consent forms' wording, as a lookup screen. Printed from a patient's Consents tab. */
const crud = contentCrud({
	table: consentTemplate,
	label: 'Consent form',
	addSchema: add,
	editSchema: edit
});

/*
 * Deliberately unannotated. Adding `: PageServerLoad` widens the return to the generic
 * signature, and `PageData` then loses `addForm`/`editForm`/`rows`.
 */
export const load = crud.load;

export const actions = {
	add: crud.actions.add,
	edit: crud.actions.edit,
	/** Soft delete, super admin only. A signed paper keeps its words whatever happens here. */
	delete: lookupDeleteAction(consentTemplate, 'consent form')
};
