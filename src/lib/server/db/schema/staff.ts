// staff.ts - Handles staff profiles, types, contacts, schedules, and compensation (salaries, bonuses, commissions)
import { relations } from 'drizzle-orm';
import {
	mysqlTable,
	mysqlEnum,
	varchar,
	datetime,
	int,
	decimal,
	date,
	time,
	index,
	boolean,
	uniqueIndex,
	tinyint,
	check
} from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';
import { secureFields, lesserFields, approvalFields } from './secureFields';
import { user } from './user';
import { paymentMethods } from './finance';
import { branchRef } from './branches';
import { address } from './locations';

/**
 * A number of leave days. Decimal rather than int because leave can be taken in half days —
 * `scale: 1` is all the precision a half needs, and it keeps the stored values exact.
 *
 * `mode: 'number'` matters: drizzle hands back decimal columns as strings by default, which
 * would silently turn the arithmetic in leaveAccrual.ts into string concatenation.
 */
const dayCount = (name: string) => decimal(name, { precision: 5, scale: 1, mode: 'number' });

export const department = mysqlTable(
	'department',
	{
		id: int('id').autoincrement().primaryKey(),
		name: varchar('name', { length: 32 }).notNull().unique(),
		phone: varchar('phone', { length: 20 }),
		commission: boolean('commission').notNull().default(false),
		description: varchar('description', { length: 255 }),
		...lesserFields
	},
	(table) => [index('name_idx').on(table.name)]
);

export const position = mysqlTable(
	'position',
	{
		id: int('id').autoincrement().primaryKey(),
		name: varchar('name', { length: 32 }).notNull().unique(),
		departmentId: int('department_id')
			.notNull()
			.references(() => department.id),
		description: varchar('description', { length: 255 }),
		...lesserFields
	},
	(table) => [index('name_idx').on(table.name)]
);

export const employmentStatuses = mysqlTable(
	'employment_statuses',
	{
		id: int('id').autoincrement().primaryKey(),
		name: varchar('name', { length: 32 }).notNull().unique(),
		removeFromLists: boolean('remove_from_lists').notNull().default(false),
		// 1. Keep it nullable.
		// Logic: 'true' for the termination row, 'null' for everything else.
		terminationStatus: boolean('termination_status'),
		description: varchar('description', { length: 255 }),
		...lesserFields
	},
	(table) => ({
		nameIdx: index('name_idx').on(table.name),
		// 2. The Unique Index ensures only one row can be 'true'.
		// Since MySQL allows multiple NULLs in a unique index,
		// all other rows should have this field set to NULL, not FALSE.
		terminationStatusIdx: uniqueIndex('termination_status_unique_idx').on(table.terminationStatus)
	})
);

export const educationalLevel = mysqlTable('educational_level', {
	id: int('id').autoincrement().primaryKey(),
	name: varchar('name', { length: 32 }).notNull().unique(),
	description: varchar('description', { length: 255 }),
	...lesserFields
});

