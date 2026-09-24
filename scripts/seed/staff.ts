/**
 * What an employee record actually holds once a clinic has been using the app: how to reach them,
 * where their salary is paid, their family, schooling, previous jobs, working week, guarantor —
 * and the money and leave attached to them.
 *
 * The employee detail page is twelve sections, and with an empty database every one of them was a
 * "nothing here yet" panel: the page could not be judged, and neither could payroll or leave, which
 * both read rows nobody had. This fills all of it for the 120 seeded staff.
 */
import { and, eq, isNull, sql } from 'drizzle-orm';

import {
	employee,
	employeeGuarantor,
	employeeLeaveGrant,
	educationalLevel,
	leave,
	leaveType,
	qualification,
	salaries,
	staffAccounts,
	staffContacts,
	staffFamilies,
	staffSchedule,
	workExperience
} from '../../src/lib/server/db/schema/staff';
import { paymentMethods } from '../../src/lib/server/db/schema/finance';
import { subcity } from '../../src/lib/server/db/schema/locations';
import { makeAddress } from './reference';
import { isEmpty, localDate, money, randomness, type SeedDb } from './util';

const GIVEN = [
	'Alex',
	'Sam',
	'Jordan',
	'Robin',
	'Casey',
	'Morgan',
	'Taylor',
	'Jamie',
	'Riley',
	'Quinn'
];
const FAMILY = ['Seedwell', 'Testa', 'Fixture', 'Sample', 'Demo', 'Mockley', 'Stubbs', 'Probe'];
const SCHOOLS = ['Seed University', 'Probe College', 'Fixture Institute'];
const FIELDS = ['Dental Surgery', 'Nursing', 'Business Administration', 'Laboratory Technology'];

/** Every seeded employee, with what the child rows need to point at. */
async function staffList(db: SeedDb) {
	return db
		.select({ id: employee.id, name: employee.name, fatherName: employee.fatherName })
		.from(employee)
		.where(isNull(employee.deletedAt));
}

export async function seedStaffDetails(db: SeedDb) {
	if (!(await isEmpty(db, staffContacts, 'staff_contacts'))) return;

	const staff = await staffList(db);
	if (!staff.length) {
		console.log('No employees; skipping staff details.');
		return;
	}

	const { pick, chance, between, random } = randomness(20260924);
	const [banks, levels, subcities] = await Promise.all([
		db.select({ id: paymentMethods.id }).from(paymentMethods),
		db.select({ id: educationalLevel.id }).from(educationalLevel),
		db.select({ id: subcity.id }).from(subcity)
	]);

	for (const [index, person] of staff.entries()) {
		const n = index + 1;

		/*
		 * The employee's own address and schooling, which live on the employee row rather than in a
		 * child table — the detail page shows both as panels, and both were empty.
		 */
		const ownAddress = await makeAddress(db, {
			subcityId: subcities.length ? pick(subcities).id : null,
			street: `Employee Street ${n}`,
			kebele: String(between(1, 25)),
			...(chance(0.6)
				? {
						buildingNumber: `E-${between(1, 60)}`,
						floor: between(1, 8),
						houseNumber: between(1, 60)
					}
				: {})
		});

		await db
			.update(employee)
			.set({
				address: ownAddress,
				...(levels.length ? { educationalLevel: pick(levels).id } : {})
			})
			.where(eq(employee.id, person.id));

		await db.insert(staffContacts).values([
			{
				staffId: person.id,
				contactType: 'phone',
				contactDetail: `0911${String(200000 + n).slice(-6)}`
			},
			...(chance(0.6)
				? [{ staffId: person.id, contactType: 'email', contactDetail: `staff${n}@example.test` }]
				: [])
		]);

		if (banks.length) {
			await db.insert(staffAccounts).values({
				staffId: person.id,
				paymentMethodId: pick(banks).id,
				accountDetail: `10000${String(100000 + n).slice(-6)}`
			});
		}

		// Families, and the one marked as the emergency contact the ID card prints.
		const family = between(1, 3);
		for (let i = 0; i < family; i++) {
			await db.insert(staffFamilies).values({
				staffId: person.id,
				relationship: pick(['spouse', 'son', 'daughter', 'mother', 'father', 'sister', 'brother']),
				gender: chance(0.5) ? 'female' : 'male',
				name: `${pick(GIVEN)} ${person.fatherName}`,
				phone: `0912${String(300000 + n * 10 + i).slice(-6)}`,
				emergencyContact: i === 0
			});
		}

		if (levels.length) {
			await db.insert(qualification).values({
				staffId: person.id,
				field: pick(FIELDS),
				educationLevel: pick(levels).id,
				schoolName: pick(SCHOOLS),
				graduationDate: localDate(-between(400, 4000)) as never
			});
		}

		if (chance(0.7)) {
			const started = between(1500, 4000);
			await db.insert(workExperience).values({
				staffId: person.id,
				companyName: `${pick(FAMILY)} Clinic`,
				position: pick(['Assistant', 'Nurse', 'Receptionist', 'Technician']),
				startDate: localDate(-started) as never,
				endDate: localDate(-between(200, started - 100)) as never,
				description: 'Previous employment (seed)'
			});
		}

		// Monday to Friday, with Saturday mornings for most.
		const week = [1, 2, 3, 4, 5].map((weekDay) => ({
			staffId: person.id,
			weekDay,
			startTime: '08:30:00',
			endTime: '17:00:00'
		}));
		if (chance(0.7)) {
			week.push({ staffId: person.id, weekDay: 6, startTime: '08:30:00', endTime: '12:30:00' });
		}
		await db.insert(staffSchedule).values(week);

		if (chance(0.5)) {
			const addressId = await makeAddress(db, {
				subcityId: subcities.length ? pick(subcities).id : null,
				street: `Seed Street ${n}`,
				kebele: String(between(1, 20)),
				...(chance(0.5)
					? {
							buildingNumber: `B-${between(1, 40)}`,
							floor: between(1, 6),
							houseNumber: between(1, 50)
						}
					: {})
			});

			await db.insert(employeeGuarantor).values({
				staffId: person.id,
				name: `${pick(GIVEN)} ${pick(FAMILY)}`,
				relationship: pick(['father', 'mother', 'brother', 'sister', 'spouse', 'other']),
				jobType: pick(['Teacher', 'Trader', 'Civil servant', 'Driver']),
				company: `${pick(FAMILY)} Enterprises`,
				salary: money(4000 + Math.floor(random() * 12000)),
				phone: `0913${String(400000 + n).slice(-6)}`,
				address: addressId
			});
		}
	}

	console.log(
		`Seeded contacts, accounts, families, schooling and schedules for ${staff.length} staff.`
	);
}

