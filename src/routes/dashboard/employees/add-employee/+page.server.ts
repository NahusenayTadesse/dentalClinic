import { superValidate, message, setError } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { fail } from '@sveltejs/kit';

import { add } from './schema';
import { db } from '$lib/server/db';
import { salaries, employee, staffContacts, address } from '$lib/server/db/schema/';
import { asRequested } from '$lib/server/approvals';
import type { Actions } from './$types';
import {
	departments,
	empStatus,
	eduLevel,
	branches,
	subcities,
	positions
} from '$lib/server/fastData';
import type { PageServerLoad } from './$types.js';
import { and, eq } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';

export const load: PageServerLoad = async () => {
	const form = await superValidate(zod4(add));

	const departmentList = await departments();
	const positionList = await positions();
	const empStatusList = await empStatus();
	const eduLevelList = await eduLevel();
	const branchList = await branches();
	const subcityList = await subcities();

	return {
		form,
		departmentList,
		positionList,
		empStatusList,
		eduLevelList,
		branchList,
		subcityList
	};
};

import { saveUploadedFile } from '$lib/server/upload';
import { formatEthiopianYear } from '$lib/global.svelte';
import { redirect } from 'sveltekit-flash-message/server';

export const actions: Actions = {
	add: async ({ request, locals, cookies }) => {
		const form = await superValidate(request, zod4(add));

		console.log(form);

		if (!form.valid) {
			return fail(400, { form });
		}

		const {
			name,
			fatherName,
			grandFatherName,
			email,
			birthDate,
			tinNo,
			gender,
			nationality,
			phone,
			bloodType,
			department,
			educationalLevel,
			salary,
			positionAllowance,
			transportAllowance,
			housingAllowance,
			nonTaxAllowance,
			hireDate,
			govtId,
			branch,
			photo,
			martialStatus,
			employmentStatus,
			newEmployeeVerified,
			street,
			subcity,
			kebele,
			buildingNumber,
			floor,
			houseNumber,
			existingPensionCard,
			officeCommission,
			otherSubcity,
			percentage,
			position,
			signature,
			pensionCard
		} = form.data;

		// 1. Duplicate Check
		if (!newEmployeeVerified) {
			const sanitizedName = name?.replace(/\s+/g, ' ').trim();
			const sanitizedFatherName = fatherName?.replace(/\s+/g, ' ').trim();
			const sanitizedGrandFatherName = grandFatherName?.replace(/\s+/g, ' ').trim();

			const existingEmployee = await db
				.select({ id: employee.id })
				.from(employee)
				.where(
					and(
						eq(employee.name, sanitizedName),
						eq(employee.fatherName, sanitizedFatherName),
						eq(employee.grandFatherName, sanitizedGrandFatherName),
						notDeleted(employee)
					)
				)
				.limit(1);

			if (existingEmployee.length > 0) {
				setError(form, 'name', 'Employee with this Name already exists');
				return message(form, {
					type: 'error',
					text: 'Employee with this name already exists',
					existingId: existingEmployee[0].id
				});
			}
		}

		// 2. Upload Files

		// 3. Database Transaction
		const finalIdNo = await db.transaction(async (tx) => {
			const photoName = await saveUploadedFile(photo);
			const govIdFile = await saveUploadedFile(govtId);
			// Insert main employee record
			const [staffMember] = await tx
				.insert(employee)
				.values({
					...asRequested(locals.user?.id),
					name,
					fatherName,
					grandFatherName,
					tinNo,
					gender,
					nationality,
					birthDate: new Date(birthDate).toLocaleDateString('en-CA'),
					departmentId: department,
					positionId: position,
					photo: photoName,
					govtId: govIdFile,
					employmentStatus,
					martialStatus,
					educationalLevel,
					bloodType,
					existingPensionCard,
					branchId: branch,
					hireDate: new Date(hireDate).toLocaleDateString('en-CA'),
					createdBy: locals.user?.id,
					// Balance is derived from `employee_leave_grant`, and a new hire has earned nothing
					// until their first anniversary. Seeding days here would show leave they cannot
					// take, and the first accrual run would silently wipe it back to the ledger figure.
					leavesLeft: 0,
					isActive: true
				})
				.$returningId();

			// Generate idNo: SP + ID + Last 2 digits of hire year
			const yearSuffix = formatEthiopianYear(new Date(hireDate)).slice(-2);
			const generatedIdNo = `SP${staffMember.id}${yearSuffix}`;

			const [addressId] = await tx
				.insert(address)
				.values({
					street,
					subcityId: subcity,
					kebele,
					buildingNumber,
					otherSubcity,
					floor,
					houseNumber,
					status: true
				})
				.$returningId();

			// Update the employee with the new idNo
			await tx
				.update(employee)
				.set({ idNo: generatedIdNo, address: addressId.id })
				.where(eq(employee.id, staffMember.id));

			if (signature) {
				const signatureName = await saveUploadedFile(signature);
				await tx
					.update(employee)
					.set({ signiture: signatureName })
					.where(eq(employee.id, staffMember.id));
			}
			if (pensionCard) {
				const pensionCardName = await saveUploadedFile(pensionCard);
				await tx
					.update(employee)
					.set({ pensionCard: pensionCardName })
					.where(eq(employee.id, staffMember.id));
			}

			// Insert salary
			await tx.insert(salaries).values({
				...asRequested(locals.user?.id),
				amount: salary,
				positionAllowance,
				transportAllowance,
				housingAllowance,
				nonTaxAllowance,
				staffId: staffMember.id,
				createdBy: locals.user?.id
			});

			await tx.insert(staffContacts).values({
				contactType: 'Phone',
				contactDetail: phone,
				staffId: staffMember.id,
				createdBy: locals.user?.id
			});

			await tx.insert(staffContacts).values({
				contactType: 'Email',
				contactDetail: email,
				staffId: staffMember.id,
				createdBy: locals.user?.id
			});

			delete form.data.govtId;
			delete form.data.photo;

			return staffMember.id;
		});

		// Clean up form data for response
		//
		if (!finalIdNo)
			return message(form, {
				type: 'error',
				text: `Unexpected Error, please try again later`
			});

		redirect(
			`/dashboard/employees/single/${finalIdNo}`,
			{ type: 'success', message: 'Employee Successfully Added!' },
			cookies
		);
	}
};
