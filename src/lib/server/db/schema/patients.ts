// patients.ts - The people the clinic treats.
import {
	mysqlTable,
	mysqlEnum,
	varchar,
	int,
	date,
	datetime,
	boolean,
	text,
	index,
	type AnyMySqlColumn
} from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';
import { secureFields } from './secureFields';
import { user } from './user';
import { address } from './locations';
import { branchRef } from './branches';
import { customers } from './customers';

/**
 * How a patient came to the clinic.
 *
 * A lookup rather than free text because the only reason to record it is to count it: "twenty
 * three from word of mouth, eight from the sign, four referred by Dr Tesfaye" is the question,
 * and a text box answers none of it. It is also the one marketing number a clinic with no
 * marketing budget can actually act on.
 *
 * Editable, because the sources are local. A practice on a main road lives off its board; one in
 * a compound lives off word of mouth; one near a hospital lives off referrals.
 */
export const referralSource = mysqlTable('referral_source', {
	id: int('id').primaryKey().autoincrement(),
	name: varchar('name', { length: 80 }).notNull().unique(),
	description: varchar('description', { length: 255 }),
	sortOrder: int('sort_order').notNull().default(0),
	...secureFields
});

/**
 * A patient.
 *
 * Deliberately a new table rather than a rename of `customers`. The two coexist and mean
 * different things: `customers` is a corporate billing party — an employer or insurer that
 * settles an account — while a patient is a person who is treated. One patient may be billed
 * through a customer, many are not billed through one at all, and a customer is never treated.
 *
 * Deliberately **not** carrying `approvalFields`, unlike `employee` and `customers`. Registering
 * a patient is a front-desk act that happens with someone waiting at the window; putting it
 * behind a maker-checker queue would mean nobody can be treated until a supervisor logs in.
 * Clinical and financial records about the patient can be approved; the patient's existence
 * cannot usefully be.
 *
 * Non-goals: this table says who someone is, not what was done to them. Appointments, treatment
 * history, odontogram findings and payments are their own tables and point back here.
 *
 * Allergies were briefly a `text` column here and are now `patient_allergies`; conditions
 * followed them into `patient_conditions` once it became clear the clinic must report patient
 * counts per condition. Both for the same reason: a count cannot be taken from prose.
 * `medicalNotes` below is what is left over — see the note on it.
 *
 * Ways to reach the patient live in `patient_contacts`, and emergency contacts in
 * `patient_emergency_contacts` — both in `contacts.ts`. An earlier version of this table
 * carried one emergency contact inline on the argument that there is only ever one. There is
 * not: a child has two parents, and the first number often does not answer. `phone` below
 * stays here regardless, because it is the index the front desk searches.
 */
