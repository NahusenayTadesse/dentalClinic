import {
	staffFamilies,
	qualification,
	workExperience,
	staffSchedule,
	staffContacts,
	staffAccounts
} from '$lib/server/db/schema';
import { childCrud } from '$lib/server/childCrud';

import {
	addFamily,
	editFamily,
	addQualification,
	editQualification,
	addExperience,
	editExperience,
	addSchedule,
	editSchedule,
	addContact,
	editContact,
	addAccount,
	editAccount
} from './schema';

/**
 * The child sections of an employee's record, as configuration rather than as twelve actions.
 *
 * Each of these was a hand-written `add` and `edit` pair: validate, pull the fields out by name,
 * insert or update, catch, toast. They differed in the table and about four field names, and
 * they had drifted — every one of the `edit` halves scoped its update on the row id alone, so a
 * row id from another employee matched, and any of these records could be edited from any
 * employee's page. `childCrud` puts the owner in the `where` and stamps it on insert, which is
 * what makes that class of mistake unavailable rather than merely fixed.
 *
 * **No section needs a `transform`.** Each carried one at first, to map form fields onto columns
 * spelled differently — `relationShip` against `relationship`, `day` against `weekDay`. The fields
 * now match their columns in the schemas, the dialogs and the layout's read aliases, and
 * `childCrud` maps `status` to `isActive` itself, as `contentCrud` always has. One that needs a
 * mapping again should have a reason to.
 *
 * **Guarantors are not here on purpose.** That section writes two tables — an address and then
 * the guarantor pointing at it — and `childCrud` manages one. Its non-goals already say so. It
 * keeps its hand-written pair.
 */

export const family = childCrud({
	table: staffFamilies,
	ownerColumn: 'staffId',
	label: 'Family member',
	addSchema: addFamily,
	editSchema: editFamily
});

export const qualifications = childCrud({
	table: qualification,
	ownerColumn: 'staffId',
	label: 'Qualification',
	addSchema: addQualification,
	editSchema: editQualification,
	// The upload is posted as `certificate` and stored as its filename under the same name.
	fileFields: ['certificate']
});

export const experience = childCrud({
	table: workExperience,
	ownerColumn: 'staffId',
	label: 'Work experience',
	addSchema: addExperience,
	editSchema: editExperience,
	fileFields: ['certificate']
});

export const schedule = childCrud({
	table: staffSchedule,
	ownerColumn: 'staffId',
	label: 'Schedule',
	addSchema: addSchedule,
	editSchema: editSchedule
});

export const contacts = childCrud({
	table: staffContacts,
	ownerColumn: 'staffId',
	label: 'Contact',
	addSchema: addContact,
	editSchema: editContact
});

export const accounts = childCrud({
	table: staffAccounts,
	ownerColumn: 'staffId',
	label: 'Account',
	addSchema: addAccount,
	editSchema: editAccount
});

/** Every section, for the load that builds their forms. */
export const SECTIONS = { family, qualifications, experience, schedule, contacts, accounts };
