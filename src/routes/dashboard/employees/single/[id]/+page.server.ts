import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { editStaff as schema } from '$lib/zodschemas/appointmentSchema';

import { db } from '$lib/server/db';
import {
	employee,
	employeeTermination,
	employmentStatuses,
	address,
	staffFamilies,
	qualification,
	workExperience,
	employeeGuarantor,
	staffSchedule,
	staffContacts,
	staffAccounts
} from '$lib/server/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import {
	softDeleteEmployee,
	softDeleteStaffRecord,
	type StaffOwnedKind
} from '$lib/server/softDelete';
import { requireSuperAdmin } from '$lib/server/permissions';
import type { Actions, PageServerLoad, RequestEvent } from './$types';
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
	editAccount,
	editCommission
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

export const load: PageServerLoad = async () => {
	const terminateForm = await superValidate(zod4(terminate));
	const reinstateForm = await superValidate(zod4(reinstate));
	const identityForm = await superValidate(zod4(editIdentity));
	const employmentForm = await superValidate(zod4(editEmployment));
	const personalForm = await superValidate(zod4(editPersonal));
	const addressForm = await superValidate(zod4(editAddress));
	const familyForm = await superValidate(zod4(editFamily));
	const addfamilyForm = await superValidate(zod4(addFamily));
	const addQualificationForm = await superValidate(zod4(addQualification));
	const editQualificationForm = await superValidate(zod4(editQualification));
	const editExperienceForm = await superValidate(zod4(editExperience));
	const addExperienceForm = await superValidate(zod4(addExperience));
	const editGuarantorForm = await superValidate(zod4(editGuarantor));
	const addGuarantorForm = await superValidate(zod4(addGuarantor));
	const addScheduleForm = await superValidate(zod4(addSchedule));
	const editScheduleForm = await superValidate(zod4(editSchedule));
	const editContactForm = await superValidate(zod4(editContact));
	const addContactForm = await superValidate(zod4(addContact));
	const addAccountForm = await superValidate(zod4(addAccount));
	const editAccountForm = await superValidate(zod4(editAccount));
	const editCommissionForm = await superValidate(zod4(editCommission));

	const statusList = await empStatus();
	const departmentList = await departments();
	const positionList = await positions();
	const educationalLevelList = await eduLevel();
	const subcityList = await subcities();
	const bankList = await paymentMethods();

	return {
		terminateForm,
		reinstateForm,
		statusList,
		identityForm,
		departmentList,
		positionList,
		employmentForm,
		educationalLevelList,
		personalForm,
		addressForm,
		subcityList,
		familyForm,
		addfamilyForm,
		addQualificationForm,
		editQualificationForm,
		addExperienceForm,
		editExperienceForm,
		editGuarantorForm,
		addGuarantorForm,
		addScheduleForm,
		editScheduleForm,
		addContactForm,
		editContactForm,
		addAccountForm,
		editAccountForm,
		bankList,
		editCommissionForm
	};
};

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
		} catch (err) {
			console.error(`Error deleting ${label}:`, err);
			setFlash(
				{
					type: 'error',
					message: `Could not delete ${label}: ${err instanceof Error ? err.message : 'Unknown error'}`
				},
				cookies
			);
			return fail(500);
		}

		setFlash({ type: 'success', message: `${label} deleted.` }, cookies);
		return { success: true };
	};

