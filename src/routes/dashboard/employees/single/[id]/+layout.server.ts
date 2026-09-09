import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { editStaff as schema } from '$lib/zodschemas/appointmentSchema';

import { db } from '$lib/server/db';
import { earnedToDate } from '$lib/server/leaveAccrual';
import {
	employmentStatuses,
	employee,
	user,
	department,
	site,
	address,
	subcity,
	educationalLevel,
	staffFamilies,
	qualification,
	workExperience,
	employeeGuarantor as eg,
	staffSchedule,
	staffContacts,
	staffAccounts,
	paymentMethods,
	position
} from '$lib/server/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';
import { alias } from 'drizzle-orm/mysql-core';
import type { LayoutServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: LayoutServerLoad = async ({ params }) => {
	const { id } = params;

	const form = await superValidate(zod4(schema));

	// The approval trail names three different actors, so each needs its own join onto `user`.
	const staffUpdater = alias(user, 'staff_updater');
	const requester = alias(user, 'requester');
	const approver = alias(user, 'approver');
	const rejecter = alias(user, 'rejecter');

	const staffMember = await db
		.select({
			id: employee.id,
			idNo: employee.idNo,
			firstName: employee.name,
			fatherName: employee.fatherName,
			grandFatherName: employee.grandFatherName,
			gender: employee.gender,
			site: site.name,
			siteId: site.id,
			nationality: employee.nationality,
			bloodType: employee.bloodType,
			tinNo: employee.tinNo,
			department: department.name,
			departmentId: department.id,
			position: position.name,
			positionId: position.id,
			status: employmentStatuses.name,
			statusId: employmentStatuses.id,
			address: employee.address,
			birthDate: employee.birthDate,
			age: sql<number>`TIMESTAMPDIFF(YEAR, ${employee.birthDate}, CURDATE())`,
			educationalLevel: educationalLevel.name,
			educationalLevelId: educationalLevel.id,
			maritalStatus: employee.martialStatus,
			hireDate: sql<string>`DATE_FORMAT(${employee.hireDate}, '%Y-%m-%d')`,
			photo: employee.photo,
			govId: employee.govtId,
			isActive: employee.isActive,
			addedBy: user.name,
			updatedBy: staffUpdater.name,
			leavesLeft: employee.leavesLeft,
			pension: employee.existingPensionCard,
			signiture: employee.signiture,
			pensionCard: employee.pensionCard,
			terminationDate: employee.terminationDate,
			approvalStatus: employee.approvalStatus,
			requestedBy: requester.name,
			approvedBy: approver.name,
			approvedAt: employee.approvedAt,
			rejectedBy: rejecter.name,
			rejectedAt: employee.rejectedAt,
			rejectionReason: employee.rejectionReason,
			years: sql<number>`TIMESTAMPDIFF(YEAR, ${employee.hireDate}, CURDATE())`
		})
		.from(employee)
		.leftJoin(department, and(eq(employee.departmentId, department.id), notDeleted(department)))
		.leftJoin(position, and(eq(employee.positionId, position.id), notDeleted(position)))
		.leftJoin(site, and(eq(employee.siteId, site.id), notDeleted(site)))
		.leftJoin(
			employmentStatuses,
			and(eq(employee.employmentStatus, employmentStatuses.id), notDeleted(employmentStatuses))
		)
		.leftJoin(
			educationalLevel,
			and(eq(employee.educationalLevel, educationalLevel.id), notDeleted(educationalLevel))
		)
		.leftJoin(user, eq(employee.createdBy, user.id))
		.leftJoin(staffUpdater, eq(employee.updatedBy, staffUpdater.id))
		.leftJoin(requester, eq(employee.requestedBy, requester.id))
		.leftJoin(approver, eq(employee.approvedBy, approver.id))
		.leftJoin(rejecter, eq(employee.rejectedBy, rejecter.id))
		.where(and(eq(employee.id, Number(id)), notDeleted(employee)))
		.then((rows) => rows[0]);
	if (!staffMember) {
		throw error(404, 'Staff member not found');
	}

	const employeeAddress = await db
		.select({
			id: address.id,
			street: address.street,
			otherSubcity: address.otherSubcity,
			subcity: subcity.name,
			subcityId: subcity.id,
			kebele: address.kebele,
			buildingNumber: address.buildingNumber,
			floor: address.floor,
			houseNumber: address.houseNumber,
			status: address.status
		})
		.from(address)
		.leftJoin(subcity, and(eq(address.subcityId, subcity.id), notDeleted(subcity)))
		.where(eq(address.id, Number(staffMember.address)))
		.then((rows) => rows[0]);

	const employeeFamily = await db
		.select({
			id: staffFamilies.id,
			name: staffFamilies.name,
			gender: staffFamilies.gender,
			phone: staffFamilies.phone,
			email: staffFamilies.email,
			relationShip: staffFamilies.relationship, // Note: watch for casing (relationShip vs relationship)
			otherRelationShip: staffFamilies.otherRelationship,
			emergencyContact: staffFamilies.emergencyContact,
			status: staffFamilies.isActive,
			addedBy: user.name,
			addedById: user.id
		})
		.from(staffFamilies)
		.leftJoin(user, eq(staffFamilies.createdBy, user.id))
		.where(and(eq(staffFamilies.staffId, Number(id)), notDeleted(staffFamilies)))
		.orderBy(desc(staffFamilies.emergencyContact));

	const employeeQualification = await db
		.select({
			id: qualification.id,
			field: qualification.field,
			educationalLevel: educationalLevel.name,
			educationalLevelId: educationalLevel.id,
			schoolName: qualification.schoolName,
			graduationDate: qualification.graduationDate,
			certificate: qualification.certificate,
			addedBy: user.name,
			addedById: user.id
		})
		.from(qualification)
		.leftJoin(user, eq(qualification.createdBy, user.id))
		.leftJoin(
			educationalLevel,
			and(eq(qualification.educationLevel, educationalLevel.id), notDeleted(educationalLevel))
		)
		.where(and(eq(qualification.staffId, Number(id)), notDeleted(qualification)));

	const employeeWorkExperience = await db
		.select({
			id: workExperience.id,
			companyName: workExperience.companyName,
			position: workExperience.position,
			startDate: workExperience.startDate,
			endDate: workExperience.endDate,
			certificate: workExperience.certificate,
			description: workExperience.description,
			addedBy: user.name,
			addedById: user.id
		})
		.from(workExperience)
		.leftJoin(user, eq(workExperience.createdBy, user.id))
		.where(and(eq(workExperience.staffId, Number(id)), notDeleted(workExperience)))
		.orderBy(desc(workExperience.endDate));

	const employeeGarantor = await db
		.select({
			id: eg.id,
			name: eg.name,
			relationShip: eg.relationship,
			relation: eg.relation,
			jobType: eg.jobType,
			company: eg.company,
			salary: eg.salary,
			document: eg.gurantorDocument,
			phone: eg.phone,
			email: eg.email,
			govtId: eg.govtId,
			photo: eg.photo,
			address: {
				id: address.id,
				street: address.street,
				subcity: subcity.name,
				otherSubcity: address.otherSubcity,
				subcityId: subcity.id,
				kebele: address.kebele,
				buildingNumber: address.buildingNumber,
				floor: address.floor,
				houseNumber: address.houseNumber,
				status: address.status
			},
			status: address.status,
			addedBy: user.name
		})
		.from(eg)
		.leftJoin(address, and(eq(address.id, eg.address), notDeleted(address)))
		.leftJoin(subcity, and(eq(subcity.id, address.subcityId), notDeleted(subcity)))
		.leftJoin(user, eq(user.id, eg.createdBy))
		.where(and(eq(eg.staffId, Number(id)), notDeleted(eg)))
		.then((rows) => rows[0]);

	const schedule = await db
		.select({
			id: staffSchedule.id,
			day: staffSchedule.weekDay,
			startTime: staffSchedule.startTime,
			endTime: staffSchedule.endTime,
			status: staffSchedule.isActive,
			addedBy: user.name,
			addedById: user.id
		})
		.from(staffSchedule)
		.leftJoin(user, eq(staffSchedule.createdBy, user.id))
		.where(and(eq(staffSchedule.staffId, Number(id)), notDeleted(staffSchedule)));

	const contacts = await db
		.select({
			id: staffContacts.id,
			contactType: staffContacts.contactType,
			contactDetail: staffContacts.contactDetail,
			status: staffContacts.isActive,
			addedBy: user.name,
			addedById: user.id
		})
		.from(staffContacts)
		.leftJoin(user, eq(staffContacts.createdBy, user.id))
		.where(and(eq(staffContacts.staffId, Number(id)), notDeleted(staffContacts)));

	const accounts = await db
		.select({
			id: staffAccounts.id,
			paymentMethod: paymentMethods.name,
			accountDetail: staffAccounts.accountDetail,
			paymentMethodId: staffAccounts.paymentMethodId,
			status: staffAccounts.isActive,
			addedBy: user.name,
			addedById: user.id
		})
		.from(staffAccounts)
		.leftJoin(user, eq(staffAccounts.createdBy, user.id))
		.leftJoin(paymentMethods, eq(staffAccounts.paymentMethodId, paymentMethods.id))
		.where(and(eq(staffAccounts.staffId, Number(id)), notDeleted(staffAccounts)))
		.orderBy(desc(staffAccounts.isActive));

	// Pro-rata view of the year in progress; grants themselves still land whole on the anniversary.
	const leaveProgress = await earnedToDate(Number(id));

	return {
		staffMember,
		leaveProgress,
		address: employeeAddress,
		family: employeeFamily,
		qualifications: employeeQualification,
		experience: employeeWorkExperience,
		guarantor: employeeGarantor,
		contacts,
		schedule,
		accounts,
		form
	};
};
