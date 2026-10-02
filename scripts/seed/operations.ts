/**
 * The month-to-month rows a working clinic accumulates: what payroll adds and takes off, what the
 * clinic spends, the laboratory work sent out, damaged stock, and staff who have left.
 *
 * These are the inputs the salary and finance screens read. A payroll run with no bonuses,
 * deductions, overtime or absences produces the same number for everybody, which is the one case
 * that never catches a mistake.
 *
 * Non-goal: payroll runs themselves. A run is the app's own calculation, and seeding fake results
 * would put figures on screen that nothing produced — run payroll in the app instead.
 */
import { and, eq, inArray, isNull } from 'drizzle-orm';

import {
	bonuses,
	deductions,
	employee,
	employeeTermination,
	missingDays,
	overTime,
	overTimeType
} from '../../src/lib/server/db/schema/staff';
import { expenses, expensesType, transactions } from '../../src/lib/server/db/schema/finance';
import { customers, customerContacts } from '../../src/lib/server/db/schema/customers';
import { dentalLab, labCase } from '../../src/lib/server/db/schema/labCases';
import { procedures } from '../../src/lib/server/db/schema/procedures';
import { damagedSupplies, supplies } from '../../src/lib/server/db/schema/inventory';
import {
	appointment,
	appointmentType,
	appointmentTypeServices
} from '../../src/lib/server/db/schema/scheduling';
import { patientFile } from '../../src/lib/server/db/schema/patientFiles';
import { services } from '../../src/lib/server/db/schema/services';
import { isEmpty, localDate, money, randomness, type SeedDb } from './util';

export async function seedPayrollInputs(db: SeedDb) {
	if (!(await isEmpty(db, bonuses, 'bonuses'))) return;

	const staff = await db
		.select({ id: employee.id })
		.from(employee)
		.where(isNull(employee.deletedAt));
	if (!staff.length) return;

	const { pick, chance, between } = randomness(20260929);

	const types = await db.select({ id: overTimeType.id }).from(overTimeType);

	for (const person of staff) {
		if (chance(0.25)) {
			await db.insert(bonuses).values({
				staffId: person.id,
				description: pick(['Performance bonus', 'Holiday bonus', 'Referral bonus']),
				amount: money(between(300, 2500)),
				bonusDate: localDate(-between(1, 90)) as never
			});
		}

		if (chance(0.15)) {
			await db.insert(deductions).values({
				staffId: person.id,
				type: pick(['Penalty', 'Advance repayment', 'Damage']),
				reason: 'Seed deduction',
				amount: money(between(50, 600)),
				deductionDate: localDate(-between(1, 90)) as never
			});
		}

		if (types.length && chance(0.3)) {
			const hours = between(2, 12);
			const rate = between(40, 90);
			await db.insert(overTime).values({
				staffId: person.id,
				reason: 'Evening clinic (seed)',
				amountPerHour: money(rate),
				overTimeTypeId: pick(types).id,
				hours,
				total: money(hours * rate),
				date: localDate(-between(1, 60)) as never
			});
		}

		if (chance(0.2)) {
			await db.insert(missingDays).values({
				staffId: person.id,
				day: localDate(-between(1, 60)) as never,
				reason: pick(['Unreported absence', 'Left early', 'Late without notice']),
				deductable: chance(0.6),
				deductableAmount: money(between(50, 300)),
				approval: pick(['pending', 'approved'])
			});
		}
	}

	console.log('Seeded bonuses, deductions, overtime, absences and penalty types.');
}

/** What the clinic spends, each expense paired with the transaction that paid it. */
export async function seedExpenses(db: SeedDb) {
	if (!(await isEmpty(db, expenses, 'expenses'))) return;

	const types = await db
		.select({ id: expensesType.id, name: expensesType.name })
		.from(expensesType);
	if (!types.length) return;

	const { pick, between } = randomness(20260930);

	for (let i = 0; i < 40; i++) {
		const type = pick(types);
		const total = between(500, 25000);
		const on = localDate(-between(1, 180));

		const [txn] = await db
			.insert(transactions)
			.values({
				description: `${type.name} (seed)`,
				amount: money(total),
				direction: 'out',
				paymentStatus: 'paid',
				occurredOn: on as never,
				approvalStatus: 'approved'
			} as never)
			.$returningId();

		await db.insert(expenses).values({
			expenseDate: on as never,
			type: type.id,
			description: `${type.name} for the month (seed)`,
			total: money(total),
			transactionId: txn.id,
			payeeName: 'Probe Vendor',
			approvalStatus: pick(['approved', 'approved', 'pending'])
		} as never);
	}

	console.log('Seeded 40 expenses with their transactions.');
}

