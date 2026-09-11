import { eq, inArray } from 'drizzle-orm';

import { db } from '$lib/server/db';
import {
	allergen,
	appointmentType,
	branch,
	clinicClosure,
	contactTypes,
	medicine,
	operatory,
	permissions,
	providerSpecialty,
	rolePermissions,
	roles,
	tooth
} from '$lib/server/db/schema';
import { allTeeth } from '$lib/server/db/schema/teeth';
import { MAIN_BRANCH_ID } from '$lib/server/db/schema/branches';
import { routeRules } from '$lib/routeAccess';
import { toEthiopian, toGregorian } from 'ethiopian-calendar-new';

/**
 * The permissions the system recognises, and the role that holds all of them.
 *
 * Deliberately does **not** create a user. A password hash committed to a repository is a
 * vulnerability with a long tail, and the first administrator is created instead at `/setup`,
 * through better-auth, so their credential is hashed exactly as any later one would be.
 *
 * Idempotent: every insert is guarded, so re-running changes nothing. Nothing here updates or
 * removes an existing row — permissions are edited in the admin panel once the system is up.
 */

/** The name of the role that holds every permission. Looked up by name; `roles` has no slug. */
export const SUPER_ADMIN_ROLE = 'Super Admin';

/**
 * Two permissions are enforced in code rather than by a route prefix, so `routeRules` alone
 * would miss them:
 *
 *   `approvals.override` — release a record you requested yourself (`approvals/[entity]`)
 *   `rejections.reopen`  — put a rejected record back in the queue (`rejections/[entity]`)
 *
 * Everything else is derived from `routeRules`, which is the single source of truth for route
 * gating (CLAUDE.md §9). Deriving rather than restating means a new gated route cannot ship
 * with a permission nobody can be granted.
 */
const CODE_ONLY_PERMISSIONS = ['approvals.override', 'rejections.reopen'] as const;

/** Human wording for the permission list in the admin panel. */
const DESCRIPTIONS: Record<string, string> = {
	'approvals.approve': 'Approve or reject records waiting in a queue',
	'approvals.override': 'Release a record you requested yourself — recorded as an override',
	'approvals.view': 'See what is waiting for approval',
	'attendance.manage': 'Record and correct attendance',
	'audit_logs.view': 'Read the audit trail',
	'customers.record': 'Maintain corporate billing customers',
	'employees.create_followup': 'Open and follow up employee records',
	'leaves.view_approved': 'See approved leave',
	'rejections.reopen': 'Put a rejected record back into its queue',
	'rejections.view': 'See rejected records',
	'reports.finance': 'Read the money and payroll reports',
	'reports.hr': 'Read the people and leave reports',
	'roles.manage': 'Create roles and decide what they may do',
	'salary.manage': 'Run payroll and manage salaries',
	'settings.manage': 'Change system settings, lookups and backups',
	'supplies_suppliers.manage': 'Maintain supplies and suppliers',
	'transactions.manage': 'Record transactions and expenses',
	'users.manage': 'Create and manage user accounts'
};

/** Every permission the system recognises, in a stable order. */
export function permissionNames(): string[] {
	const fromRoutes = routeRules.map((rule) => rule.permission);
	return [...new Set([...fromRoutes, ...CODE_ONLY_PERMISSIONS])].sort();
}

export type SeedResult = {
	permissionsCreated: number;
	permissionsTotal: number;
	roleCreated: boolean;
	grantsCreated: number;
};

/**
 * Creates the permission rows, the super-admin role, and the grants between them.
 *
 * The grant loop is not optional bookkeeping. `computeIsSuperAdmin` decides the status by
 * counting a user's permissions against the total in the table — so a role that holds all but
 * one is not a super admin, and every delete button in the app stays hidden. That is also why
 * adding a permission later demotes existing super admins until they are granted it.
 */
