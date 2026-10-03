/**
 * Fills a development database with enough rows to see the app work.
 *
 * An empty database hides whole classes of problem. The table's facet counts and charts were
 * wrong for months partly because nobody had enough employees on screen to notice that the chart
 * disagreed with the list — with four rows and one department, every arrangement looks right.
 *
 * Run:  npm run db:seed
 *
 * **This deletes data.** `drizzle-seed`'s `reset` truncates the tables it is given, and it does
 * not care whether you put them there: pointed at `department` it emptied the departments a
 * hundred employees referenced, leaving every one of them with a dangling foreign key and a blank
 * column on screen. That is why the lookup tables below are written by hand and never reset, and
 * why this refuses to run anywhere that is not obviously a developer's own machine.
 *
 * Non-goal: demo data for a customer. This makes rows that exercise the UI, not rows anybody
 * should be shown — the names are `Staff 1..n` on purpose, so nothing here can be mistaken for a
 * real patient or employee if it ever escapes into a screenshot.
 */
import 'dotenv/config';
import { count } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/mysql2';
import { createClinicPool } from '../src/lib/server/db/connection';
import { seed } from 'drizzle-seed';

import {
	employee,
	department,
	position,
	employmentStatuses
} from '../src/lib/server/db/schema/staff';
import { branch } from '../src/lib/server/db/schema/branches';
import { seedPatients } from './seed/patients';
import { seedScheduling } from './seed/scheduling';
import {
	seedFinanceReference,
	seedHrReference,
	seedLocations,
	seedServices
} from './seed/reference';
import { seedLeave, seedSalaries, seedStaffDetails } from './seed/staff';
import { seedSupplies } from './seed/supplies';
import { seedClinicalRecord } from './seed/clinical';
import { seedTreatmentPlans } from './seed/plans';
import { seedPerio } from './seed/perio';
import { seedSterilisation } from './seed/sterilisation';
import { seedControlled } from './seed/controlled';
import { seedOrtho } from './seed/ortho';
import { moveDiaryToToday } from './seed/diary';
import {
	seedDamagedStock,
	seedExpenses,
	seedAttendance,
	seedLabCases,
	seedLabWork,
	seedPatientFiles,
	seedPayrollInputs,
	seedRelationships,
	seedTerminations
} from './seed/operations';
import { placeholderFiles } from './seed/files';

const url = process.env.DATABASE_URL;

if (!url) {
	console.error('DATABASE_URL is not set.');
	process.exit(1);
}

/*
 * Two locks, because a seeding script pointed at the wrong database is the kind of mistake that
 * has no undo. The host check catches the common accident; the flag catches the deliberate one.
 */