export const employee = mysqlTable(
	'employee',
	{
		id: int('id').primaryKey().autoincrement(),
		idNo: varchar('id_no', { length: 255 }),
		name: varchar('name', { length: 50 }).notNull(),
		fatherName: varchar('father_name', { length: 50 }).notNull(),
		grandFatherName: varchar('grand_father_name', { length: 50 }).notNull(),
		gender: mysqlEnum('gender', ['male', 'female']).notNull().default('male'),
		nationality: varchar('nationality', { length: 50 }).notNull().default('Ethiopia'),
		bloodType: mysqlEnum('blood_type', ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
		tinNo: varchar('tin_no', { length: 10 }),
		departmentId: int('department_id')
			.notNull()
			.references(() => department.id),
		positionId: int('position_id').references(() => position.id),
		birthDate: date('birth_date').notNull(),
		/*
		 * Nullable since the spreadsheet import (migration 0064): a staff list typed into Excel
		 * carries no photographs, and the seed was already filling these with a placeholder name
		 * that served nothing. The add form still asks for both; an imported employee waits in
		 * Approvals without them until somebody scans them in. Every reader already checks before
		 * drawing one.
		 */
		photo: varchar('photo', { length: 255 }),
		govtId: varchar('govt_id', { length: 255 }),
		hireDate: date('hire_date').notNull(),
		terminationDate: datetime('termination_date'),
		employmentStatus: int('employment_status')
			.references(() => employmentStatuses.id)
			.notNull(),
		educationalLevel: int('educational_level').references(() => educationalLevel.id),
		martialStatus: mysqlEnum('martial_status', [
			'single',
			'married',
			'widowed',
			'divorced',
			'other'
		]).default('single'),
		/** Which location this employee works at. See `branchRef`. */
		branchId: branchRef(),
		existingPensionCard: boolean().default(false),
		address: int('address').references(() => address.id),
		leavesLeft: dayCount('leaves_left').notNull().default(0),
		signiture: varchar('signiture', { length: 255 }),
		pensionCard: varchar('pension_card', { length: 255 }),

		...secureFields,
		...approvalFields
	},
	(table) => [
		index('id_no_idx').on(table.idNo),
		index('first_name_idx').on(table.name),
		index('last_name_idx').on(table.fatherName),
		index('grand_father_name_idx').on(table.grandFatherName),
		index('hire_date_idx').on(table.hireDate)
	]
);

export const employeeGuarantor = mysqlTable('employee_guarantor', {
	id: int('id').autoincrement().primaryKey(),
	staffId: int('staff_id')
		.notNull()
		.references(() => employee.id),
	name: varchar('name', { length: 255 }).notNull(),
	relationship: mysqlEnum('relationship', [
		'mother',
		'father',
		'spouse',
		'son',
		'brother',
		'sister',
		'daughter',
		'other'
	]).notNull(),
	relation: varchar('relation', { length: 255 }),
	jobType: varchar('job_type', { length: 255 }),
	company: varchar('company', { length: 255 }),
	salary: decimal('salary', { precision: 10, scale: 2 }).notNull(),
	gurantorDocument: varchar('gurantor_document', { length: 255 }),
	phone: varchar('phone', { length: 255 }),
	photo: varchar('photo', { length: 255 }),
	govtId: varchar('govt_id', { length: 255 }),
	email: varchar('email', { length: 255 }),
	address: int('address')
		.references(() => address.id)
		.notNull(),
	...secureFields
});
/**
 * One band of monthly income tax, in the "quick deduction" form the Ministry of Revenues publishes:
 * income up to `threshold` is taxed at `rate` percent, less `deduction` birr.
 *
 * `rate` is a **percentage** — 15 for 15%, as it is typed from the proclamation. The band with no
 * `threshold` is everything above the others. `payrollMath.ts` owns the arithmetic; payroll used to
 * multiply the percentage as a fraction and to skip the open-ended band, which is why that module
 * exists.
 *
 * `mode: 'number'` per CLAUDE.md §9.
 */
export const taxType = mysqlTable(
	'tax_type',
	{
		id: int('id').autoincrement().primaryKey(),
		name: varchar('name', { length: 255 }).notNull(),
		threshold: decimal('threshold', { precision: 12, scale: 2, mode: 'number' }),
		rate: decimal('rate', { precision: 15, scale: 2, mode: 'number' }).notNull(),
		deduction: decimal('deduction', { precision: 12, scale: 2, mode: 'number' }).notNull(),
		...lesserFields
	},
	(table) => [
		index('name_idx').on(table.name),
		index('threshold_idx').on(table.threshold),
		index('rate_idx').on(table.rate),
		index('deduction_idx').on(table.deduction),
		index('status_idx').on(table.status)
	]
);

/** Who pays a pension contribution. */
export const PENSION_PARTIES = ['employee', 'employer'] as const;

/**
 * The two pension contribution rates, as percentages of basic salary: the employee's share, taken
 * from their pay, and the employer's, paid by the clinic on top of it.
 *
 * **Keyed by `party`, one row each.** It replaced a table named `penality` that payroll read by
 * position — its first row as the employee's rate, its second as the employer's — which held two
 * disciplinary fines, so a payroll run would have charged pension at fifty and two hundred times
 * salary. Nothing about the old rows said which was which; `party` does, and the unique index means
 * there is only ever one answer.
 *
 * `mode: 'number'` per CLAUDE.md §9.
 */
export const pensionRate = mysqlTable('pension_rate', {
	id: int('id').autoincrement().primaryKey(),
	name: varchar('name', { length: 100 }).notNull(),
	party: mysqlEnum('party', PENSION_PARTIES).notNull().unique(),
	rate: decimal('rate', { precision: 5, scale: 2, mode: 'number' }).notNull(),
	...lesserFields
});

export const leaveType = mysqlTable(
	'leave_type',
	{
		id: int('id').autoincrement().primaryKey(),
		name: varchar('name', { length: 50 }).notNull().unique(),
		maxDays: dayCount('max_days').notNull().default(0),
		// Annual leave is drawn from the accrued balance; event-based types (marriage,
		// bereavement, maternity) are granted on top of it and spend nothing.
		deductsBalance: boolean('deducts_balance').notNull().default(false),
		description: varchar('description', { length: 255 }),
		...lesserFields
	},
	(table) => [index('leave_type_name_idx').on(table.name)]
);

// How many annual leave days an employee earns per year, by how long they have served.
// Brackets are inclusive on both ends; a null `toYears` means "this bracket and up".
export const annualLeaveEntitlement = mysqlTable(
	'annual_leave_entitlement',
	{
		id: int('id').autoincrement().primaryKey(),
		fromYears: int('from_years').notNull(),
		toYears: int('to_years'),
		days: dayCount('days').notNull(),
		description: varchar('description', { length: 255 }),
		...lesserFields
	},
	(table) => [index('from_years_idx').on(table.fromYears)]
);

// How long an unused annual leave grant stays usable before it is voided. Only one row
// should be active at a time — the accrual engine reads the most recent active row.
export const leaveExpiryPolicy = mysqlTable('leave_expiry_policy', {
	id: int('id').autoincrement().primaryKey(),
	name: varchar('name', { length: 50 }).notNull(),
	expiryYears: int('expiry_years').notNull(),
	description: varchar('description', { length: 255 }),
	...lesserFields
});

// One row per employee per accrued year: what they were granted, how much of it they have
// spent, and the date it goes stale. Expiry voids whole grants, so the days an employee can
// still take are the unspent days across their grants that have not expired yet.
export const employeeLeaveGrant = mysqlTable(
	'employee_leave_grant',
	{
		id: int('id').autoincrement().primaryKey(),
		staffId: int('staff_id')
			.references(() => employee.id)
			.notNull(),
		serviceYear: int('service_year').notNull(),
		grantDate: date('grant_date').notNull(),
		expiryDate: date('expiry_date').notNull(),
		daysGranted: dayCount('days_granted').notNull(),
		daysUsed: dayCount('days_used').notNull().default(0),
		status: mysqlEnum('grant_status', ['active', 'expired']).notNull().default('active'),
		expiredAt: datetime('expired_at'),
		...secureFields
	},
	(table) => [
		uniqueIndex('staff_service_year_idx').on(table.staffId, table.serviceYear),
		index('grant_expiry_idx').on(table.expiryDate)
	]
);

export const leave = mysqlTable('leave', {
	id: int('id').autoincrement().primaryKey(),
	staffId: int('staff_id')
		.references(() => employee.id)
		.notNull(),
	leaveTypeId: int('leave_type_id').references(() => leaveType.id),
	requestDate: date('request_date').notNull(),
	startDate: date('start_date').notNull(),
	endDate: date('end_date').notNull(),
	// Two dates cannot say "morning only", so the boundary days carry their own flags and the
	// resulting duration is stored rather than re-derived. `days` is the authoritative figure the
	// ledger spends — see computeLeaveDays in $lib/leaveDays.
	halfDayStart: boolean('half_day_start').notNull().default(false),
	halfDayEnd: boolean('half_day_end').notNull().default(false),
	days: dayCount('days').notNull().default(0),
	reason: varchar('reason', { length: 255 }),
	approvedBy: varchar('user_id', { length: 255 }).references(() => user.id, {
		onDelete: 'set null'
	}),

	leaveLetter: varchar('leave_letter', { length: 100 }),
	status: mysqlEnum('status', ['pending', 'approved', 'rejected']).default('pending'),
	rejectionReason: varchar('rejection_reason', { length: 255 }),
	...secureFields
});

export const staffFamilies = mysqlTable('staff_families', {
	id: int('id').autoincrement().primaryKey(),
	staffId: int('staff_id').references(() => employee.id, { onDelete: 'cascade' }),
	relationship: mysqlEnum('relationship', [
		'mother',
		'father',
		'spouse',
		'son',
		'daughter',
		'grandchild',
		'grandfather',
		'grandmother',
		'uncle',
		'aunt',
		'brother',
		'sister',
		'other'
	]).notNull(),
	gender: mysqlEnum('gender', ['male', 'female']).notNull().default('male'),
	otherRelationship: varchar('other_relationship', { length: 255 }),
	name: varchar('name', { length: 255 }).notNull(),
	phone: varchar('phone', { length: 255 }),
	email: varchar('email', { length: 255 }),
	emergencyContact: boolean('emergency_contact').notNull().default(false),
	...secureFields
});

export const userStaff = mysqlTable('user_staff', {
	id: int('id').autoincrement().primaryKey(),
	userId: varchar('user_id', { length: 255 }).references(() => user.id, { onDelete: 'cascade' }),
	staffId: int('staff_id').references(() => employee.id, { onDelete: 'cascade' })
});

export const staffContacts = mysqlTable('staff_contacts', {
	id: int('id').primaryKey().autoincrement(),
	staffId: int('staff_id')
		.notNull()
		.references(() => employee.id, { onDelete: 'cascade' }),
	contactType: varchar('contact_type', { length: 50 }).notNull(),
	contactDetail: varchar('contact_detail', { length: 255 }).notNull(),
	...secureFields
});

export const staffAccounts = mysqlTable(
	'staff_accounts',
	{
		id: int('id').primaryKey().autoincrement(),
		staffId: int('staff_id')
			.notNull()
			.references(() => employee.id, { onDelete: 'cascade' }),
		paymentMethodId: int('payment_Method_id').references(() => paymentMethods.id, {
			onDelete: 'set null'
		}),
		accountDetail: varchar('account_detail', { length: 255 }).notNull(),
		...secureFields
	},
	(table) => [
		index('accountDetail_idx').on(table.accountDetail),
		index('is_active_idx').on(table.isActive)
	]
);

export const salaries = mysqlTable(
	'salaries',
	{
		id: int('id').primaryKey().autoincrement(),
		staffId: int('staff_id')
			.notNull()
			.references(() => employee.id, { onDelete: 'cascade' }),

		departmentId: int('department_id').references(() => department.id, { onDelete: 'set null' }),
		/** The branch this salary was set for, kept as a snapshot. */
		branchId: branchRef(),

		positionId: int('position_id').references(() => position.id, { onDelete: 'set null' }),
		officeCommission: boolean('office commision').default(false),
		percentage: decimal('percentage', { precision: 10, scale: 2 }),
		changeReason: varchar('change_reason', { length: 255 }),

		transportationAllowance: decimal('transportation_allowance', { precision: 10, scale: 2 })
			.notNull()
			.default('0'),
		housingAllowance: decimal('housing_allowance', { precision: 10, scale: 2 })
			.notNull()
			.default('0'),
		nonTaxAllowance: decimal('non_tax_allowance', { precision: 10, scale: 2 })
			.notNull()
			.default('0'),
		positionAllowance: decimal('position_allowance', { precision: 10, scale: 2 })
			.notNull()
			.default('0'),
		amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
		// `mode: 'string'`: calendar days, compared as ISO strings by the payroll run.
		startDate: date('start_date', { mode: 'string' }).notNull(),
		endDate: date('end_date', { mode: 'string' }),

		...secureFields,
		...approvalFields
	},
	(table) => [
		index('staff_id_idx').on(table.staffId),
		index('transportation_allowance_idx').on(table.transportationAllowance),
		index('housing_allowance_idx').on(table.housingAllowance),
		index('non_tax_allowance_idx').on(table.nonTaxAllowance),
		index('position_allowance_idx').on(table.positionAllowance),
		index('amount_idx').on(table.amount),
		index('start_date_idx').on(table.startDate),
		index('end_date_idx').on(table.endDate)
	]
);

export const bonuses = mysqlTable(
	'bonuses',
	{
		id: int('id').primaryKey().autoincrement(),
		staffId: int('staff_id').references(() => employee.id, { onDelete: 'set null' }),
		description: varchar('description', { length: 255 }),
		amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
		// `mode: 'string'`: a calendar day, compared as ISO by payroll and the adjustment ledgers.
		bonusDate: date('bonus_date', { mode: 'string' }).notNull(),
		...secureFields
	},
	(table) => [
		index('staff_id_idx').on(table.staffId),
		index('amount_idx').on(table.amount),
		index('bonus_date_idx').on(table.bonusDate)
	]
);

export const overTime = mysqlTable(
	'over_time',
	{
		id: int('id').primaryKey().autoincrement(),
		staffId: int('staff_id').references(() => employee.id, { onDelete: 'set null' }),
		reason: varchar('reason', { length: 255 }),
		amountPerHour: decimal('amount_per_hour', { precision: 10, scale: 2 }).notNull(),
		overTimeTypeId: int('over_time_type_id').references(() => overTimeType.id, {
			onDelete: 'set null'
		}),
		hours: decimal('hours', { precision: 10, scale: 2 }).notNull(),
		total: decimal('total', { precision: 10, scale: 2 }).notNull(),
		date: date('date', { mode: 'string' }).notNull(),
		...secureFields
	},
	(table) => [
		index('staff_id_idx').on(table.staffId),
		index('amount_idx').on(table.total),
		index('date_idx').on(table.date)
	]
);

export const overTimeType = mysqlTable('over_time_type', {
	id: int('id').primaryKey().autoincrement(),
	name: varchar('name', { length: 255 }).notNull(),
	rate: decimal('rate', { precision: 10, scale: 2 }).notNull(),
	maxhours: int('max_hours'),
	...secureFields
});

export const deductions = mysqlTable(
	'deductions',
	{
		id: int('id').autoincrement().primaryKey(),
		staffId: int('staff_id').references(() => employee.id, { onDelete: 'set null' }),
		type: varchar('type', { length: 100 }).notNull(),
		reason: varchar('reason', { length: 255 }).notNull(),

		amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
		deductionDate: date('deduction_date', { mode: 'string' }).notNull(),
		warningType: varchar('warning_type', { length: 100 }),
		warningReason: varchar('warning_reason', { length: 255 }),
		...secureFields
	},
	(table) => [
		index('staff_id_idx').on(table.staffId),
		index('amount_idx').on(table.amount),
		index('bonus_date_idx').on(table.deductionDate)
	]
);

export const staffSchedule = mysqlTable(
	'staff_schedule',
	{
		id: int('id').autoincrement().primaryKey(),
		staffId: int('staff_id')
			.notNull()
			.references(() => employee.id, { onDelete: 'cascade' }),
		weekDay: tinyint('week_day').notNull(),
		startTime: time('start_time').notNull(),
		endTime: time('end_time').notNull(),
		...secureFields
	},
	(table) => [check('real_days_only', sql`${table.weekDay} >= 0 AND ${table.weekDay} <= 6`)]
);

export const staffScheduleRelations = relations(staffSchedule, ({ one }) => ({
	staff: one(employee, {
		fields: [staffSchedule.staffId],
		references: [employee.id]
	})
}));

export const employeeTermination = mysqlTable('employee_termination', {
	id: int('id').autoincrement().primaryKey(),
	staffId: int('staff_id')
		.notNull()
		.references(() => employee.id),
	reason: varchar('reason', { length: 255 }),
	terminationLetter: varchar('termination_letter', { length: 255 }),
	terminationDate: date('termination_date').notNull(),
	...secureFields
});

export const qualification = mysqlTable('qualification', {
	id: int('id').autoincrement().primaryKey(),
	staffId: int('staff_id')
		.notNull()
		.references(() => employee.id),
	field: varchar('field', { length: 255 }),
	educationLevel: int('education_level')
		.references(() => educationalLevel.id)
		.notNull(),
	schoolName: varchar('school_name', { length: 255 }),
	graduationDate: date('qualification_date').notNull(),
	certificate: varchar('certificate', { length: 100 }),
	...secureFields
});

export const workExperience = mysqlTable('work_experience', {
	id: int('id').autoincrement().primaryKey(),
	staffId: int('staff_id')
		.notNull()
		.references(() => employee.id),
	companyName: varchar('company_name', { length: 255 }),
	position: varchar('position', { length: 255 }),
	startDate: date('start_date').notNull(),
	endDate: date('end_date').notNull(),
	description: varchar('description', { length: 255 }),
	certificate: varchar('certificate', { length: 100 }),
	...secureFields
});

export const staffQualificationRelations = relations(qualification, ({ one }) => ({
	staff: one(employee, {
		fields: [qualification.staffId],
		references: [employee.id]
	})
}));
