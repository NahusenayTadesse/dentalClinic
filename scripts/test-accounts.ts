/**
 * Readies a database for people to test: one account per job in a clinic, every account on one
 * shared password, nobody signed in, and the list written to `TEST-ACCOUNTS.md` to hand out.
 *
 * Run:  npm run db:test-accounts -- --yes                 (password `test1234`)
 *       npm run db:test-accounts -- --yes --password=…    (another, eight characters or more)
 *
 * Safe to run again, and meant to be: a tester who changes the shared password locks everybody
 * else out, and running this puts it back. Roles are matched by name and accounts by email, so a
 * second run updates rather than duplicates.
 *
 * **Why roles, not just accounts.** A fresh install has one role, Super Admin, and an account that
 * holds every permission sees every button — so a tester could never find out that a receptionist
 * cannot open the payroll, that a salary change waits for somebody else to approve it, or that a
 * receptionist at Bole sees Bole's patients and not Piassa's. Those are the rules that most need
 * testing, and testing them takes people who do not hold everything.
 *
 * **Never on a real clinic's database.** Every account's password becomes the same known word, so
 * this refuses to run where any account's email is not an obvious test address, and, like the
 * seed, refuses a database on another machine unless `ALLOW_REMOTE_SEED=yes`.
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { eq, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/mysql2';
import { hashPassword } from 'better-auth/crypto';
import { createClinicPool } from '../src/lib/server/db/connection';
import { account, roles, session, user, verification } from '../src/lib/server/db/schema/user';
import { permissions, rolePermissions } from '../src/lib/server/db/schema/permissions';
import { branch } from '../src/lib/server/db/schema/branches';

const { values } = parseArgs({
	options: {
		yes: { type: 'boolean', default: false },
		password: { type: 'string', default: 'test1234' }
	}
});

const url = process.env.DATABASE_URL;
if (!url) {
	console.error('DATABASE_URL is not set.');
	process.exit(1);
}

const host = new URL(url.replace(/^mysql:\/\//, 'http://')).hostname;
if (!['localhost', '127.0.0.1', '::1'].includes(host) && process.env.ALLOW_REMOTE_SEED !== 'yes') {
	console.error(`Refusing to change accounts on a non-local database (${host}).`);
	console.error('If it is a test server you mean, set ALLOW_REMOTE_SEED=yes.');
	process.exit(1);
}
if (!values.yes) {
	console.error(`This sets every account on ${host} to one password. Re-run with --yes.`);
	process.exit(1);
}

const password = values.password;
// better-auth's own minimum; a shorter one would be stored and then refused at sign-in.
if (password.length < 8) {
	console.error('The password must be at least 8 characters.');
	process.exit(1);
}

/** An address no real person has: the reserved `.test` and `example` domains. */
const isTestAddress = (email: string) =>
	/@([a-z0-9-]+\.)*(test|example(\.(com|org|net))?)$/i.test(email);

/**
 * The jobs in a small clinic, and what each may do. A permission named here that the database does
 * not have stops the run, so a renamed permission is noticed rather than silently dropped.
 */
const ROLES: { name: string; does: string; permissions: string[] }[] = [
	{
		name: 'Clinic Manager',
		does: 'Runs the clinic day to day: approves what others request, reads every report, sees every branch. Cannot change settings, users or payroll.',
		permissions: [
			'patients.view',
			'patients.register',
			'patients.edit',
			'patients.export',
			'appointments.view',
			'appointments.book',
			'billing.invoice',
			'billing.cash_session',
			'treatment_plans.manage',
			'customers.record',
			'providers.manage',
			'lab_cases.manage',
			'supplies_suppliers.manage',
			'employees.create_followup',
			'leaves.view_approved',
			'approvals.view',
			'approvals.approve',
			'rejections.view',
			'rejections.reopen',
			'reports.clinic',
			'reports.finance',
			'reports.hr',
			'audit_logs.view',
			'branches.view_all',
			'data.import'
		]
	},
	{
		name: 'Dentist',
		does: 'Charts and treats: findings and procedures, notes, prescriptions, treatment plans, lab work, radiographs.',
		permissions: [
			'patients.view',
			'patients.clinical',
			'treatment_plans.manage',
			'appointments.view',
			'lab_cases.manage'
		]
	},
	{
		name: 'Receptionist',
		does: 'The front desk: registers patients, books and checks them in, keeps their details up to date. Does not take money.',
		permissions: [
			'patients.view',
			'patients.register',
			'patients.edit',
			'appointments.view',
			'appointments.book'
		]
	},
	{
		name: 'Cashier',
		does: 'Bills and payments: issues bills, takes payment, opens and closes the cash drawer.',
		permissions: ['patients.view', 'appointments.view', 'billing.invoice', 'billing.cash_session']
	},
	{
		name: 'Dental Assistant',
		does: 'Chairside support: the sterilisation log, instrument packs, and lab work.',
		permissions: ['patients.view', 'appointments.view', 'sterilisation.record', 'lab_cases.manage']
	},
	{
		name: 'Accountant',
		does: 'Staff and money: employees, payroll, attendance, expenses, the finance and HR reports. What it requests waits for the manager to approve.',
		permissions: [
			'employees.create_followup',
			'salary.manage',
			'transactions.manage',
			'attendance.manage',
			'leaves.view_approved',
			'approvals.view',
			'rejections.view',
			'reports.finance',
			'reports.hr'
		]
	},
	{
		name: 'Store Keeper',
		does: 'Supplies: stock, purchase orders, suppliers and the controlled-medicine register.',
		permissions: ['supplies_suppliers.manage']
	}
];