export const patient = mysqlTable(
	'patient',
	{
		id: int('id').primaryKey().autoincrement(),

		/**
		 * The number the clinic says out loud and writes on the paper chart.
		 *
		 * Separate from `id` on purpose: `id` is ours and meaningless to staff, while this is
		 * assigned by the clinic and may follow a scheme they already use on paper. Most clinics
		 * here run paper and screen side by side for years, so the number has to survive the
		 * trip between them. Unique, and nullable only so a walk-in can be registered before the
		 * number is written.
		 */
		fileNo: varchar('file_no', { length: 32 }).unique(),

		/**
		 * Ethiopian names are given name + father's name + grandfather's name; there is no
		 * family name, so none of these is a "surname" and they must not be collapsed into one
		 * column. `grandFatherName` is nullable where `employee`'s is not: an employee fills in a
		 * form at leisure, a patient is often in pain at the front desk, and refusing to register
		 * someone over a third name is not a trade this app should make.
		 */
		name: varchar('name', { length: 50 }).notNull(),
		fatherName: varchar('father_name', { length: 50 }).notNull(),
		grandFatherName: varchar('grand_father_name', { length: 50 }),

		/**
		 * `sex`, not `gender` as on `employee`. This column exists for clinical reasons — drug
		 * dosing, radiography and pregnancy questions all key off it — so it records the
		 * clinical fact rather than how someone identifies.
		 */
		sex: mysqlEnum('sex', ['male', 'female']).notNull(),

		/**
		 * Nullable, with a flag, because a great many adult Ethiopians do not know their exact
		 * date of birth — the honest answer is an approximate year.
		 *
		 * One column plus a flag rather than a second `age` column: age must always be derived
		 * from one place, or the two drift and nobody knows which to trust. `birthDate` null and
		 * `birthDateEstimated` false means nobody has asked yet; a date with the flag set means
		 * the year is roughly right and the day is not. Clinically the difference matters most
		 * for children, where dosing follows age closely.
		 */
		birthDate: date('birth_date'),
		birthDateEstimated: boolean('birth_date_estimated').notNull().default(false),

		/**
		 * The main way the clinic reaches a patient, and the field the front desk searches by far
		 * more often than by name — hence the index. Nullable and not unique on purpose: some
		 * patients have no phone, and a household or a workplace commonly shares one number
		 * across several patients.
		 */
		phone: varchar('phone', { length: 20 }),
		altPhone: varchar('alt_phone', { length: 20 }),

		/**
		 * The patient asked not to be sent text messages. Reminders and recalls skip them and say so
		 * on the list; the desk can still ring. A flag on the patient rather than per phone number,
		 * because it is the person who said no.
		 */
		smsOptOut: boolean('sms_opt_out').notNull().default(false),

		bloodType: mysqlEnum('blood_type', ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),

		/**
		 * Free-text medical history, and by now genuinely the residue.
		 *
		 * The three things that used to live here have each become a table, in the order their
		 * absence started to hurt: allergies to `patient_allergies`, diagnoses to
		 * `patient_conditions` once a count had to be reported, and current medicines to
		 * `patient_medications` once it became clear a dentist needs to know about warfarin and
		 * bisphosphonates regardless of what conditions are recorded.
		 *
		 * What is left is narrative that belongs to none of them — a family history, a surgery in
		 * 2019, something the patient mentioned that has no code. Worth keeping, and worth *not*
		 * filling with anything the three tables can hold, because prose cannot be counted,
		 * filtered, or shown as a warning at the chair.
		 */
		medicalNotes: text('medical_notes'),

		/**
		 * When the medical history was last taken or reviewed, and by whom.
		 *
		 * Set only when someone actually asks the questions. It is what makes an empty
		 * `patient_allergies` list mean "asked, nothing reported" instead of "nobody asked", and
		 * it is what tells a clinician a year later that the history is stale and worth
		 * repeating. Without it, no rows is indistinguishable from no questions.
		 *
		 * `datetime`, not `timestamp` — see CLAUDE.md §9.
		 */
		historyTakenAt: datetime('history_taken_at'),
		historyTakenBy: varchar('history_taken_by', { length: 255 }).references(() => user.id, {
			onDelete: 'set null'
		}),

		address: int('address').references(() => address.id, { onDelete: 'set null' }),

		/** Stored through `server/files.ts`, like every other file. Rarely filled in. */
		photo: varchar('photo', { length: 255 }),

		/**
		 * How they found the clinic. **Nullable, and expected to stay empty often** — it is asked
		 * at registration when there is time, and a patient in pain at the desk is not the moment
		 * to insist. A required field here would be answered with whatever is first in the list,
		 * which is worse than nothing because it looks like data.
		 */
		referralSourceId: int('referral_source_id').references(() => referralSource.id, {
			onDelete: 'set null'
		}),

		/**
		 * Who specifically, when the source was a person — "Dr Tesfaye at Bethel", "her sister
		 * Almaz". Free text on purpose: referring dentists are not in this database and the
		 * neighbour who recommended the clinic never will be, but knowing the name is what lets a
		 * clinic say thank you.
		 */
		referredBy: varchar('referred_by', { length: 150 }),

		/**
		 * The corporate account that settles this patient's bills, when one does — an employer
		 * or an insurer. Null is the common case: most patients pay cash at the desk.
		 *
		 * `set null` rather than `restrict` or `cascade`: a company ending its arrangement with
		 * the clinic must not delete its employees' dental records, nor be blocked from being
		 * removed because they exist.
		 */
		customerId: int('customer_id').references(() => customers.id, { onDelete: 'set null' }),

		/**
		 * The record this one was merged into, when it turned out to be the same person twice.
		 *
		 * **The most likely way this system hurts somebody.** A patient loses their card — which
		 * the Ministry's own electronic catalogue exists partly to solve, duplicate MRNs and lost
		 * cards being the named problems — and is registered again under a new file number. Their
		 * penicillin allergy is now on the old record and today's prescription is written against
		 * the new one, where the allergy list is empty and looks like "none reported". Nothing in
		 * the schema was stopping that.
		 *
		 * A merge re-points the child rows — allergies, files, notes, appointments, invoices — onto
		 * the surviving record, and leaves this one as a tombstone. The tombstone is the part that
		 * matters and the reason the old row is not deleted: the old file number is written on
		 * paper charts, on a card in someone's pocket, and on a receipt, and looking it up has to
		 * keep arriving at the right person years later.
		 *
		 * Kept shallow on purpose. Every lookup follows this pointer at most once, so a merged
		 * record must never itself be merged again — point it at the final survivor instead. The
		 * alternative is a recursive join on the most common query in the app, and a cycle nobody
		 * notices until two records point at each other.
		 *
		 * The re-pointing is the app's work; what the schema owns is the record that it happened.
		 */
		mergedIntoId: int('merged_into_id').references((): AnyMySqlColumn => patient.id, {
			onDelete: 'set null'
		}),
		mergedAt: datetime('merged_at'),

		/**
		 * The branch this patient is registered at. See `branchRef` — nullable and defaulting to
		 * the main branch, so a single-branch clinic never sees the field. It records where the
		 * patient's chart lives, not where they may be treated: a patient registered at one
		 * branch can be seen at another.
		 */
		branchId: branchRef(),

		...secureFields
	},
	(table) => [
		// Merged records must drop out of search and every picker — a front desk that can still
		// book the tombstone has gained a third copy of the patient rather than lost one.
		index('patient_merged_idx').on(table.mergedIntoId),
		// The three ways the front desk actually looks someone up, in order of how often.
		index('patient_phone_idx').on(table.phone),
		index('patient_name_idx').on(table.name, table.fatherName),
		index('patient_branch_idx').on(table.branchId)
	]
);

export const patientRelations = relations(patient, ({ one }) => ({
	address: one(address, { fields: [patient.address], references: [address.id] }),
	customer: one(customers, { fields: [patient.customerId], references: [customers.id] })
}));
