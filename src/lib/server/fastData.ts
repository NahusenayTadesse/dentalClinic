import { db } from '$lib/server/db';
import { eq, and, sql, isNull, inArray } from 'drizzle-orm';
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
	site,
	customers,
	overTimeType,
	bankAmount,
	position
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

export async function banks() {
	const paymentMethods = await db
		.select({
			value: bankAmount.id,
			name: paymentMethod.name,
			paymentMethodId: paymentMethod.id,
			// Carried so forms can warn before the server has to.
			balance: bankAmount.amount
		})
		.from(bankAmount)
		.leftJoin(paymentMethod, eq(paymentMethod.id, bankAmount.paymentMethodId))
		.where(notDeleted(bankAmount));

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
			quantity: supplies.quantity,
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

export const officeDepartmentIds = await db
	.select({ id: department.id })
	.from(department)
	.where(and(eq(department.commission, true), notDeleted(department)));

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
				inArray(
					employee.departmentId,
					officeDepartmentIds.map((id) => id.id)
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

export async function sites() {
	const sites = await db
		.select({
			value: site.id,
			name: site.name
		})
		.from(site)
		.where(and(eq(site.isActive, true), notDeleted(site)));

	return sites;
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