/** The accounts to hand out. `branch` is a branch's name; omitted, the main branch. */
const ACCOUNTS: { email: string; name: string; role: string; branch?: string }[] = [
	{ email: 'admin@clinic.test', name: 'Clinic Owner', role: 'Super Admin' },
	{ email: 'manager@clinic.test', name: 'Clinic Manager', role: 'Clinic Manager' },
	{ email: 'dentist@clinic.test', name: 'Dr. Test Dentist', role: 'Dentist' },
	{ email: 'reception@clinic.test', name: 'Main Reception', role: 'Receptionist' },
	{
		email: 'reception.bole@clinic.test',
		name: 'Bole Reception',
		role: 'Receptionist',
		branch: 'Bole Clinic'
	},
	{ email: 'cashier@clinic.test', name: 'Main Cashier', role: 'Cashier' },
	{ email: 'assistant@clinic.test', name: 'Dental Assistant', role: 'Dental Assistant' },
	{ email: 'accountant@clinic.test', name: 'Accountant', role: 'Accountant' },
	{ email: 'store@clinic.test', name: 'Store Keeper', role: 'Store Keeper' }
];

const SUPER_ADMIN_ROLE = 'Super Admin';
const MAIN_BRANCH_ID = 1;

const client = createClinicPool(url);
const db = drizzle(client);

try {
	const everyone = await db.select({ email: user.email }).from(user).where(isNull(user.deletedAt));
	const real = everyone.map((u) => u.email).filter((email) => !isTestAddress(email));
	if (real.length) {
		console.error(
			`Refusing: these accounts do not look like test accounts, and would all get the same password:\n  ${real.join('\n  ')}`
		);
		process.exitCode = 1;
	} else {
		await prepare();
	}
} finally {
	await client.end();
}

async function prepare() {
	const allPermissions = await db
		.select({ id: permissions.id, name: permissions.name })
		.from(permissions);
	if (!allPermissions.length) {
		throw new Error('The permissions table is empty: start the app once (or run /setup) first.');
	}
	const permissionId = new Map(allPermissions.map((p) => [p.name, p.id]));

	const [superAdmin] = await db
		.select({ id: roles.id })
		.from(roles)
		.where(eq(roles.name, SUPER_ADMIN_ROLE));
	if (!superAdmin) throw new Error(`There is no "${SUPER_ADMIN_ROLE}" role: run /setup first.`);
	const roleId = new Map<string, number>([[SUPER_ADMIN_ROLE, superAdmin.id]]);

	// Roles, each holding exactly its listed permissions.
	for (const role of ROLES) {
		const missing = role.permissions.filter((p) => !permissionId.has(p));
		if (missing.length) throw new Error(`${role.name}: no such permission ${missing.join(', ')}`);

		await db.insert(roles).ignore().values({ name: role.name, description: role.does });
		const [row] = await db.select({ id: roles.id }).from(roles).where(eq(roles.name, role.name));
		await db
			.update(roles)
			.set({ description: role.does, isActive: true, deletedAt: null })
			.where(eq(roles.id, row.id));
		await db.delete(rolePermissions).where(eq(rolePermissions.roleId, row.id));
		await db
			.insert(rolePermissions)
			.values(
				role.permissions.map((p) => ({ roleId: row.id, permissionId: permissionId.get(p)! }))
			);
		roleId.set(role.name, row.id);
	}

	const branches = await db.select({ id: branch.id, name: branch.name }).from(branch);
	const branchId = (name?: string) =>
		name ? (branches.find((b) => b.name === name)?.id ?? MAIN_BRANCH_ID) : MAIN_BRANCH_ID;

	// The accounts: made if missing, otherwise put back to their role, branch and name.
	for (const a of ACCOUNTS) {
		const fields = {
			name: a.name,
			roleId: roleId.get(a.role)!,
			// better-auth's admin plugin reads this; only an account holding everything is an admin.
			role: a.role === SUPER_ADMIN_ROLE ? 'admin' : 'user',
			branchId: branchId(a.branch),
			isActive: true,
			banned: false,
			emailVerified: true
		};
		const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, a.email));
		if (existing) {
			await db.update(user).set(fields).where(eq(user.id, existing.id));
		} else {
			await db.insert(user).values({ id: randomUUID(), email: a.email, ...fields });
		}
	}

	// One password for every account that signs in with one — the handed-out ones and any other.
	const people = await db
		.select({
			id: user.id,
			email: user.email,
			name: user.name,
			roleId: user.roleId,
			branchId: user.branchId
		})
		.from(user)
		.where(isNull(user.deletedAt));
	const credentials = await db
		.select({ userId: account.userId })
		.from(account)
		.where(eq(account.providerId, 'credential'));
	const hasPassword = new Set(credentials.map((c) => c.userId));

	for (const person of people) {
		const hash = await hashPassword(password);
		if (hasPassword.has(person.id)) {
			await db.update(account).set({ password: hash }).where(eq(account.userId, person.id));
		} else {
			await db
				.insert(account)
				.values({
					id: randomUUID(),
					accountId: person.id,
					providerId: 'credential',
					userId: person.id,
					password: hash
				});
		}
	}

	// Signed out everywhere: the old sessions belonged to the old passwords, and a database dump
	// for testers should not carry anybody's live session in it.
	await db.delete(session);
	await db.delete(verification);

	writeAccountsFile(people, roleId, branches);
	console.log(`${people.length} accounts now share one password; written to TEST-ACCOUNTS.md.`);
}

