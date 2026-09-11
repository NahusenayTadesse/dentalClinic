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
	index
} from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';
import { secureFields } from './secureFields';
import { user } from './user';
import { address } from './locations';
import { branchRef } from './branches';
import { customers } from './customers';

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
 * Allergies were briefly a `text` column here and are now `patient_allergies` — coded, so that
 * "who reacts to penicillin" is a join rather than a `LIKE`. `medicalNotes` below stays prose
 * deliberately, and the same argument applies to it: the day someone needs to list every
 * diabetic patient, conditions earn their own table too.
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

		bloodType: mysqlEnum('blood_type', ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),

		/**
		 * Conditions that change dental treatment: diabetes, hypertension, cardiac history,
		 * bleeding disorders, hepatitis, HIV, pregnancy, current medication.
		 *
		 * Still prose, unlike allergies, and the difference is what gets asked of it. Allergies
		 * are queried across patients — a recall, a checked afternoon list — so the substance had
		 * to become a row. Conditions are read one patient at a time, by the clinician about to
		 * treat them. When that stops being true, this becomes a table the same way.
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
		 * The corporate account that settles this patient's bills, when one does — an employer
		 * or an insurer. Null is the common case: most patients pay cash at the desk.
		 *
		 * `set null` rather than `restrict` or `cascade`: a company ending its arrangement with
		 * the clinic must not delete its employees' dental records, nor be blocked from being
		 * removed because they exist.
		 */
		customerId: int('customer_id').references(() => customers.id, { onDelete: 'set null' }),

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
