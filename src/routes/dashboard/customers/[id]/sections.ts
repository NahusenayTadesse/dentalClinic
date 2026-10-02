import { childCrud } from '$lib/server/childCrud';
import { customerContacts } from '$lib/server/db/schema';
import { addContact, editContact } from './schema';

/**
 * The payer's child tables — its contacts — as `childCrud` sections.
 *
 * Hand-written until now, and the edit trusted the posted contact id: it updated whichever contact
 * the form named, so a crafted post could rewrite another payer's phone number. `childCrud` checks
 * the row belongs to this payer. Deleting a contact needs a super admin, as it did.
 */
export const SECTIONS = {
	Contact: childCrud({
		table: customerContacts,
		ownerColumn: 'customerId',
		label: 'Contact',
		addSchema: addContact,
		editSchema: editContact,
		superAdminDelete: true
	})
};