function writeAccountsFile(
	people: { email: string; name: string; roleId: number; branchId: number | null }[],
	roleId: Map<string, number>,
	branches: { id: number; name: string }[]
) {
	const roleName = new Map([...roleId].map(([name, id]) => [id, name]));
	const branchName = (id: number | null) =>
		branches.find((b) => b.id === (id ?? MAIN_BRANCH_ID))?.name ?? '';
	const handedOut = new Set(ACCOUNTS.map((a) => a.email));
	const row = (p: (typeof people)[number]) =>
		`| ${roleName.get(p.roleId) ?? 'Other'} | \`${p.email}\` | ${branchName(p.branchId)} | ${p.name} |`;

	const lines = [
		'# Test accounts',
		'',
		'Every account below signs in with the same password:',
		'',
		`**Password: \`${password}\`**`,
		'',
		'Everything in this system is made-up test data. No patient, employee or payer in it is real.',
		'',
		'| Role | Email | Branch | Name |',
		'| --- | --- | --- | --- |',
		...ACCOUNTS.map((a) => people.find((p) => p.email === a.email)!).map(row),
		'',
		'## What each role can do',
		'',
		`- **${SUPER_ADMIN_ROLE}** — everything, including settings, users, roles and backups.`,
		...ROLES.map((r) => `- **${r.name}** — ${r.does}`),
		'',
		'## Worth trying',
		'',
		'- **Approvals need two people.** Sign in as the Accountant and change an employee’s salary, then sign in as the Manager and approve it under Approvals. The Accountant cannot approve their own request.',
		'- **Branches.** `reception.bole@clinic.test` works at Bole Clinic and sees Bole’s patients in the list; searching by name still finds a patient from another branch, and says so.',
		'- **Payers.** Seed Mutual Insurance covers 80% with a yearly limit and needs pre-authorisation; Seed Bank Staff Scheme covers 50%. Bill one of their members and watch the bill split into a payer part and a co-payment.',
		'- **Permissions.** Try opening a page a role should not have — the payroll as the Receptionist, say. It should refuse.',
		'- **Import.** Clinic Setup → Import from a Spreadsheet, signed in as the Manager or the Owner.',
		'',
		'## Please',
		'',
		'- Do not change the password: everyone shares it. If it stops working, someone did — ask for it to be reset.',
		'- Forgot-password emails go nowhere: these addresses are not real.',
		''
	];

	const others = people.filter((p) => !handedOut.has(p.email));
	if (others.length) {
		lines.push(
			'## Other accounts in this database',
			'',
			'Left from development. Same password. Consider deactivating them under Admin Panel → Users before handing the system out.',
			'',
			'| Role | Email | Branch | Name |',
			'| --- | --- | --- | --- |',
			...others.map(row),
			''
		);
	}

	writeFileSync('TEST-ACCOUNTS.md', lines.join('\n'));
}