export async function seedPermissions(): Promise<SeedResult> {
	const names = permissionNames();

	const existing = await db
		.select({ name: permissions.name })
		.from(permissions)
		.where(inArray(permissions.name, names));

	const missing = names.filter((name) => !existing.some((row) => row.name === name));

	if (missing.length) {
		await db.insert(permissions).values(
			missing.map((name) => ({
				name,
				description: DESCRIPTIONS[name] ?? name
			}))
		);
	}

	const [role] = await db
		.select({ id: roles.id })
		.from(roles)
		.where(eq(roles.name, SUPER_ADMIN_ROLE))
		.limit(1);

	let roleId = role?.id;
	let roleCreated = false;

	if (!roleId) {
		await db.insert(roles).values({
			name: SUPER_ADMIN_ROLE,
			description: 'Holds every permission. Required for deletes and system settings.'
		});
		const [created] = await db
			.select({ id: roles.id })
			.from(roles)
			.where(eq(roles.name, SUPER_ADMIN_ROLE))
			.limit(1);
		roleId = created.id;
		roleCreated = true;
	}

	// Re-read rather than reuse `missing`: on a re-run the rows already exist, and the role
	// still has to end up holding all of them.
	const all = await db.select({ id: permissions.id }).from(permissions);
	const held = await db
		.select({ permissionId: rolePermissions.permissionId })
		.from(rolePermissions)
		.where(eq(rolePermissions.roleId, roleId));

	const heldIds = new Set(held.map((row) => row.permissionId));
	const toGrant = all.filter((row) => !heldIds.has(row.id));

	if (toGrant.length) {
		await db
			.insert(rolePermissions)
			.values(toGrant.map((row) => ({ roleId, permissionId: row.id })));
	}

	return {
		permissionsCreated: missing.length,
		permissionsTotal: all.length,
		roleCreated,
		grantsCreated: toGrant.length
	};
}

/**
 * Creates the main branch, if it does not exist.
 *
 * Every branch-aware table defaults `branch_id` to `MAIN_BRANCH_ID`, so that row has to exist
 * before the first insert or the foreign key rejects it. Most clinics run one location and
 * will never revisit this — that is the point of the default.
 *
 * The explicit `id` is what makes the default correct rather than merely likely: without it
 * MySQL would still assign 1 on a fresh database, but not on one that was seeded, cleared and
 * seeded again.
 *
 * Migration `0001` inserts the same row, and has to: it adds `branch_id DEFAULT 1` to tables
 * that may already hold rows, and MySQL backfills them with 1 before the foreign key is built —
 * which fails outright if no branch exists yet. This function is the other path, for a database
 * brought up with `db:push`, which runs no migrations at all. Both are idempotent, so whichever
 * runs second does nothing.
 */
export async function seedMainBranch(name = 'Main Branch') {
	const [existing] = await db
		.select({ id: branch.id })
		.from(branch)
		.where(eq(branch.id, MAIN_BRANCH_ID))
		.limit(1);

	if (existing) return;

	await db.insert(branch).values({ id: MAIN_BRANCH_ID, name });
}

/**
 * The contact channels a clinic starts with.
 *
 * Seeded rather than left to the admin panel because an empty picker on the first patient is a
 * dead end — the front desk has no reason to guess that Telegram is something they must create
 * before they can record it. These four are what people here actually use; anything else is a
 * row they add themselves, which is the point of the table.
 *
 * Inserted only when the table is completely empty, not row by row. A clinic that deliberately
 * deletes Telegram should not find it back after the next restart.
 */
export async function seedContactTypes() {
	const [existing] = await db.select({ id: contactTypes.id }).from(contactTypes).limit(1);

	if (existing) return;

	await db.insert(contactTypes).values([
		{ name: 'Phone', kind: 'phone', sortOrder: 1 },
		{ name: 'Email', kind: 'email', sortOrder: 2 },
		{ name: 'Telegram', kind: 'username', linkPrefix: 'https://t.me/', sortOrder: 3 },
		{ name: 'WhatsApp', kind: 'phone', linkPrefix: 'https://wa.me/', sortOrder: 4 }
	]);
}

/**
 * The allergens a dental clinic starts with.
 *
 * Seeded for a stronger reason than the contact types were: an empty picker here does not merely
 * inconvenience the front desk, it pushes a clinician to skip recording an allergy at the moment
 * it matters. These are the substances a dental clinic actually meets — the antibiotics and
 * analgesics prescribed after extractions, the local anaesthetics, and the materials in the
 * room.
 *
 * Inserted only when the table is completely empty, so a clinic that curates the list keeps it.
 */
