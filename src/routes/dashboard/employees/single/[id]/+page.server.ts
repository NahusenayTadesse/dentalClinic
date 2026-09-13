import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { editStaff as schema } from '$lib/zodschemas/appointmentSchema';

import { db } from '$lib/server/db';
import {
	employee,
	employeeTermination,
	employmentStatuses,
	address,
	employeeGuarantor
} from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import {
	softDeleteEmployee,
	softDeleteStaffRecord,
	type StaffOwnedKind
} from '$lib/server/softDelete';
import { requireSuperAdmin } from '$lib/server/permissions';
import { hideFailure } from '$lib/server/dbErrors';
import type { Actions, PageServerLoad, RequestEvent } from './$types';
import { SECTIONS } from './sections';
import { fail } from 'sveltekit-superforms';
import { setFlash, redirect } from 'sveltekit-flash-message/server';

import {
	terminate,
	reinstate,
	editIdentity,
	editEmployment,
	editPersonal,
	editAddress,
	editFamily,
	addFamily,
	addQualification,
	editQualification,
	addExperience,
	editExperience,
	editGuarantor,
	addGuarantor,
	addSchedule,
	editSchedule,
	addContact,
	editContact,
	addAccount,
	editAccount
} from './schema';
import {
	empStatus,
	departments,
	eduLevel,
	subcities,
	paymentMethods,
	positions
} from '$lib/server/fastData';

import { saveUploadedFile } from '$lib/server/upload';

/**
 * Awaits an object of promises together, keeping each result under its own key.
 *
 * The one cast is forced: `Object.fromEntries` returns `Record<string, unknown>` whatever went in,
 * and the mapped type restores exactly the keys and awaited values that were passed. Nothing
 * outside this function sees anything untyped.
 */
async function awaitAll<T extends Record<string, Promise<unknown>>>(
	pending: T
): Promise<{ [K in keyof T]: Awaited<T[K]> }> {
	const settled = await Promise.all(
		Object.entries(pending).map(async ([key, value]) => [key, await value] as const)
	);
	return Object.fromEntries(settled) as { [K in keyof T]: Awaited<T[K]> };
}

/**
 * Every form and option list the detail page's dialogs need.
 *
 * These were twenty-six awaits in a row, six of them database queries each waiting on the last.
 * They are independent, so they now run together. Measured against a local database this made no
 * difference worth reporting — 17.8 ms median before, 19.6 ms after, inside the noise — because
 * each lookup takes well under a millisecond there. It is kept for the shape, and because the
 * gap only opens on a slower database link. The page's real cost is in `+layout.server.ts`.
 */
export const load: PageServerLoad = async () =>
	awaitAll({
		terminateForm: superValidate(zod4(terminate)),
		reinstateForm: superValidate(zod4(reinstate)),
		identityForm: superValidate(zod4(editIdentity)),
		employmentForm: superValidate(zod4(editEmployment)),
		personalForm: superValidate(zod4(editPersonal)),
		addressForm: superValidate(zod4(editAddress)),
		familyForm: superValidate(zod4(editFamily)),
		addfamilyForm: superValidate(zod4(addFamily)),
		addQualificationForm: superValidate(zod4(addQualification)),
		editQualificationForm: superValidate(zod4(editQualification)),
		addExperienceForm: superValidate(zod4(addExperience)),
		editExperienceForm: superValidate(zod4(editExperience)),
		editGuarantorForm: superValidate(zod4(editGuarantor)),
		addGuarantorForm: superValidate(zod4(addGuarantor)),
		addScheduleForm: superValidate(zod4(addSchedule)),
		editScheduleForm: superValidate(zod4(editSchedule)),
		addContactForm: superValidate(zod4(addContact)),
		editContactForm: superValidate(zod4(editContact)),
		addAccountForm: superValidate(zod4(addAccount)),
		editAccountForm: superValidate(zod4(editAccount)),

		statusList: empStatus(),
		departmentList: departments(),
		positionList: positions(),
		educationalLevelList: eduLevel(),
		subcityList: subcities(),
		bankList: paymentMethods()
	});

/**
 * Builds a super-admin-only delete action for one of the lists on this page.
 *
 * `kind` is baked in per action rather than read from the request: the client
 * chooses which button to press, never which table gets written to.
 */
