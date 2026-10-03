/**
 * Writing a new employee — the employee row, their address, opening salary and ways to reach them —
 * in the caller's transaction.
 *
 * Shared by the add form and the spreadsheet import. It came out of the add form's action, which
 * could not save a single employee against a strict-mode database, three ways at once:
 *
 *   - the opening salary had no `start_date`, a NOT NULL column with no default;
 *   - an employee with no email still got an "Email" contact row with no detail, also NOT NULL;
 *   - the transport allowance went in under `transportAllowance`, a key `salaries` does not have,
 *     so Drizzle dropped it and every new hire's transport allowance was zero.
 *
 * Both callers file the employee pending, as the maker's request, for Approvals → Employees; the
 * salary waits beside it in Approvals → Salary Changes. An import is not a way round either queue.
 *
 * Non-goals: the duplicate question and the audit row, which differ between one form and a file of
 * fifty (see `patientWrites.ts` for the same split); and stored files, which the caller saves and
 * hands in by name. The import has none to give — see the schema note on `employee.photo`.
 */
import { eq } from 'drizzle-orm';
import { insertReturningId } from '@nahu/admin-kit/server/db/insert.js';
import type { db } from '$lib/server/db';
import { address, employee, salaries, staffContacts } from '$lib/server/db/schema';
import { asRequested } from '$lib/server/approvals';
import { formatEthiopianYear } from '$lib/global.svelte';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * A validated employee — the add form's schema less its files, spelled out because a `$lib` module
 * does not import from a route. The form's own type is assignable to it.
 */
export type NewEmployee = {
	name: string;
	fatherName: string;
	grandFatherName: string;
	gender: 'male' | 'female';
	nationality: string;
	/** A calendar day, `YYYY-MM-DD`. */
	birthDate: string;
	/** A calendar day, `YYYY-MM-DD`. Also the day the opening salary starts. */
	hireDate: string;
	tinNo?: string;
	bloodType?: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | null;
	department: number;
	position: number;
	employmentStatus: number;
	educationalLevel?: number | null;
	martialStatus: 'single' | 'married' | 'widowed' | 'divorced' | 'other';
	existingPensionCard: boolean;
	phone: string;
	email?: string;
	salary: number;
	positionAllowance: number;
	transportAllowance: number;
	housingAllowance: number;
	nonTaxAllowance: number;
	subcity?: number;
	otherSubcity?: string;
	street?: string;
	kebele?: string;
	buildingNumber?: string;
	floor?: number;
	houseNumber?: string;
};

/** Stored file names, as `saveUploadedFile` returned them; null for a file not given. */
export type EmployeeFiles = {
	photo: string | null;
	govtId: string | null;
	signature: string | null;
	pensionCard: string | null;
};

/** Who is adding the employee, and the branch they are filed at — never read off the form (§15). */
export type EmployeeStamp = { userId: string | undefined; branchId: number };

/**
 * A date input's value as the day it names. The kit's inputs already post `YYYY-MM-DD`; anything
 * else is read as a date and written out in the server's zone, as this form always did.
 */
function calendarDay(value: string): string {
	return /^\d{4}-\d{2}-\d{2}/.test(value)
		? value.slice(0, 10)
		: new Date(value).toLocaleDateString('en-CA');
}

/** The money columns of `salaries` are `decimal` without `mode: 'number'`, so they take strings. */
const amount = (value: number) => value.toFixed(2);

/**
 * Inserts one employee with their address, opening salary and contacts, and gives them their
 * staff number. Returns the employee's id.
 */
export async function addEmployee(
	tx: Tx,
	data: NewEmployee,
	files: EmployeeFiles,
	stamp: EmployeeStamp
): Promise<number> {
	const hireDate = calendarDay(data.hireDate);

	const addressId = await insertReturningId(tx, address, {
		street: data.street,
		subcityId: data.subcity,
		kebele: data.kebele,
		buildingNumber: data.buildingNumber,
		otherSubcity: data.otherSubcity,
		floor: data.floor,
		houseNumber: data.houseNumber ? Number(data.houseNumber) || 0 : undefined,
		status: true
	});

	const id = await insertReturningId(tx, employee, {
		...asRequested(stamp.userId),
		name: data.name,
		fatherName: data.fatherName,
		grandFatherName: data.grandFatherName,
		tinNo: data.tinNo,
		gender: data.gender,
		nationality: data.nationality,
		birthDate: calendarDay(data.birthDate),
		hireDate,
		departmentId: data.department,
		positionId: data.position,
		employmentStatus: data.employmentStatus,
		educationalLevel: data.educationalLevel,
		martialStatus: data.martialStatus,
		bloodType: data.bloodType,
		existingPensionCard: data.existingPensionCard,
		photo: files.photo,
		govtId: files.govtId,
		signiture: files.signature,
		pensionCard: files.pensionCard,
		address: addressId,
		branchId: stamp.branchId,
		createdBy: stamp.userId,
		// Balance is derived from `employee_leave_grant`, and a new hire has earned nothing until
		// their first anniversary. Seeding days here would show leave they cannot take, and the
		// first accrual run would silently wipe it back to the ledger figure.
		leavesLeft: 0,
		isActive: true
	});

	// The staff number: SP, the id, and the last two digits of the Ethiopian year they were hired.
	const yearSuffix = formatEthiopianYear(new Date(`${hireDate}T12:00:00Z`)).slice(-2);
	await tx
		.update(employee)
		.set({ idNo: `SP${id}${yearSuffix}` })
		.where(eq(employee.id, id));

	await tx.insert(salaries).values({
		...asRequested(stamp.userId),
		staffId: id,
		amount: amount(data.salary),
		positionAllowance: amount(data.positionAllowance),
		transportationAllowance: amount(data.transportAllowance),
		housingAllowance: amount(data.housingAllowance),
		nonTaxAllowance: amount(data.nonTaxAllowance),
		startDate: hireDate,
		branchId: stamp.branchId,
		createdBy: stamp.userId
	});

	const email = data.email?.trim();
	await tx
		.insert(staffContacts)
		.values([
			{ staffId: id, contactType: 'Phone', contactDetail: data.phone, createdBy: stamp.userId },
			...(email
				? [{ staffId: id, contactType: 'Email', contactDetail: email, createdBy: stamp.userId }]
				: [])
		]);

	return id;
}

/**
 * A name as it is stored and compared: runs of spaces closed up, ends trimmed. The add form and the
 * import both ask "is someone with these three names already here?" of names tidied this way.
 */
export function tidyName(name: string): string {
	return name.replace(/\s+/g, ' ').trim();
}