export async function seedAllergens() {
	const [existing] = await db.select({ id: allergen.id }).from(allergen).limit(1);

	if (existing) return;

	await db.insert(allergen).values([
		{ name: 'Penicillin', category: 'medication', sortOrder: 1 },
		{ name: 'Amoxicillin', category: 'medication', sortOrder: 2 },
		{ name: 'Other antibiotics', category: 'medication', sortOrder: 3 },
		{ name: 'Aspirin / NSAIDs', category: 'medication', sortOrder: 4 },
		{ name: 'Paracetamol', category: 'medication', sortOrder: 5 },
		{ name: 'Sulfa drugs', category: 'medication', sortOrder: 6 },
		{ name: 'Lidocaine', category: 'anaesthetic', sortOrder: 10 },
		{ name: 'Articaine', category: 'anaesthetic', sortOrder: 11 },
		{ name: 'Latex', category: 'material', sortOrder: 20 },
		{ name: 'Iodine / antiseptics', category: 'material', sortOrder: 21 },
		{ name: 'Nickel / metals', category: 'material', sortOrder: 22 },
		{ name: 'Acrylic / methacrylate', category: 'material', sortOrder: 23 },
		{ name: 'Eugenol', category: 'material', sortOrder: 24 }
	]);
}

/**
 * The 52 teeth, and one chair.
 *
 * Teeth are reference data, not a clinic's choice — every mouth has the same ones — so they are
 * seeded rather than administered, and `allTeeth()` derives them from the FDI scheme instead of
 * listing them. Nothing can be charted before these rows exist, because `procedure.tooth_id`
 * points at them.
 *
 * The chair is a different kind of default: a guess, made because a clinic with no operatory
 * cannot book anyone, and the first screen they open should not be a configuration screen.
 * Renaming it is a lookup screen away. Both inserts are skipped entirely once their table has
 * anything in it.
 */
export async function seedClinicBasics() {
	const [anyTooth] = await db.select({ id: tooth.id }).from(tooth).limit(1);

	if (!anyTooth) await db.insert(tooth).values(allTeeth());

	const [anyChair] = await db.select({ id: operatory.id }).from(operatory).limit(1);

	if (!anyChair) await db.insert(operatory).values({ name: 'Chair 1', sortOrder: 1 });
}

/**
 * The clinician cadres a dental clinic starts with.
 *
 * Not only dentists. A provider row exists for anyone whose licence the clinic must track or
 * whose work it must attribute, so the list covers the whole floor: the dentist specialties a
 * referral would name, the therapists and hygienists who treat without prescribing, the
 * radiographer whose images are billable procedures in their own right, and the nurses and
 * assistants who are licensed here even when they are never booked directly.
 *
 * Ethiopian licences use their own cadre wording, so this is a starting point to be edited
 * rather than a fixed list — which is the reason it is a table and not an enum.
 */
export async function seedSpecialties() {
	const [existing] = await db.select({ id: providerSpecialty.id }).from(providerSpecialty).limit(1);

	if (existing) return;

	await db.insert(providerSpecialty).values([
		{ name: 'General Dentist', sortOrder: 1 },
		{ name: 'Dental Therapist', sortOrder: 2 },
		{ name: 'Dental Hygienist', sortOrder: 3 },
		{ name: 'Orthodontist', sortOrder: 10 },
		{ name: 'Oral and Maxillofacial Surgeon', sortOrder: 11 },
		{ name: 'Periodontist', sortOrder: 12 },
		{ name: 'Endodontist', sortOrder: 13 },
		{ name: 'Prosthodontist', sortOrder: 14 },
		{ name: 'Paediatric Dentist', sortOrder: 15 },
		{ name: 'Oral and Maxillofacial Radiologist', sortOrder: 16 },

		// Cadres that are licensed and attributable without being booked directly.
		{ name: 'Dental Radiographer', sortOrder: 20 },
		{ name: 'Dental Nurse', sortOrder: 21 },
		{ name: 'Dental Assistant', sortOrder: 22 },
		{ name: 'Anaesthetist', sortOrder: 23 }
	]);
}