/** Laboratories, and the cases sent to them. */
export async function seedLabWork(db: SeedDb) {
	if (!(await isEmpty(db, dentalLab, 'dental_lab'))) return;

	await db.insert(dentalLab).values([
		{
			name: 'Probe Dental Laboratory',
			phone: '0114002001',
			contactPerson: 'Lab Manager',
			typicalTurnaroundDays: 7
		},
		{
			name: 'Seedwell Crown & Bridge',
			phone: '0114002002',
			contactPerson: 'Technician',
			typicalTurnaroundDays: 10
		},
		{ name: 'Fixture Orthodontic Lab', phone: '0114002003', typicalTurnaroundDays: 14 }
	]);

	console.log('Seeded dental laboratories.');
}

/**
 * Lab cases for the crowns, bridges and dentures already charted, spread across the life of a case
 * — a docket being prepared, work at the lab (some of it overdue), work back to fit, fitted, and a
 * remake — so the lab board, the chart's Lab work tab and the lab turnaround report each have
 * something in every state to show.
 */
export async function seedLabCases(db: SeedDb) {
	if (!(await isEmpty(db, labCase, 'lab_case'))) return;

	const labs = await db
		.select({ id: dentalLab.id, turnaround: dentalLab.typicalTurnaroundDays })
		.from(dentalLab)
		.where(isNull(dentalLab.deletedAt));
	const work = await db
		.select({
			id: procedures.id,
			patientId: procedures.patientId,
			serviceId: procedures.serviceId,
			service: services.name,
			providerId: procedures.providerId,
			branchId: procedures.branchId,
			toothId: procedures.toothId,
			toothRange: procedures.toothRange
		})
		.from(procedures)
		.innerJoin(services, eq(services.id, procedures.serviceId))
		.where(and(inArray(procedures.status, ['planned', 'completed']), isNull(procedures.deletedAt)));
	const prosthetic = work.filter((w) => /crown|bridge|denture/i.test(w.service)).slice(0, 40);
	if (!labs.length || !prosthetic.length) return;

	const { pick, chance, between } = randomness(20261002);
	for (const [i, w] of prosthetic.entries()) {
		const lab = pick(labs);
		const turnaround = lab.turnaround ?? 7;
		// Cycle through the states, so every one is there whatever the count.
		const state = (['draft', 'sent', 'overdue', 'received', 'fitted', 'fitted', 'remake'] as const)[
			i % 7
		];
		const sentAgo = state === 'sent' ? between(1, turnaround - 1) : between(turnaround + 2, 60);
		const sentOn = state === 'draft' ? null : localDate(-sentAgo);
		const dueOn =
			state === 'draft'
				? null
				: state === 'remake'
					? localDate(between(2, turnaround))
					: localDate(-sentAgo + turnaround);
		// Some late, some early: the turnaround report has a spread to show.
		const receivedOn =
			state === 'received' || state === 'fitted'
				? localDate(-sentAgo + turnaround + (chance(0.3) ? between(1, 5) : -between(0, 2)))
				: null;
		await db.insert(labCase).values({
			patientId: w.patientId,
			labId: lab.id,
			procedureId: w.id,
			serviceId: w.serviceId,
			providerId: w.providerId,
			branchId: w.branchId,
			toothId: w.toothId,
			toothRange: w.toothRange,
			shade: pick(['A1', 'A2', 'A3', 'B1', null]),
			labFee: money(between(800, 6000)),
			instructions: `${w.service} (seed)`,
			status: state === 'overdue' ? 'sent' : state,
			sentOn,
			dueOn,
			receivedOn,
			fittedOn: state === 'fitted' && receivedOn ? localDate(-between(0, 3)) : null,
			remakes: state === 'remake' ? 1 : 0
		});
	}

	console.log(`Seeded ${prosthetic.length} lab cases.`);
}

