import { db } from '$lib/server/db';
import { onHand } from './stock';
import { eq, and, sql, isNull, inArray, asc } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';
import {
	city,
	region,
	subcity,
	department,
	employee,
	employmentStatuses,
	educationalLevel,
	paymentMethods as paymentMethod,
	supplies,
	supplySuppliers,
	employeeTermination,
	supplyTypes,
	serviceCategories,
	services,
	taxType,
	leaveType,
	branch,
	customers,
	overTimeType,
	position,
	allergen,
	condition,
	contactTypes,
	referralSource,
	medicine,
	providerSpecialty
} from '$lib/server/db/schema/';

export async function cities() {
	const cities = await db
		.select({
			value: city.id,
			name: city.name
		})
		.from(city)
		.where(and(eq(city.status, true), notDeleted(city)));

	return cities;
}

export async function regions() {
	const regions = await db
		.select({
			value: region.id,
			name: region.name
		})
		.from(region)
		.where(and(eq(region.status, true), notDeleted(region)));

	return regions;
}

export async function subcities() {
	const subcities = await db
		.select({
			value: subcity.id,
			name: subcity.name
		})
		.from(subcity)
		.where(and(eq(subcity.status, true), notDeleted(subcity)));

	return subcities;
}

export async function paymentMethods() {
	const paymentMethods = await db
		.select({
			value: paymentMethod.id,
			name: paymentMethod.name
		})
		.from(paymentMethod)
		.where(and(eq(paymentMethod.isActive, true), notDeleted(paymentMethod)));

	return paymentMethods;
}

export async function leaveTypes() {
	const leaveTypes = await db
		.select({
			value: leaveType.id,
			name: leaveType.name,
			maxDays: leaveType.maxDays,
			description: leaveType.description
		})
		.from(leaveType)
		.where(and(eq(leaveType.status, true), notDeleted(leaveType)));

	return leaveTypes;
}

export async function suppliers() {
	const suppliers = await db
		.select({
			value: supplySuppliers.id,
			name: supplySuppliers.name
		})
		.from(supplySuppliers)
		.where(and(eq(supplySuppliers.status, true), notDeleted(supplySuppliers)));

	return suppliers;
}
/**
 * Supplies a lease can draw on, with the numbers the form needs to stop a user
 * asking for more than exists. `quantity` is what is in the store; the reserved
 * figure that must be subtracted from it is derived per-supply in
 * `supplyStock.ts`, which the lease pages layer on top of this list.
 */
export async function supplyItems() {
	const items = await db
		.select({
			value: supplies.id,
			name: supplies.name,
			quantity: onHand(),
			unitOfMeasure: supplies.unitOfMeasure,
			returnable: supplies.returnable
		})
		.from(supplies)
		.where(and(eq(supplies.isActive, true), notDeleted(supplies)));

	return items;
}

export async function employees() {
	const employees = await db
		.select({
			value: employee.id,
			name: sql<string>`CONCAT(${employee.name}, ' ', ${employee.fatherName})`
		})
		.from(employee)
		.leftJoin(
			employmentStatuses,
			and(eq(employmentStatuses.id, employee.employmentStatus), notDeleted(employmentStatuses))
		)
		.leftJoin(employeeTermination, eq(employeeTermination.staffId, employee.id))
		.where(
			and(
				eq(employee.isActive, true),
				eq(employmentStatuses.removeFromLists, false),
				isNull(employeeTermination.staffId),
				notDeleted(employee)
			)
		);

	return employees;
}

export async function officeEmployees() {
	const employees = await db
		.select({
			value: employee.id,
			name: sql<string>`CONCAT(${employee.name}, ' ', ${employee.fatherName})`,
			signiture: employee.signiture
		})
		.from(employee)
		.leftJoin(
			employmentStatuses,
			and(eq(employmentStatuses.id, employee.employmentStatus), notDeleted(employmentStatuses))
		)
		.leftJoin(employeeTermination, eq(employeeTermination.staffId, employee.id))
		.where(
			and(
				eq(employee.isActive, true),
				eq(employmentStatuses.removeFromLists, false),
				isNull(employeeTermination.staffId),
				/*
				 * A correlated subquery rather than a list read at module load.
				 *
				 * This used to be a top-level `await` on the module: every cold start blocked on
				 * it, the build imported this file and so needed a reachable database, and — the
				 * part that actually bit — the answer was computed once per process, so an admin
				 * turning commission on for a department saw nothing change until a restart.
				 */
				inArray(
					employee.departmentId,
					db
						.select({ id: department.id })
						.from(department)
						.where(and(eq(department.commission, true), notDeleted(department)))
				),
				notDeleted(employee)
			)
		);

	return employees;
}

export async function supplyCategories() {
	const supplyCategories = await db
		.select({
			value: supplyTypes.id,
			name: supplyTypes.name
		})
		.from(supplyTypes)
		.where(notDeleted(supplyTypes));

	return supplyCategories;
}

export async function serviceCategory() {
	const categories = await db
		.select({
			value: serviceCategories.id,
			name: serviceCategories.name
		})
		.from(serviceCategories)
		.where(notDeleted(serviceCategories));

	return categories;
}