/**
 * The visit types a dental clinic starts with, and the slot each one suggests.
 *
 * The durations are the point. A clinic will edit the names to its own vocabulary, but the
 * front desk gets a sane slot length from day one rather than booking every visit at thirty
 * minutes and running late by eleven.
 */
export async function seedAppointmentTypes() {
	const [existing] = await db.select({ id: appointmentType.id }).from(appointmentType).limit(1);

	if (existing) return;

	await db.insert(appointmentType).values([
		{ name: 'Consultation', defaultMinutes: 20, colour: '#0ea5e9', sortOrder: 1 },
		{
			name: 'Examination / Check-up',
			defaultMinutes: 30,
			colour: '#22c55e',
			sortOrder: 2,
			recallIntervalMonths: 6
		},
		{
			name: 'Scaling and Polishing',
			defaultMinutes: 45,
			colour: '#14b8a6',
			sortOrder: 3,
			recallIntervalMonths: 6
		},
		{ name: 'Filling', defaultMinutes: 45, colour: '#6366f1', sortOrder: 4 },
		{ name: 'Extraction', defaultMinutes: 45, colour: '#f97316', sortOrder: 5 },
		{ name: 'Root Canal', defaultMinutes: 90, colour: '#a855f7', sortOrder: 6 },
		{ name: 'Denture / Prosthetic', defaultMinutes: 60, colour: '#8b5cf6', sortOrder: 7 },
		{
			name: 'Orthodontic Adjustment',
			defaultMinutes: 30,
			colour: '#ec4899',
			sortOrder: 8,
			recallIntervalMonths: 1
		},
		{ name: 'Radiograph', defaultMinutes: 15, colour: '#64748b', sortOrder: 9 },
		{ name: 'Review / Follow-up', defaultMinutes: 20, colour: '#84cc16', sortOrder: 10 },
		// Short by design: an emergency slot is triage, and what it finds is booked separately.
		{ name: 'Emergency / Pain', defaultMinutes: 30, colour: '#ef4444', sortOrder: 11 }
	]);
}

/**
 * The medicines a dental clinic here actually writes.
 *
 * Drawn from the Ethiopian Essential Medicines List and from what studies of Ethiopian dental
 * prescribing report being used: amoxicillin far in front, then metronidazole and the
 * co-amoxiclav combination, with paracetamol and diclofenac as the analgesics. Erythromycin and
 * clindamycin are here for the penicillin-allergic patient, which is the case `patient_allergies`
 * exists to make visible at the moment of prescribing.
 *
 * Generic names, because that is what a prescription carries and what a pharmacy dispenses on.
 * `isAntibiotic` is set honestly so a clinic can count its own antibiotic rate — the reason the
 * flag exists at all.
 *
 * A starting formulary, not a fixed one: strengths and forms vary by what is in the shops, so
 * this is seeded once and then owned by the clinic.
 */