/** Stock written off, which is what the damaged-supplies screen lists. */
export async function seedDamagedStock(db: SeedDb) {
	if (!(await isEmpty(db, damagedSupplies, 'damaged_supplies'))) return;

	const items = await db.select({ id: supplies.id }).from(supplies);
	if (!items.length) return;

	const { pick, between } = randomness(20261001);

	for (let i = 0; i < 6; i++) {
		await db.insert(damagedSupplies).values({
			supplyId: pick(items).id,
			quantity: between(1, 5),
			reason: pick(['Broken in transit', 'Expired', 'Contaminated', 'Dropped']),
			deductable: false
		});
	}

	console.log('Seeded damaged stock.');
}

/**
 * Terminations for the staff already marked inactive, so the inactive list and an employee's
 * termination panel agree with each other.
 */
export async function seedTerminations(db: SeedDb) {
	if (!(await isEmpty(db, employeeTermination, 'employee_termination'))) return;

	const gone = await db
		.select({ id: employee.id })
		.from(employee)
		.where(eq(employee.isActive, false));
	if (!gone.length) return;

	const { pick, between } = randomness(20261002);

	for (const person of gone) {
		await db.insert(employeeTermination).values({
			staffId: person.id,
			reason: pick(['Resigned', 'Contract ended', 'Moved abroad', 'Dismissed']),
			terminationDate: localDate(-between(30, 600)) as never
		});
	}

	console.log(`Seeded terminations for ${gone.length} inactive staff.`);
}

/** Ways to reach the corporate accounts, and the work each appointment type implies. */
export async function seedRelationships(db: SeedDb) {
	if (await isEmpty(db, customerContacts, 'customer_contacts')) {
		const accounts = await db.select({ id: customers.id, name: customers.name }).from(customers);
		for (const [index, account] of accounts.entries()) {
			await db.insert(customerContacts).values([
				{ customerId: account.id, contactType: 'phone', contactDetail: `0115000${100 + index}` },
				{
					customerId: account.id,
					contactType: 'email',
					contactDetail: `account${index + 1}@example.test`
				}
			]);
		}
	}

	if (await isEmpty(db, appointmentTypeServices, 'appointment_type_services')) {
		const [types, serviceList] = await Promise.all([
			db.select({ id: appointmentType.id, name: appointmentType.name }).from(appointmentType),
			db.select({ id: services.id, name: services.name }).from(services)
		]);

		/** The obvious pairings; anything else is a clinic's own choice to make on the screen. */
		const pairs: [string, string][] = [
			['Examination / Check-up', 'Consultation'],
			['Scaling and Polishing', 'Scaling and polishing'],
			['Filling', 'Composite filling'],
			['Extraction', 'Simple extraction'],
			['Root Canal', 'Root canal — molar'],
			['Radiograph', 'Periapical radiograph'],
			['Denture / Prosthetic', 'Complete denture']
		];

		for (const [typeName, serviceName] of pairs) {
			const type = types.find((t) => t.name === typeName);
			const service = serviceList.find((s) => s.name === serviceName);
			if (type && service) {
				await db
					.insert(appointmentTypeServices)
					.values({ appointmentTypeId: type.id, serviceId: service.id });
			}
		}
	}

	console.log('Seeded customer contacts and appointment-type services.');
}

/**
 * A few files on patient charts, pointing at one real file in the store.
 *
 * `patient_file` rows whose `stored_name` is invented would 404 when opened, which teaches the
 * wrong thing about the file route. This copies one placeholder into the store under a random
 * name of the shape `server/files.ts` produces, and every seeded row points at it.
 */
export async function seedPatientFiles(db: SeedDb, storedNames: (count: number) => string[]) {
	if (!(await isEmpty(db, patientFile, 'patient_file'))) return;

	const visits = await db
		.select({
			id: appointment.id,
			patientId: appointment.patientId,
			startsAt: appointment.startsAt
		})
		.from(appointment)
		.where(eq(appointment.status, 'completed'))
		.limit(60);
	const names = storedNames(visits.length);
	if (!visits.length || names.length < visits.length) return;

	const { pick } = randomness(20261004);

	for (const [i, visit] of visits.entries()) {
		await db.insert(patientFile).values({
			patientId: visit.patientId,
			appointmentId: visit.id,
			kind: pick(['radiograph', 'photo', 'paperRecord']),
			storedName: names[i],
			originalName: 'seed-placeholder.png',
			mimeType: 'image/png',
			takenOn: visit.startsAt.toISOString().slice(0, 10) as never,
			description: 'Seed attachment'
		});
	}

	console.log(`Seeded ${visits.length} patient files.`);
}