export const actions: Actions = {
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
		} catch (err) {
			setFlash({ type: 'error', message: `Unexpected Error: ${err?.message}` }, cookies);
			return message(form, {
				type: 'error',
				text: 'An error occurred while updating the staff member. ' + err?.message
			});
		}
	},
	terminate: async ({ params, cookies, request, locals }) => {
		const { id } = params;

		const form = await superValidate(request, zod4(terminate));

		if (!form.valid) {
			// Stay on the same page and set a flash message
			return message(form, { type: 'error', text: `Error: check the form` });
		}
		const { reason, terminationDate, terminationLetter } = form.data;

		try {
			if (!id) {
				return message(form, { type: 'error', text: `Employee Not Found` });
			}
			const terminationLetterName = await saveUploadedFile(terminationLetter);
			if (terminationLetterName) delete form.data.terminationLetter;
			await db.transaction(async (tx) => {
				await tx.insert(employeeTermination).values({
					staffId: Number(id),
					reason,
					terminationDate,
					terminationLetter: terminationLetterName,
					createdBy: locals?.user?.id
				});

				const employmentStatus = await db
					.select({
						id: employmentStatuses.id
					})
					.from(employmentStatuses)
					.where(eq(employmentStatuses.terminationStatus, true))
					.then((data) => data[0].id);

				await tx
					.update(employee)
					.set({
						employmentStatus,
						terminationDate: new Date(terminationDate) || null,
						isActive: false,
						updatedBy: locals?.user?.id
					})
					.where(eq(employee.id, Number(id)));
			});
			return message(form, { type: 'success', text: 'Employee Terminated Successfully!' });
		} catch (err) {
			console.error('Error terminating employee:', err);
			return message(form, { type: 'error', text: `Unexpected Error: ${err?.message}` });
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
		} catch (err) {
			console.error('Error terminating employee:', err);
			return message(form, { type: 'error', text: `Unexpected Error: ${err?.message}` });
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
		} catch (err) {
			console.error('Error updating employee identity:', err);
			return message(form, { type: 'error', text: `Unexpected Error: ${err?.message}` });
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
		} catch (err) {
			console.error('Error updating employment details:', err);
			return message(form, { type: 'error', text: `Unexpected Error: ${err?.message}` });
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
		} catch (err) {
			console.error('Error updating employee details:', err);
			return message(form, { type: 'error', text: `Unexpected Error: ${err?.message}` });
		}
	},
	editAddress: async ({ request }) => {
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
		} catch (err) {
			console.error('Error updating Address details:', err);
			return message(form, { type: 'error', text: `Unexpected Error: ${err?.message}` });
		}
	},
	addFamily: async ({ request, locals, params }) => {
		const { id } = params;
		const form = await superValidate(request, zod4(addFamily));
		if (!form.valid) {
			// Stay on the same page and set a flash message
			return message(form, { type: 'error', text: `Error: check the form` });
		}
		const {
			name,
			gender,
			phone,
			email,
			relationShip,
			otherRelationShip,
			emergencyContact,
			status
		} = form.data;

		try {
			// Wrap the database operations in a transaction
			await db.transaction(async (tx) => {
				// 1. Update the employee identity

				await tx.insert(staffFamilies).values({
					name,
					staffId: Number(id),
					gender,
					phone,
					email,
					relationship: relationShip,
					otherRelationship: otherRelationShip,
					emergencyContact,
					isActive: status,
					createdBy: locals?.user?.id
				});
			});
			return message(form, {
				type: 'success',
				text: 'Family Member Details Added Successfully!'
			});
		} catch (err) {
			console.error('Error added Family Member details:', err);
			return message(form, { type: 'error', text: `Unexpected Error: ${err?.message}` });
		}
	},
	editFamily: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(editFamily));
		if (!form.valid) {
			// Stay on the same page and set a flash message
			return message(form, { type: 'error', text: `Error: check the form` });
		}
		const {
			id,
			name,
			gender,
			phone,
			email,
			relationShip,
			otherRelationShip,
			emergencyContact,
			status
		} = form.data;

		try {
			if (!id) {
				return message(form, { type: 'error', text: `Employee Not Found` });
			}

			// Wrap the database operations in a transaction
			await db.transaction(async (tx) => {
				// 1. Update the employee identity

				await tx
					.update(staffFamilies)
					.set({
						name,
						gender,
						phone,
						email,
						relationship: relationShip,
						otherRelationship: otherRelationShip,
						emergencyContact,
						isActive: status,
						updatedBy: locals?.user?.id
					})
					.where(eq(staffFamilies.id, Number(id)));
			});
			return message(form, {
				type: 'success',
				text: 'Family Member Details Updated Successfully!'
			});
		} catch (err) {
			console.error('Error updating Family Member details:', err);
			return message(form, { type: 'error', text: `Unexpected Error: ${err?.message}` });
		}
	},
	addQualification: async ({ request, locals, params }) => {
		const { id } = params;
		const form = await superValidate(request, zod4(addQualification));
		if (!form.valid) {
			// Stay on the same page and set a flash message
			return message(form, { type: 'error', text: `Error: check the form` });
		}
		const { field, educationalLevel, graduationDate, schoolName, certificate } = form.data;

		try {
			// Wrap the database operations in a transaction
			await db.transaction(async (tx) => {
				// 1. Update the employee identity
				if (certificate) {
					const certificateName = await saveUploadedFile(certificate);

					await tx.insert(qualification).values({
						staffId: Number(id),
						field,
						educationLevel: educationalLevel,
						graduationDate,
						schoolName,
						certificate: certificateName,
						createdBy: locals?.user?.id
					});
				} else {
					await tx.insert(qualification).values({
						staffId: Number(id),
						field,
						educationLevel: educationalLevel,
						graduationDate,
						schoolName,
						createdBy: locals?.user?.id
					});
				}
			});
			return message(form, {
				type: 'success',
				text: 'Qualification Details Added Successfully!'
			});
		} catch (err) {
			console.error('Error added Qualification details:', err);
			return message(form, { type: 'error', text: `Unexpected Error: ${err?.message}` });
		}
	},
	editQualification: async ({ request, locals, params }) => {
		const form = await superValidate(request, zod4(editQualification));

		if (!form.valid) {
			// Stay on the same page and set a flash message
			return message(form, { type: 'error', text: `Error: check the form` });
		}
		const { id, field, educationalLevel, graduationDate, schoolName, certificate } = form.data;

		try {
			// Wrap the database operations in a transaction
			await db.transaction(async (tx) => {
				// 1. Update the employee identity
				if (certificate) {
					const certificateName = await saveUploadedFile(certificate);

					await tx
						.update(qualification)
						.set({
							field,
							educationLevel: educationalLevel,
							graduationDate: new Date(graduationDate),
							schoolName,
							certificate: certificateName,
							updatedBy: locals?.user?.id
						})
						.where(eq(qualification.id, Number(id)));
				} else {
					await tx
						.update(qualification)
						.set({
							field,
							educationLevel: educationalLevel,
							graduationDate: new Date(graduationDate),
							schoolName,
							updatedBy: locals?.user?.id
						})
						.where(eq(qualification.id, Number(id)));
				}
			});

			return message(form, {
				type: 'success',
				text: 'Qualification Details Updated Successfully!'
			});
		} catch (err) {
			console.error('Error updating Qualification details:', err);
			return message(form, { type: 'error', text: `Unexpected Error: ${err?.message}` });
		}
	},
	addExperience: async ({ request, locals, params }) => {
		const { id } = params;
		const form = await superValidate(request, zod4(addExperience));
		if (!form.valid) {
			// Stay on the same page and set a flash message
			return message(form, { type: 'error', text: `Error: check the form` });
		}
		const { companyName, position, startDate, endDate, description, certificate } = form.data;

		try {
			// Wrap the database operations in a transaction
			await db.transaction(async (tx) => {
				// 1. Update the employee identity
				//
				if (certificate) {
					const certificateName = await saveUploadedFile(certificate);

					await tx.insert(workExperience).values({
						staffId: Number(id),
						companyName,
						position,
						startDate,
						endDate,
						description,
						certificate: certificateName,
						createdBy: locals?.user?.id
					});
				} else {
					await tx.insert(workExperience).values({
						staffId: Number(id),
						companyName,
						position,
						startDate,
						endDate,
						description,
						createdBy: locals?.user?.id
					});
				}
			});
			return message(form, {
				type: 'success',
				text: 'Experience Details Added Successfully!'
			});
		} catch (err) {
			console.error('Error added experience details:', err);
			return message(form, { type: 'error', text: `Unexpected Error: ${err?.message}` });
		}
	},
	editExperience: async ({ request, locals, params }) => {
		const form = await superValidate(request, zod4(editExperience));

		if (!form.valid) {
			// Stay on the same page and set a flash message
			return message(form, { type: 'error', text: `Error: check the form` });
		}
		const { id, companyName, position, startDate, endDate, description, certificate } = form.data;

		try {
			// Wrap the database operations in a transaction
			await db.transaction(async (tx) => {
				// 1. Update the employee identity
				if (certificate) {
					const certificateName = await saveUploadedFile(certificate);

					await tx
						.update(workExperience)
						.set({
							companyName,
							position,
							startDate: new Date(startDate),
							endDate: new Date(endDate),
							description,
							certificate: certificateName,
							updatedBy: locals?.user?.id
						})
						.where(eq(workExperience.id, Number(id)));
				} else {
					await tx
						.update(workExperience)
						.set({
							companyName,
							position,
							startDate: new Date(startDate),
							endDate: new Date(endDate),
							description,
							updatedBy: locals?.user?.id
						})
						.where(eq(workExperience.id, Number(id)));
				}
			});

			return message(form, {
				type: 'success',
				text: 'Experience Details Updated Successfully!'
			});
		} catch (err) {
			return message(form, { type: 'error', text: `Unexpected Error: ${err?.message}` });
		}
	},
	editGuarantor: async ({ request, locals, params }) => {
		const form = await superValidate(request, zod4(editGuarantor));

		if (!form.valid) {
			return message(form, { type: 'error', text: `Error: check the form` });
		}

		const {
			id,
			name,
			phone,
			email,
			relationship,
			relation,
			jobType,
			company,
			salary,
			photo,
			document,
			govtId
		} = form.data;

		try {
			// Use a single transaction
			await db.transaction(async (tx) => {
				// 1. Fetch old files using the transaction client 'tx'
				const existing = await tx
					.select()
					.from(employeeGuarantor)
					.where(eq(employeeGuarantor.id, id))
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
				const newDocument = await resolveFile(document, existing.gurantorDocument);
				const newGovtId = await resolveFile(govtId, existing.govtId);

				// 3. Update using 'tx'
				await tx
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
						photo: newPhoto,
						gurantorDocument: newDocument,
						govtId: newGovtId,
						updatedBy: locals?.user?.id
					})
					.where(eq(employeeGuarantor.id, Number(id)));

				return message(form, {
					type: 'success',
					text: 'Guarantor Details Updated Successfully!'
				});
			});
		} catch (err) {
			console.error('Database Error:', err);
			return message(form, {
				type: 'error',
				text: `Update failed: ${err instanceof Error ? err.message : 'Unknown error'}`
			});
		}
	},
	addGuarantor: async ({ request, locals, params }) => {
		const { id } = params;
		const form = await superValidate(request, zod4(addGuarantor));
		console.log(form);
		if (!form.valid) {
			return message(form, { type: 'error', text: `Error: check the form` });
		}

		const {
			name,
			phone,
			email,
			relationship,
			relation,
			jobType,
			company,
			salary,
			photo,
			document,
			govtId,
			street,
			subcity,
			otherSubcity,
			kebele,
			buildingNumber,
			floor,
			houseNumber
		} = form.data;

		try {
			// Use a single transaction
			await db.transaction(async (tx) => {
				// 1. Fetch old files using the transaction client 'tx'

				const [newAddress] = await db
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

				let newPhoto: string;
				let newDocument: string;
				let newGovtId: string;
				if (photo) newPhoto = await saveUploadedFile(photo);
				if (document) newDocument = await saveUploadedFile(document);
				if (govtId) newGovtId = await saveUploadedFile(govtId);

				// 3. Update using 'tx'
				await tx.insert(employeeGuarantor).values({
					name,
					staffId: Number(id),
					phone,
					email,
					relationship,
					relation,
					jobType,
					company,
					salary: String(salary),
					photo: newPhoto,
					gurantorDocument: newDocument,
					govtId: newGovtId,
					createdBy: locals?.user?.id,
					address: newAddress.id
				});

				return message(form, {
					type: 'success',
					text: 'Guarantor Details Updated Successfully!'
				});
			});
		} catch (err) {
			return message(form, {
				type: 'error',
				text: `Update failed: ${err instanceof Error ? err.message : 'Unknown error'}`
			});
		}
	},
	addSchedule: async ({ request, locals, params }) => {
		const { id } = params;
		const form = await superValidate(request, zod4(addSchedule));

		if (!form.valid) {
			return message(form, { type: 'error', text: `Error: check the form` });
		}

		const { day, startTime, endTime, status } = form.data;

		try {
			await db.transaction(async (tx) => {
				await tx.insert(staffSchedule).values({
					weekDay: day,
					startTime,
					staffId: Number(id),
					endTime,
					isActive: status,
					createdBy: locals?.user?.id
				});

				return message(form, {
					type: 'success',
					text: 'Schedule Details Created Successfully!'
				});
			});
		} catch (err) {
			return message(form, {
				type: 'error',
				text: `Creating Schedule failed: ${err instanceof Error ? err.message : 'Unknown error'}`
			});
		}
	},
	editSchedule: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(editSchedule));

		if (!form.valid) {
			return message(form, { type: 'error', text: `Error: check the form` });
		}

		const { id, day, startTime, endTime, status } = form.data;

		try {
			await db.transaction(async (tx) => {
				await tx
					.update(staffSchedule)
					.set({
						weekDay: day,
						startTime,
						endTime,
						isActive: status,
						updatedBy: locals?.user?.id
					})
					.where(eq(staffSchedule.id, id));

				return message(form, {
					type: 'success',
					text: 'Schedule Details Updated Successfully!'
				});
			});
		} catch (err) {
			return message(form, {
				type: 'error',
				text: `Updating Schedule failed: ${err instanceof Error ? err.message : 'Unknown error'}`
			});
		}
	},
	addContact: async ({ request, locals, params }) => {
		const { id } = params;
		const form = await superValidate(request, zod4(addContact));

		if (!form.valid) {
			return message(form, { type: 'error', text: `Error: check the form` });
		}

		const { contactDetail, contactType, status } = form.data;

		try {
			await db.transaction(async (tx) => {
				await tx.insert(staffContacts).values({
					staffId: Number(id),
					contactDetail,
					contactType,
					isActive: status,
					createdBy: locals?.user?.id
				});

				return message(form, {
					type: 'success',
					text: 'Contact Details Created Successfully!'
				});
			});
		} catch (err) {
			return message(form, {
				type: 'error',
				text: `Creating Contact failed: ${err instanceof Error ? err.message : 'Unknown error'}`
			});
		}
	},
	editContact: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(editContact));

		if (!form.valid) {
			return message(form, { type: 'error', text: `Error: check the form` });
		}

		const { id, contactDetail, contactType, status } = form.data;

		try {
			await db.transaction(async (tx) => {
				await tx
					.update(staffContacts)
					.set({
						contactDetail,
						contactType,
						isActive: status,
						updatedBy: locals?.user?.id
					})
					.where(eq(staffContacts.id, id));

				return message(form, {
					type: 'success',
					text: 'Contact Details Updated Successfully!'
				});
			});
		} catch (err) {
			return message(form, {
				type: 'error',
				text: `Updated Contact failed: ${err instanceof Error ? err.message : 'Unknown error'}`
			});
		}
	},
	addAccount: async ({ request, locals, params }) => {
		const { id } = params;
		const form = await superValidate(request, zod4(addAccount));
		console.log(form);

		if (!form.valid) {
			return message(form, { type: 'error', text: `Error: check the form` });
		}

		const { paymentMethod, accountDetail, status } = form.data;

		try {
			await db.transaction(async (tx) => {
				if (status === true) {
					await tx
						.update(staffAccounts)
						.set({ isActive: false })
						.where(eq(staffAccounts.staffId, Number(id)));
				}
				await tx.insert(staffAccounts).values({
					staffId: Number(id),
					paymentMethodId: paymentMethod,
					accountDetail,
					isActive: status,
					createdBy: locals?.user?.id
				});
			});
			return message(form, {
				type: 'success',
				text: 'Account Details Creating Successfully!'
			});
		} catch (err) {
			return message(form, {
				type: 'error',
				text: `Creating Account failed: ${err instanceof Error ? err.message : 'Unknown error'}`
			});
		}
	},
	editAccount: async ({ request, locals, params }) => {
		const form = await superValidate(request, zod4(editAccount));
		const { id: staffId } = params;
		if (!form.valid) {
			return message(form, { type: 'error', text: `Error: check the form` });
		}

		const { id, paymentMethod, accountDetail, status } = form.data;

		try {
			await db.transaction(async (tx) => {
				if (status === true) {
					await tx
						.update(staffAccounts)
						.set({ isActive: false })
						.where(eq(staffAccounts.staffId, Number(staffId)));
				}
				await tx
					.update(staffAccounts)
					.set({
						paymentMethodId: paymentMethod,
						accountDetail,
						isActive: status,
						updatedBy: locals?.user?.id
					})
					.where(eq(staffAccounts.id, id));
			});
			return message(form, {
				type: 'success',
				text: 'Account Details Updated Successfully!'
			});
		} catch (err) {
			console.error(err?.message);
			return message(form, {
				type: 'error',
				text: `Updated Account failed: ${err instanceof Error ? err.message : 'Unknown error'}`
			});
		}
	},
	editCommission: async ({ request, locals, params }) => {
		const { id } = params;
		const form = await superValidate(request, zod4(editCommission));
		if (!form.valid) {
			return message(form, { type: 'error', text: `Error: check the form` });
		}

		const { percentage, status } = form.data;

		try {
			await db.transaction(async (tx) => {});
			return message(form, {
				type: 'success',
				text: 'Commission Details Updated Successfully!'
			});
		} catch (err) {
			console.error(err?.message);
			return message(
				form,
				{
					type: 'error',
					text: `Updated Commission failed: ${err instanceof Error ? err.message : 'Unknown error'}`
				},
				{
					status: 500
				}
			);
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
		} catch (err) {
			console.error('Error deleting employee:', err);
			setFlash(
				{
					type: 'error',
					message: `Could not delete employee: ${err instanceof Error ? err.message : 'Unknown error'}`
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