const deleteStaffRecord =
	(kind: StaffOwnedKind, label: string) =>
	async ({ request, locals, params, cookies }: RequestEvent) => {
		requireSuperAdmin(locals);

		const data = await request.formData();
		const recordId = Number(data.get('id'));

		if (!recordId) {
			setFlash({ type: 'error', message: `No ${label} was selected.` }, cookies);
			return fail(400);
		}

		try {
			const deleted = await db.transaction(async (tx) =>
				softDeleteStaffRecord(tx, kind, recordId, Number(params.id), locals.user?.id)
			);

			if (!deleted) {
				// Either already gone, or the id does not belong to this employee.
				setFlash({ type: 'error', message: `That ${label} was not found.` }, cookies);
				return fail(404);
			}
		} catch (err: unknown) {
			setFlash(
				{
					type: 'error',
					message: hideFailure(
						`employees.delete.${kind}`,
						err,
						`Could not delete that ${label}. Please try again.`
					)
				},
				cookies
			);
			return fail(500);
		}

		setFlash({ type: 'success', message: `${label} deleted.` }, cookies);
		return { success: true };
	};

/**
 * A replacement upload, or the file already on record.
 *
 * An edit form re-posts every field, and a file input left untouched arrives as an empty `File`;
 * treating that as "remove the document" would wipe it on every unrelated edit.
 */
async function keepOrReplace(upload: unknown, current: string | null): Promise<string | null> {
	return upload instanceof File && upload.size > 0 ? saveUploadedFile(upload) : current;
}

/** A new upload, or nothing — for a form where the file is optional. */
async function optionalUpload(upload: unknown): Promise<string | null> {
	return upload instanceof File && upload.size > 0 ? saveUploadedFile(upload) : null;
}