/**
 * One open, approved salary per employee, and a handful of pending changes waiting in the approval
 * queue. Payroll pro-rates from open rows, so without these every payroll screen totals zero.
 */
export async function seedSalaries(db: SeedDb) {
	if (!(await isEmpty(db, salaries, 'salaries'))) return;

	const staff = await staffList(db);
	if (!staff.length) return;

	const { pick, chance, between } = randomness(20260925);

	for (const [index, person] of staff.entries()) {
		const base = pick([6500, 8000, 9500, 12000, 15000, 18000, 24000]);

		await db.insert(salaries).values({
			staffId: person.id,
			amount: money(base),
			transportationAllowance: money(600),
			housingAllowance: money(chance(0.4) ? 1500 : 0),
			positionAllowance: money(chance(0.3) ? 1000 : 0),
			nonTaxAllowance: money(0),
			startDate: localDate(-between(200, 1200)) as never,
			approvalStatus: 'approved'
		} as never);

		// A few raises waiting on a checker, so the approvals queue is not empty either.
		if (index % 25 === 0) {
			await db.insert(salaries).values({
				staffId: person.id,
				amount: money(base + 2000),
				transportationAllowance: money(600),
				housingAllowance: money(0),
				positionAllowance: money(0),
				nonTaxAllowance: money(0),
				startDate: localDate(15) as never,
				changeReason: 'Annual increment (seed)',
				approvalStatus: 'pending'
			} as never);
		}
	}

	console.log(`Seeded salaries for ${staff.length} staff, with a few changes pending approval.`);
}

/**
 * A live leave grant for every employee, and leaves in all three states drawn against it.
 *
 * The ledger nets approved leave against the grant, so a grant is what makes a balance mean
 * anything — and the leave screens are three lists that were all empty.
 */
export async function seedLeave(db: SeedDb) {
	if (!(await isEmpty(db, employeeLeaveGrant, 'employee_leave_grant'))) return;

	const staff = await staffList(db);
	if (!staff.length) return;

	const types = await db
		.select({ id: leaveType.id, deducts: leaveType.deductsBalance })
		.from(leaveType);
	if (!types.length) {
		console.log('No leave types; skipping leave.');
		return;
	}

	const annual = types.find((t) => t.deducts) ?? types[0];
	const { pick, chance, between } = randomness(20260926);

	for (const person of staff) {
		const granted = pick([16, 17, 18, 20, 22]);

		await db.insert(employeeLeaveGrant).values({
			staffId: person.id,
			serviceYear: between(1, 8),
			grantDate: localDate(-between(30, 300)) as never,
			expiryDate: localDate(between(200, 700)) as never,
			daysGranted: granted,
			daysUsed: 0,
			status: 'active'
		});

		if (!chance(0.45)) continue;

		const start = between(-120, 90);
		const days = between(1, 5);
		const status = chance(0.6) ? 'approved' : chance(0.5) ? 'pending' : 'rejected';
		const type = chance(0.6) ? annual : pick(types);

		await db.insert(leave).values({
			staffId: person.id,
			leaveTypeId: type.id,
			requestDate: localDate(start - 7) as never,
			startDate: localDate(start) as never,
			endDate: localDate(start + days - 1) as never,
			days,
			status,
			reason: 'Seed leave request',
			rejectionReason: status === 'rejected' ? 'Cover could not be arranged (seed)' : null
		});

		// Approved leave has already been spent, which is what the ledger would have recorded.
		if (status === 'approved' && type.deducts) {
			await db
				.update(employeeLeaveGrant)
				.set({ daysUsed: sql`${employeeLeaveGrant.daysUsed} + ${days}` })
				.where(
					and(eq(employeeLeaveGrant.staffId, person.id), eq(employeeLeaveGrant.status, 'active'))
				);
		}
	}

	// `employee.leaves_left` is the cached figure the lists show; keep it honest.
	await db.update(employee).set({
		leavesLeft: sql`(select coalesce(sum(${employeeLeaveGrant.daysGranted} - ${employeeLeaveGrant.daysUsed}), 0)
			from ${employeeLeaveGrant}
			where ${employeeLeaveGrant.staffId} = ${employee.id} and ${employeeLeaveGrant.status} = 'active')`
	});

	console.log(`Seeded leave grants and requests for ${staff.length} staff.`);
}