const host = new URL(url.replace(/^mysql:\/\//, 'http://')).hostname;
const isLocal = ['localhost', '127.0.0.1', '::1'].includes(host);

if (!isLocal && process.env.ALLOW_REMOTE_SEED !== 'yes') {
	console.error(
		`Refusing to seed a non-local database (${host}).\n` +
			`If you really mean it, set ALLOW_REMOTE_SEED=yes.`
	);
	process.exit(1);
}

if (!process.argv.includes('--yes')) {
	console.error(`This writes rows into ${host}. Re-run with --yes to confirm.`);
	process.exit(1);
}

// The app's own factory: UTC sessions, or every seeded `created_at` is three hours late.
const connection = createClinicPool(url);
const db = drizzle(connection);

/*
 * Written by hand rather than generated, and never reset: these are the values the generated
 * employees point at, and they are also what the column filters and the chart group by. Random
 * strings here would make the facets unreadable, which defeats the reason for seeding at all.
 */
const DEPARTMENTS = ['Reception', 'Clinical', 'Laboratory', 'Administration'];
const POSITIONS = ['Dentist', 'Nurse', 'Receptionist', 'Technician'];
const BRANCHES = ['Bole Clinic', 'Piassa Clinic'];
const STATUSES = ['Permanent', 'Contract'];

async function ensureLookups() {
	// `ignore` so a re-run tops the database up instead of failing on what is already there.
	await db
		.insert(department)
		.ignore()
		.values(DEPARTMENTS.map((name, i) => ({ id: 901 + i, name })));
	await db
		.insert(position)
		.ignore()
		.values(POSITIONS.map((name, i) => ({ id: 901 + i, name })));
	await db
		.insert(branch)
		.ignore()
		.values(BRANCHES.map((name, i) => ({ id: 901 + i, name })));
	await db
		.insert(employmentStatuses)
		.ignore()
		.values(STATUSES.map((name, i) => ({ id: 901 + i, name })));
}

async function main() {
	await ensureLookups();

	/*
	 * drizzle-seed numbers its rows from 1, so a second run collides on the primary key rather
	 * than topping up. `--fresh` is the honest way out: say plainly that it empties the table.
	 */
	if (process.argv.includes('--fresh')) {
		await db.delete(employee);
		console.log('Cleared employee.');
	}

	const rowCount = Number(process.env.SEED_COUNT ?? 120);

	// A second run without `--fresh` collides on drizzle-seed's ids; skip instead, so the patient
	// step below can still run on a database that already has its employees.
	const [{ staff }] = await db.select({ staff: count() }).from(employee);
	if (staff > 0) {
		console.log(`employee already holds ${staff} rows; skipping (use --fresh to reseed).`);
		await rest();
		return;
	}

	/*
	 * `refine` rather than letting drizzle-seed invent everything: the columns the UI groups by
	 * have to come from the real lookup ids, and `approvalStatus` has to be `approved` or the
	 * rows land in the approval queue and the list stays empty — which is exactly the confusing
	 * half-success this script exists to avoid.
	 */
	await seed(db, { employee, employmentStatuses }, { count: rowCount }).refine((f) => ({
		// Exposed only so the FK on `employee` can be resolved; its real rows are written above.
		employmentStatuses: { count: 0 },
		employee: {
			columns: {
				/*
				 * Every column is refined, not just the interesting ones. Left to itself
				 * drizzle-seed fills a `varchar` with random characters, which gives you a
				 * nationality of "03GkdEfq61", 8,861 days of annual leave and hire dates in 2028.
				 * It is not wrong — it has no way to know what the column means — but data that
				 * cannot be read is barely better than an empty table for spotting a UI problem.
				 */
				name: f.firstName(),
				fatherName: f.lastName(),
				grandFatherName: f.lastName(),
				gender: f.valuesFromArray({ values: ['male', 'female'] }),
				nationality: f.default({ defaultValue: 'Ethiopian' }),
				bloodType: f.valuesFromArray({
					values: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
				}),
				idNo: f.int({ minValue: 100000, maxValue: 999999 }),
				tinNo: f.int({ minValue: 1000000000, maxValue: 9999999999 }),
				birthDate: f.date({ minDate: '1965-01-01', maxDate: '2004-12-31' }),
				hireDate: f.date({ minDate: '2015-01-01', maxDate: '2025-06-30' }),
				terminationDate: f.default({ defaultValue: null }),
				martialStatus: f.valuesFromArray({ values: ['single', 'married', 'divorced'] }),
				leavesLeft: f.number({ minValue: 0, maxValue: 30, precision: 10 }),
				// `photo` and `govtId` are NOT NULL, so they get a placeholder name rather than a
				// 200-character random string. Nothing is behind it — the file store is empty in
				// development — and a missing image reads more honestly than invented bytes.
				photo: f.default({ defaultValue: 'seed-placeholder.jpg' }),
				govtId: f.default({ defaultValue: 'seed-placeholder.jpg' }),
				signiture: f.default({ defaultValue: null }),
				pensionCard: f.default({ defaultValue: null }),
				address: f.default({ defaultValue: null }),
				existingPensionCard: f.default({ defaultValue: false }),

				departmentId: f.valuesFromArray({ values: DEPARTMENTS.map((_, i) => 901 + i) }),
				positionId: f.valuesFromArray({ values: POSITIONS.map((_, i) => 901 + i) }),
				branchId: f.valuesFromArray({ values: BRANCHES.map((_, i) => 901 + i) }),
				employmentStatus: f.valuesFromArray({ values: STATUSES.map((_, i) => 901 + i) }),
				educationalLevel: f.default({ defaultValue: null }),

				isActive: f.weightedRandom([
					{ weight: 0.85, value: f.default({ defaultValue: true }) },
					{ weight: 0.15, value: f.default({ defaultValue: false }) }
				]),
				// Without this every generated row lands in the approval queue and the list that
				// was supposed to be full stays empty.
				approvalStatus: f.default({ defaultValue: 'approved' }),
				approvalOverridden: f.default({ defaultValue: false }),
				createdBy: f.default({ defaultValue: null }),
				updatedBy: f.default({ defaultValue: null }),
				deletedBy: f.default({ defaultValue: null }),
				deletedAt: f.default({ defaultValue: null }),
				requestedBy: f.default({ defaultValue: null }),
				approvedBy: f.default({ defaultValue: null }),
				approvedAt: f.default({ defaultValue: null }),
				rejectedBy: f.default({ defaultValue: null }),
				rejectedAt: f.default({ defaultValue: null }),
				rejectionReason: f.default({ defaultValue: null })
			}
		}
	}));

	const [{ total }] = await db.select({ total: count() }).from(employee);

	console.log(`Seeded. employee now holds ${total} rows.`);

	await rest();
}

/**
 * Everything after the employees, in the order the foreign keys demand: reference lists first,
 * then the records that point at them, then what those records leave behind.
 *
 * Each step skips itself when its own table already has rows, so this is safe to re-run and tops
 * up whatever a database is missing.
 */
async function rest() {
	await seedLocations(db);
	await seedHrReference(db);
	await seedFinanceReference(db);
	await seedServices(db);

	await seedStaffDetails(db);
	await seedSalaries(db);
	await seedLeave(db);

	await seedPatients(db, BRANCHES);
	await seedScheduling(db, BRANCHES);

	await seedSupplies(db);
	await seedControlled(db);
	await seedClinicalRecord(db);
	await seedTreatmentPlans(db);
	await seedPerio(db);
	await seedSterilisation(db);
	await seedOrtho(db);

	await seedPayrollInputs(db);
	await seedExpenses(db);
	await seedLabWork(db);
	await seedLabCases(db);
	await seedAttendance(db);
	await seedDamagedStock(db);
	await seedTerminations(db);
	await seedRelationships(db);
	await seedPatientFiles(db, placeholderFiles);
}

await main();
// `--to-today`: centre the seeded diary on today again (see `seed/diary.ts`).
if (process.argv.includes('--to-today')) await moveDiaryToToday(db);
await connection.end();