export async function seedMedicines() {
	const [existing] = await db.select({ id: medicine.id }).from(medicine).limit(1);

	if (existing) return;

	await db.insert(medicine).values([
		// Antibiotics — the ones dental prescribing here is built on.
		{
			genericName: 'Amoxicillin',
			strength: '500mg',
			form: 'capsule',
			isAntibiotic: true,
			sortOrder: 1
		},
		{
			genericName: 'Amoxicillin suspension',
			strength: '125mg/5ml',
			form: 'suspension',
			isAntibiotic: true,
			notes: 'Paediatric — dose by weight',
			sortOrder: 2
		},
		{
			genericName: 'Amoxicillin + Clavulanic acid',
			strength: '625mg',
			form: 'tablet',
			isAntibiotic: true,
			sortOrder: 3
		},
		{
			genericName: 'Metronidazole',
			strength: '400mg',
			form: 'tablet',
			isAntibiotic: true,
			notes: 'No alcohol during or 48h after',
			sortOrder: 4
		},
		{
			genericName: 'Phenoxymethylpenicillin',
			strength: '500mg',
			form: 'tablet',
			isAntibiotic: true,
			sortOrder: 5
		},
		{
			genericName: 'Erythromycin',
			strength: '500mg',
			form: 'tablet',
			isAntibiotic: true,
			notes: 'For penicillin allergy',
			sortOrder: 6
		},
		{
			genericName: 'Clindamycin',
			strength: '300mg',
			form: 'capsule',
			isAntibiotic: true,
			notes: 'For penicillin allergy',
			sortOrder: 7
		},
		{
			genericName: 'Doxycycline',
			strength: '100mg',
			form: 'capsule',
			isAntibiotic: true,
			notes: 'Not in pregnancy or under 8 years',
			sortOrder: 8
		},

		// Analgesics — paracetamol and diclofenac are what Ethiopian dentists reach for.
		{ genericName: 'Paracetamol', strength: '500mg', form: 'tablet', sortOrder: 20 },
		{
			genericName: 'Paracetamol suspension',
			strength: '120mg/5ml',
			form: 'suspension',
			notes: 'Paediatric — dose by weight',
			sortOrder: 21
		},
		{
			genericName: 'Diclofenac',
			strength: '50mg',
			form: 'tablet',
			notes: 'With food; avoid in peptic ulcer',
			sortOrder: 22
		},
		{
			genericName: 'Ibuprofen',
			strength: '400mg',
			form: 'tablet',
			notes: 'With food',
			sortOrder: 23
		},

		// Topical and local.
		{ genericName: 'Chlorhexidine gluconate', strength: '0.2%', form: 'mouthwash', sortOrder: 40 },
		{
			genericName: 'Lidocaine with adrenaline',
			strength: '2%',
			form: 'injection',
			notes: 'Check cardiac history',
			sortOrder: 41
		},
		{
			genericName: 'Dexamethasone',
			strength: '4mg/ml',
			form: 'injection',
			notes: 'Post-surgical swelling',
			sortOrder: 42
		}
	]);
}

/**
 * The Ethiopian public holidays that fall on a fixed Ethiopian-calendar date, for the Ethiopian
 * year the clinic is set up in.
 *
 * Only the fixed ones. Fasika follows the Orthodox computus, and Eid al-Fitr, Eid al-Adha and
 * Mawlid follow the Islamic calendar — none of them lands on a fixed Ethiopian date, so none can
 * be generated by rule and all four are entered by hand each year. They are deliberately absent
 * rather than approximated: a wrong closure date is worse than a missing one, because it turns
 * patients away on a day the clinic was open.
 *
 * Dates are computed with `ethiopian-calendar-new`, already a dependency, and stored as
 * Gregorian so the diary's overlap check stays a plain indexed range test. The Ethiopian month
 * and day ride along so next year's rows can be generated from these.
 *
 * Seeded, not assumed: a clinic that works through Adwa deletes the row. National holidays are
 * the right default because most businesses close, and a diary that offers slots on Ethiopian
 * Christmas is wrong in the more expensive direction.
 */
export async function seedClinicClosures() {
	const [existing] = await db.select({ id: clinicClosure.id }).from(clinicClosure).limit(1);

	if (existing) return;

	const today = new Date();
	const { year: ethYear } = toEthiopian(today.getFullYear(), today.getMonth() + 1, today.getDate());

	/** Name, Ethiopian month, Ethiopian day. */
	const fixed: [string, number, number][] = [
		['Enkutatash (New Year)', 1, 1],
		['Meskel', 1, 17],
		['Ethiopian Christmas (Genna)', 4, 29],
		['Timkat (Epiphany)', 5, 11],
		['Adwa Victory Day', 6, 23],
		['International Labour Day', 8, 23],
		['Patriots Victory Day', 8, 27],
		['Derg Downfall Day', 9, 20]
	];

	await db.insert(clinicClosure).values(
		fixed.map(([name, ethiopianMonth, ethiopianDay]) => {
			const g = toGregorian(ethYear, ethiopianMonth, ethiopianDay);
			// `toGregorian` returns a 1-based month; `Date` wants it 0-based.
			const on = new Date(g.year, g.month - 1, g.day);

			return {
				name,
				startsOn: on,
				endsOn: on,
				ethiopianMonth,
				ethiopianDay,
				// Null branch: a public holiday closes every branch. See `clinic_closure`.
				branchId: null,
				note: 'Public holiday. Delete this if the clinic works that day.'
			};
		})
	);
}