export const actions: Actions = {
	/*
	 * The twelve add/edit pairs these replace were the same twenty lines each, differing in a
	 * table and about four field names — and every `edit` among them scoped on the row id alone,
	 * so any of these records could be edited from any employee's page. `childCrud` puts the owner
	 * in the `where` and stamps it on insert, so that is not something a caller can get wrong.
	 *
	 * See `sections.ts` for the six configurations. Guarantors are not among them: that section
	 * writes two tables, which `childCrud` deliberately does not do.
	 */
	addFamily: (event) => SECTIONS.family.actions.add(event, Number(event.params.id)),
	editFamily: (event) => SECTIONS.family.actions.edit(event, Number(event.params.id)),
	addQualification: (event) => SECTIONS.qualifications.actions.add(event, Number(event.params.id)),
	editQualification: (event) =>
		SECTIONS.qualifications.actions.edit(event, Number(event.params.id)),
	addExperience: (event) => SECTIONS.experience.actions.add(event, Number(event.params.id)),
	editExperience: (event) => SECTIONS.experience.actions.edit(event, Number(event.params.id)),
	addSchedule: (event) => SECTIONS.schedule.actions.add(event, Number(event.params.id)),
	editSchedule: (event) => SECTIONS.schedule.actions.edit(event, Number(event.params.id)),
	addContact: (event) => SECTIONS.contacts.actions.add(event, Number(event.params.id)),
	editContact: (event) => SECTIONS.contacts.actions.edit(event, Number(event.params.id)),
	addAccount: (event) => SECTIONS.accounts.actions.add(event, Number(event.params.id)),
	editAccount: (event) => SECTIONS.accounts.actions.edit(event, Number(event.params.id)),

	editStaff: async ({ request, cookies, locals }) => {
		const form = await superValidate(request, zod4(schema));

		if (!form.valid) {
			// Stay on the same page and set a flash message
			setFlash({ type: 'error', message: 'Please check your form data.' }, cookies);
			return fail(400, { form });
		}

		const { staffId, firstName, lastName, position, phone, email, hiredAt, govId, contract } =
			form.data;

		try {
			const files = await db
				.select({ govtId: employee.govtId, contract: employee.contract })
				.from(employee)
				.where(eq(employee.id, staffId))
				.then((rows) => rows[0]);
			let newGovId: string | null;
			let newContract: string | null;
			if (govId && govId.size > 0) {
				const imageName = await saveUploadedFile(govId);
				delete form.data.govId;
				newGovId = imageName;
			} else {
				newGovId = files.govtId;
			}

			if (contract && contract.size > 0) {
				const contractName = await saveUploadedFile(contract);
				delete form.data.contract;
				newContract = contractName;
			} else {
				newContract = files.contract;
			}

			await db
				.update(employee)
				.set({
					firstName,
					lastName,
					type: position,
					phone,
					email,
					hireDate: new Date(hiredAt),
					govtId: newGovId,
					contract: newContract,
					updatedBy: locals?.user?.id
				})
				.where(eq(employee.id, staffId));

			// Stay on the same page and set a flash message
			setFlash({ type: 'success', message: 'Service Updated Successuflly' }, cookies);
			return message(form, { type: 'success', text: 'Staff Member Updated Successfully!' });
		} catch (err: unknown) {
			const text = hideFailure(
				'employees.editStaff',
				err,
				'Could not update this staff member. Please try again.'
			);
			setFlash({ type: 'error', message: text }, cookies);
			return message(form, { type: 'error', text });
		}
	},
	/**
	 * Ends an employee's employment: records why, files the letter if there is one, and marks the
	 * record inactive under the status the clinic has designated for terminations.
	 *
	 * Three things this used to get wrong, each fatal on its own:
	 *
	 * - **The letter is optional, and terminating without one always failed.** The form and the
	 *   schema both say optional; the action called `saveUploadedFile` unconditionally, which throws
	 *   on a missing file, so every termination without an attachment came back as "Unexpected
	 *   Error: No file was uploaded."
	 * - **`new Date(x) || null` is never null.** A `Date` is truthy even when invalid, so a bad date
	 *   reached the database as `Invalid Date` rather than being refused.
	 * - **The termination status was looked up after the letter was saved.** On a clinic that had not
	 *   flagged a status for terminations — every fresh install — `data[0].id` threw, the transaction
	 *   rolled back, and the letter stayed on disk attached to nothing.
	 *
	 * Everything that can refuse now refuses before anything is written.
	 */
	terminate: async ({ params, request, locals }) => {
		const staffId = Number(params.id);
		const form = await superValidate(request, zod4(terminate));

		if (!form.valid) {
			return message(form, { type: 'error', text: 'Please check the form and try again.' });
		}

		const { reason, terminationDate, terminationLetter } = form.data;

		// Files cannot be serialised back to the page; the letter is read here or not at all.
		delete form.data.terminationLetter;

		const effective = new Date(terminationDate);
		if (Number.isNaN(effective.getTime())) {
			return message(form, { type: 'error', text: 'That termination date is not a valid date.' });
		}

		const [terminatedStatus] = await db
			.select({ id: employmentStatuses.id })
			.from(employmentStatuses)
			.where(eq(employmentStatuses.terminationStatus, true))
			.limit(1);

		if (!terminatedStatus) {
			return message(form, {
				type: 'error',
				text: 'No employment status is marked as the termination status. Set one under Admin Panel → Employment Status first.'
			});
		}

		try {
			const letter =
				terminationLetter && terminationLetter.size > 0
					? await saveUploadedFile(terminationLetter)
					: null;

			await db.transaction(async (tx) => {
				await tx.insert(employeeTermination).values({
					staffId,
					reason,
					terminationDate,
					terminationLetter: letter,
					createdBy: locals.user?.id
				});

				await tx
					.update(employee)
					.set({
						employmentStatus: terminatedStatus.id,
						terminationDate: effective,
						isActive: false,
						updatedBy: locals.user?.id
					})
					.where(eq(employee.id, staffId));
			});

			return message(form, { type: 'success', text: 'Employee terminated.' });
		} catch (err: unknown) {
			// Loud in the log, quiet to the client (§9).
			console.error('[employees] terminate failed:', err);
			return message(form, {
				type: 'error',
				text: 'Could not terminate this employee. Please try again.'
			});
		}
	},
	reinstate: async ({ params, request, locals }) => {
		const { id } = params;

		const form = await superValidate(request, zod4(reinstate));
		if (!form.valid) {
			// Stay on the same page and set a flash message
			return message(form, { type: 'error', text: `Error: check the form` });
		}
		const { newStatus } = form.data;

		try {
			if (!id) {
				return message(form, { type: 'error', text: `Employee Not Found` });
			}

			// Wrap the database operations in a transaction
			await db.transaction(async (tx) => {
				// 1. Insert the termination record

				// await tx.delete(employeeTermination).where(eq(employeeTermination.staffId, Number(id)));

				// 2. Update the employee status
				//
				//

				// const employmentStatus = await db
				// 	.select({
				// 		id: employmentStatuses.id
				// 	})
				// 	.from(employmentStatuses)
				// 	.where(eq(employmentStatuses.terminationStatus, true))
				// 	.then((data) => data[0].id);

				await tx
					.update(employee)
					.set({
						employmentStatus: newStatus,
						terminationDate: null,
						isActive: true,
						updatedBy: locals?.user?.id
					})
					.where(eq(employee.id, Number(id)));
			});
			return message(form, { type: 'success', text: 'Employee Reinstated Successfully!' });
		} catch (err: unknown) {
			return message(form, {
				type: 'error',
				text: hideFailure(
					'employees.reinstate',
					err,
					'Could not reinstate this employee. Please try again.'
				)
			});
		}
	},
	editIdentity: async ({ params, request, locals }) => {
		const { id } = params;

		const form = await superValidate(request, zod4(editIdentity));
		if (!form.valid) {
			// Stay on the same page and set a flash message
			return message(form, { type: 'error', text: `Error: check the form` });
		}
		const {
			firstName,
			fatherName,
			grandFatherName,
			gender,
			birthDate,
			photo,
			govtId,
			signature,
			existingPensionCard,
			pensionCard
		} = form.data;

		try {
			if (!id) {
				return message(form, { type: 'error', text: `Employee Not Found` });
			}

			// Wrap the database operations in a transaction
			await db.transaction(async (tx) => {
				// 1. Update the employee identity
				const existing = await tx
					.select()
					.from(employee)
					.where(eq(employee.id, Number(id)))
					.then((row) => row[0]);

				// if (!existing) throw new Error('Guarantor not found');

				// 2. Helper to handle file logic consistently
				const resolveFile = async (newVal, oldVal) => {
					if (newVal instanceof File && newVal.size > 0) {
						return await saveUploadedFile(newVal);
					}
					return oldVal;
				};

				const newPhoto = await resolveFile(photo, existing.photo);
				const newGovtId = await resolveFile(govtId, existing.govtId);
				const newSignature = await resolveFile(signature, existing.signiture);
				const newPensionCard = await resolveFile(pensionCard, existing.pensionCard);
				await tx
					.update(employee)
					.set({
						name: firstName,
						fatherName,
						grandFatherName,
						gender,
						photo: newPhoto,
						govtId: newGovtId,
						birthDate: new Date(birthDate),
						existingPensionCard,
						pensionCard: newPensionCard,
						signiture: newSignature,
						updatedBy: locals?.user?.id
					})
					.where(eq(employee.id, Number(id)));
			});
			return message(form, { type: 'success', text: 'Employee Identity Updated Successfully!' });
		} catch (err: unknown) {
			return message(form, {
				type: 'error',
				text: hideFailure(
					'employees.editIdentity',
					err,
					'Could not save the identity details. Please try again.'
				)
			});
		}
	},
	editEmployment: async ({ params, request, locals }) => {
		const { id } = params;

		const form = await superValidate(request, zod4(editEmployment));
		if (!form.valid) {
			// Stay on the same page and set a flash message
			return message(form, { type: 'error', text: `Error: check the form` });
		}
		const { leavesLeft, educationalLevel, employmentStatus, hireDate } = form.data;

		try {
			if (!id) {
				return message(form, { type: 'error', text: `Employee Not Found` });
			}

			// Wrap the database operations in a transaction
			await db.transaction(async (tx) => {
				// 1. Update the employee identity

				await tx
					.update(employee)
					.set({
						employmentStatus,
						educationalLevel,
						leavesLeft,
						hireDate: new Date(hireDate),
						updatedBy: locals?.user?.id
					})
					.where(eq(employee.id, Number(id)));
			});
			return message(form, { type: 'success', text: 'Employment Details Updated Successfully!' });
		} catch (err: unknown) {
			return message(form, {
				type: 'error',
				text: hideFailure(
					'employees.editEmployment',
					err,
					'Could not save the employment details. Please try again.'
				)
			});
		}
	},
	editPersonal: async ({ params, request, locals }) => {
		const { id } = params;

		const form = await superValidate(request, zod4(editPersonal));

		console.log(form);
		if (!form.valid) {
			// Stay on the same page and set a flash message
			return message(form, { type: 'error', text: `Error: check the form` });
		}
		const { tinNo, martialStatus, bloodType } = form.data;

		try {
			if (!id) {
				return message(form, { type: 'error', text: `Employee Not Found` });
			}

			// Wrap the database operations in a transaction
			await db.transaction(async (tx) => {
				// 1. Update the employee identity

				await tx
					.update(employee)
					.set({
						tinNo: tinNo ?? null,
						martialStatus,
						bloodType,
						updatedBy: locals?.user?.id
					})
					.where(eq(employee.id, Number(id)));
			});
			return message(form, { type: 'success', text: 'Employee Details Updated Successfully!' });
		} catch (err: unknown) {
			return message(form, {
				type: 'error',
				text: hideFailure(
					'employees.editPersonal',
					err,
					'Could not save the personal details. Please try again.'
				)
			});
		}
	},
	editAddress: async ({ request, params }) => {
		const form = await superValidate(request, zod4(editAddress));
		if (!form.valid) {
			// Stay on the same page and set a flash message
			return message(form, { type: 'error', text: `Error: check the form` });
		}
		const {
			id,
			street,
			subcity,
			otherSubcity,
			kebele,
			buildingNumber,
			floor,
			houseNumber,
			status
		} = form.data;

		try {
			if (!id) {
				return message(form, { type: 'error', text: `Employee Not Found` });
			}

			/*
			 * Address is owned the other way round — the employee points at it — so there is no
			 * owner column to match. Without this check the action updated whatever address id the
			 * form carried, which is every address in the system from any employee's page.
			 */
			const [owned] = await db
				.select({ id: employee.id })
				.from(employee)
				.where(and(eq(employee.id, Number(params.id)), eq(employee.address, Number(id))))
				.limit(1);

			if (!owned) {
				return message(form, {
					type: 'error',
					text: 'That address does not belong to this employee.'
				});
			}

			// Wrap the database operations in a transaction
			await db.transaction(async (tx) => {
				// 1. Update the employee identity

				await tx
					.update(address)
					.set({
						subcityId: subcity,
						street,
						kebele,
						buildingNumber,
						otherSubcity,
						floor: floor ? Number(floor) : null,
						houseNumber: houseNumber ? Number(houseNumber) : null,
						status
					})
					.where(eq(address.id, Number(id)));
			});
			return message(form, { type: 'success', text: 'Address Details Updated Successfully!' });
		} catch (err: unknown) {
			return message(form, {
				type: 'error',
				text: hideFailure(
					'employees.editAddress',
					err,
					'Could not save the address. Please try again.'
				)
			});
		}
	},
	/**
	 * Updates a guarantor, keeping any document that was not replaced.
	 *
	 * Hand-written rather than on `childCrud`: a guarantor also carries an address row, and
	 * `childCrud` manages one table by design (see `sections.ts`).
	 *
	 * Two bugs here, both silent. The success `message` was returned from *inside* the transaction
	 * callback, and nothing returned the transaction's result — so a successful save answered with
	 * an empty 204 and no confirmation ever reached the screen. And the existing row was read by id
	 * alone, then dereferenced unguarded, so an id that matched nothing threw.
	 */
	editGuarantor: async ({ request, locals, params }) => {
		const staffId = Number(params.id);
		const form = await superValidate(request, zod4(editGuarantor));

		if (!form.valid) {
			return message(form, { type: 'error', text: 'Please check the form and try again.' });
		}

		const { id, name, phone, email, relationship, relation, jobType, company, salary } = form.data;
		const { photo, document, govtId } = form.data;
		delete form.data.photo;
		delete form.data.document;
		delete form.data.govtId;

		// Scoped to this employee, so another employee's guarantor id finds nothing here either.
		const [existing] = await db
			.select()
			.from(employeeGuarantor)
			.where(and(eq(employeeGuarantor.id, Number(id)), eq(employeeGuarantor.staffId, staffId)))
			.limit(1);

		if (!existing) {
			return message(form, { type: 'error', text: 'That guarantor was not found.' });
		}

		try {
			// Files first: a write to disk cannot be rolled back, so it happens before the row that
			// would point at it rather than inside a transaction that pretends otherwise.
			const values = {
				photo: await keepOrReplace(photo, existing.photo),
				gurantorDocument: await keepOrReplace(document, existing.gurantorDocument),
				govtId: await keepOrReplace(govtId, existing.govtId)
			};

			await db
				.update(employeeGuarantor)
				.set({
					name,
					phone,
					email,
					relationship,
					relation,
					jobType,
					company,
					salary: String(salary),
					...values,
					updatedBy: locals.user?.id
				})
				.where(and(eq(employeeGuarantor.id, existing.id), eq(employeeGuarantor.staffId, staffId)));

			return message(form, { type: 'success', text: 'Guarantor updated.' });
		} catch (err: unknown) {
			return message(form, {
				type: 'error',
				text: hideFailure(
					'employees.editGuarantor',
					err,
					'Could not save the guarantor. Please try again.'
				)
			});
		}
	},
	/**
	 * Adds a guarantor and the address they live at, together.
	 *
	 * The address was inserted with `db` inside a transaction opened as `tx`, so it committed on its
	 * own: a guarantor insert that failed afterwards left an address row belonging to nobody. Both
	 * inserts are on `tx` now. And, as in `editGuarantor`, the success message was returned from
	 * inside the transaction and never reached the client — verified: a successful add answered
	 * `{"type":"success","status":204,"data":"-1"}`, with no form and no message.
	 */
	addGuarantor: async ({ request, locals, params }) => {
		const staffId = Number(params.id);
		const form = await superValidate(request, zod4(addGuarantor));

		if (!form.valid) {
			return message(form, { type: 'error', text: 'Please check the form and try again.' });
		}

		const { name, phone, email, relationship, relation, jobType, company, salary } = form.data;
		const { street, subcity, otherSubcity, kebele, buildingNumber, floor, houseNumber } = form.data;
		const { photo, document, govtId } = form.data;
		delete form.data.photo;
		delete form.data.document;
		delete form.data.govtId;

		try {
			const files = {
				photo: await optionalUpload(photo),
				gurantorDocument: await optionalUpload(document),
				govtId: await optionalUpload(govtId)
			};

			await db.transaction(async (tx) => {
				const [newAddress] = await tx
					.insert(address)
					.values({
						street,
						subcityId: subcity,
						otherSubcity,
						kebele,
						buildingNumber,
						floor,
						houseNumber,
						status: true
					})
					.$returningId();

				await tx.insert(employeeGuarantor).values({
					name,
					staffId,
					phone,
					email,
					relationship,
					relation,
					jobType,
					company,
					salary: String(salary),
					...files,
					address: newAddress.id,
					createdBy: locals.user?.id
				});
			});

			return message(form, { type: 'success', text: 'Guarantor added.' });
		} catch (err: unknown) {
			return message(form, {
				type: 'error',
				text: hideFailure(
					'employees.addGuarantor',
					err,
					'Could not add the guarantor. Please try again.'
				)
			});
		}
	},
	/**
	 * Soft delete of the whole employee. Super admin only — `requireSuperAdmin`
	 * throws 403 rather than failing quietly, because the hidden button is UX,
	 * not access control.
	 */
	delete: async ({ locals, params, cookies }) => {
		requireSuperAdmin(locals);
		const { id } = params;

		try {
			await db.transaction(async (tx) => {
				await softDeleteEmployee(tx, Number(id), locals.user?.id);
			});
		} catch (err: unknown) {
			setFlash(
				{
					type: 'error',
					message: hideFailure(
						'employees.delete',
						err,
						'Could not delete this employee. Please try again.'
					)
				},
				cookies
			);
			return fail(500);
		}

		redirect(
			'/dashboard/employees',
			{ type: 'success', message: 'Employee and all their records deleted.' },
			cookies
		);
	},

	deleteFamily: deleteStaffRecord('family', 'family member'),
	deleteQualification: deleteStaffRecord('qualification', 'qualification'),
	deleteExperience: deleteStaffRecord('experience', 'work experience'),
	deleteGuarantor: deleteStaffRecord('guarantor', 'guarantor'),
	deleteSchedule: deleteStaffRecord('schedule', 'schedule'),
	deleteContact: deleteStaffRecord('contact', 'contact'),
	deleteAccount: deleteStaffRecord('account', 'bank account'),
	deleteCommission: deleteStaffRecord('commission', 'commission')
};