export async function service() {
	const service = await db
		.select({
			value: services.id,
			name: services.name
		})
		.from(services)
		.where(notDeleted(services));

	return service;
}

export async function departments() {
	const departments = await db
		.select({
			value: department.id,
			name: department.name,
			commission: department.commission
		})
		.from(department)
		.where(notDeleted(department));

	return departments;
}

export async function positions() {
	const positions = await db
		.select({
			value: position.id,
			name: position.name,
			departmentId: position.departmentId
		})
		.from(position)
		.where(notDeleted(position));

	return positions;
}

export async function empStatus() {
	const empStatus = await db
		.select({
			value: employmentStatuses.id,
			name: employmentStatuses.name
		})
		.from(employmentStatuses)
		.where(notDeleted(employmentStatuses));

	return empStatus;
}

export async function eduLevel() {
	const eduLevel = await db
		.select({
			value: educationalLevel.id,
			name: educationalLevel.name
		})
		.from(educationalLevel)
		.where(notDeleted(educationalLevel));

	return eduLevel;
}

export async function taxTypes() {
	const taxTypes = await db
		.select({
			value: taxType.id,
			name: taxType.name,
			rate: taxType.rate,
			threshold: taxType.threshold,
			deduction: taxType.deduction
		})
		.from(taxType)
		.where(and(eq(taxType.status, true), notDeleted(taxType)));
	return taxTypes;
}

export async function overtimeTypes() {
	const overtimeTypes = await db
		.select({
			value: overTimeType.id,
			name: overTimeType.name,
			rate: overTimeType.rate,
			maxhours: overTimeType.maxhours
		})
		.from(overTimeType)
		.where(eq(overTimeType.isActive, true));
	return overtimeTypes;
}

/** Clinic locations, for the branch picker. Single-branch clinics get exactly one row. */
export async function branches() {
	return await db
		.select({
			value: branch.id,
			name: branch.name
		})
		.from(branch)
		.where(notDeleted(branch));
}

export async function customerList() {
	const customerList = await db
		.select({
			value: customers.id,
			name: customers.name
		})
		.from(customers)
		.where(notDeleted(customers));

	return customerList;
}

/*
 * The patient chart's pickers.
 *
 * Each is a clinic-wide lookup (CLAUDE.md §15 — reference data is never branch scoped), ordered by
 * the `sortOrder` the admin panel sets and then by name, so the choices a clinic uses most can be
 * put first. Inactive rows drop out of the picker; rows already recorded against a patient keep
 * showing their name, because the chart resolves names from the row, not from this list.
 */

/** Allergens, e.g. penicillin, latex, lidocaine. */
export async function allergens() {
	return db
		.select({ value: allergen.id, name: allergen.name })
		.from(allergen)
		.where(and(eq(allergen.isActive, true), notDeleted(allergen)))
		.orderBy(asc(allergen.sortOrder), asc(allergen.name));
}

/** Diagnosable conditions, dental-related first. */
export async function conditions() {
	return db
		.select({ value: condition.id, name: condition.name })
		.from(condition)
		.where(and(eq(condition.isActive, true), notDeleted(condition)))
		.orderBy(sql`${condition.isDentalRelated} desc`, asc(condition.sortOrder), asc(condition.name));
}

/** Ways to reach someone — phone, email, Telegram. */
export async function contactTypeList() {
	return db
		.select({ value: contactTypes.id, name: contactTypes.name })
		.from(contactTypes)
		.where(and(eq(contactTypes.isActive, true), notDeleted(contactTypes)))
		.orderBy(asc(contactTypes.sortOrder), asc(contactTypes.name));
}

/** How patients hear of the clinic. */
export async function referralSources() {
	return db
		.select({ value: referralSource.id, name: referralSource.name })
		.from(referralSource)
		.where(and(eq(referralSource.isActive, true), notDeleted(referralSource)))
		.orderBy(asc(referralSource.sortOrder), asc(referralSource.name));
}

/**
 * Every medicine, prescribable or not — a patient arrives already taking things this clinic would
 * never prescribe, and `patient_medications` must be able to record them. The brand and strength
 * are in the label because "Warfarin" alone does not say which tablet.
 */
export async function medicines() {
	const rows = await db
		.select({
			value: medicine.id,
			generic: medicine.genericName,
			brand: medicine.brandName,
			strength: medicine.strength
		})
		.from(medicine)
		.where(and(eq(medicine.isActive, true), notDeleted(medicine)))
		.orderBy(asc(medicine.sortOrder), asc(medicine.genericName));

	return rows.map((m) => ({
		value: m.value,
		name: [m.generic, m.strength, m.brand && `(${m.brand})`].filter(Boolean).join(' ')
	}));
}

/** Clinician specialties, for the provider picker. */
export async function specialties() {
	return db
		.select({ value: providerSpecialty.id, name: providerSpecialty.name })
		.from(providerSpecialty)
		.where(and(eq(providerSpecialty.isActive, true), notDeleted(providerSpecialty)))
		.orderBy(asc(providerSpecialty.sortOrder), asc(providerSpecialty.name));
}
