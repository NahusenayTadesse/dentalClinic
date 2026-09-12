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
 * **Renames live in `transform`.** The forms and the columns disagree in a handful of places —
 * `relationShip` against `relationship`, `status` against `isActive` — and the honest fix is to
 * rename the form fields to match. That is a change to six components and their schemas, so it is
 * not smuggled in here; the mapping is written down instead, in one place, where the drift is
 * visible.
 *
 * **Guarantors are not here on purpose.** That section writes two tables — an address and then
 * the guarantor pointing at it — and `childCrud` manages one. Its non-goals already say so. It
 * keeps its hand-written pair.
 */

/** Moves a value from one key to another, when the form and the column disagree. */
function rename(values: Record<string, unknown>, from: string, to: string) {
	if (from in values) {
		values[to] = values[from];
		delete values[from];
	}
	return values;
}

/** Every form here posts `status` for what the schema calls `isActive`. */
const statusToIsActive = (values: Record<string, unknown>) => rename(values, 'status', 'isActive');

export const family = childCrud({
	table: staffFamilies,
	ownerColumn: 'staffId',
	label: 'Family member',
	addSchema: addFamily,
	editSchema: editFamily,
	transform: (values) => {
		rename(values, 'relationShip', 'relationship');
		rename(values, 'otherRelationShip', 'otherRelationship');
		return statusToIsActive(values);
	}
});

export const qualifications = childCrud({
	table: qualification,
	ownerColumn: 'staffId',
	label: 'Qualification',
	addSchema: addQualification,
	editSchema: editQualification,
	// The upload is posted as `certificate` and stored as its filename under the same name.
	fileFields: ['certificate'],
	transform: (values) => {
		rename(values, 'educationalLevel', 'educationLevel');
		return statusToIsActive(values);
	}
});

export const experience = childCrud({
	table: workExperience,
	ownerColumn: 'staffId',
	label: 'Work experience',
	addSchema: addExperience,
	editSchema: editExperience,
	fileFields: ['certificate'],
	transform: statusToIsActive
});

export const schedule = childCrud({
	table: staffSchedule,
	ownerColumn: 'staffId',
	label: 'Schedule',
	addSchema: addSchedule,
	editSchema: editSchedule,
	transform: (values) => {
		rename(values, 'day', 'weekDay');
		return statusToIsActive(values);
	}
});

export const contacts = childCrud({
	table: staffContacts,
	ownerColumn: 'staffId',
	label: 'Contact',
	addSchema: addContact,
	editSchema: editContact,
	transform: statusToIsActive
});

export const accounts = childCrud({
	table: staffAccounts,
	ownerColumn: 'staffId',
	label: 'Account',
	addSchema: addAccount,
	editSchema: editAccount,
	transform: (values) => {
		rename(values, 'paymentMethod', 'paymentMethodId');
		return statusToIsActive(values);
	}
});

/** Every section, for the load that builds their forms. */
export const SECTIONS = { family, qualifications, experience, schedule, contacts, accounts };
