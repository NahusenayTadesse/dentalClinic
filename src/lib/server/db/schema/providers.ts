// providers.ts - The clinicians: who may treat, and who may be booked.
import { mysqlTable, varchar, int, date, boolean, unique, index } from 'drizzle-orm/mysql-core';
import { relations, sql } from 'drizzle-orm';
import { secureFields } from './secureFields';
import { employee } from './staff';

/**
 * What a clinician is qualified as — general dentist, orthodontist, oral surgeon, dental
 * therapist.
 *
 * A lookup rather than an enum because the cadre names on an Ethiopian licence are not the
 * Western specialty list: "Dental Therapist" and "Health Officer" are real, licensable cadres
 * here with no equivalent abroad, and what the clinic records should match the wording on the
 * document in the file. A clinic that hires one adds a row.
 *
 * Distinct from `position` and `department`, which are HR: `position` is the job and its pay
 * grade, this is what the regulator says the person may do. A clinic can have one orthodontist
 * on two different positions over a career without their specialty changing.
 */
export const providerSpecialty = mysqlTable('provider_specialty', {
	id: int('id').primaryKey().autoincrement(),
	name: varchar('name', { length: 80 }).notNull().unique(),
	description: varchar('description', { length: 255 }),
	sortOrder: int('sort_order').notNull().default(0),
	...secureFields
});

/**
 * An employee who treats patients — of any cadre, not only dentists.
 *
 * Nothing in this table is dental: `specialty` is a foreign key into an editable lookup, and the
 * licence columns, the diary columns and the two authority flags mean the same thing for a
 * nurse, a radiographer or an anaesthetist as for an oral surgeon. A clinic gives a provider row
 * to anyone whose licence it must track or whose work it must attribute, and switches off the
 * parts that do not apply: a radiographer is `canPrescribe: false` but still attributable on the
 * `procedures` row for the radiograph they took; a nurse is usually also `isBookable: false`,
 * since patients book the dentist, not the nurse who assists.
 *
 * **Why this is not more columns on `employee`.** That table is HR: it is already 26 columns and
 * is joined by leave, payroll, pension, guarantors and terminations. The fields below are null
 * for the receptionist, the cleaner and the accountant, and a sparse block of clinical columns
 * on a table that most rows use for something else is how a schema stops being readable.
 *
 * More usefully, **the row itself is the answer to "may this person be booked".** Rather than a
 * boolean on `employee` that every query has to remember to check, `appointment.provider_id` and
 * `procedures.provider_id` point here — so a foreign key, not a convention, is what stops an
 * appointment being booked to the accountant.
 *
 * One row per employee, enforced below. This is a role an employee holds, not a second identity:
 * name, phone, address, photo, salary and leave all stay on `employee` and are not repeated.
 *
 * Non-goals, each already owned by something else and deliberately not repeated here:
 *
 *   qualifications and education  `qualification` — field, level, school, graduation, certificate
 *   which days and hours they work `staff_schedule` — weekday, start and end time, already
 *                                 CHECK-constrained to real days. A provider's bookable hours are
 *                                 their working hours; a second availability table would be the
 *                                 same fact in two places.
 *   commission and pay            `salaries.officeCommission` and `salaries.percentage`, with the
 *                                 computed figures on `payroll_entries`. A rate here would be a
 *                                 third home for one number.
 *
 * This table is the licence and the diary, and nothing that another table already knows.
 */
export const provider = mysqlTable(
	'provider',
	{
		id: int('id').primaryKey().autoincrement(),

		employeeId: int('employee_id')
			.notNull()
			.references(() => employee.id, { onDelete: 'cascade' }),

		specialtyId: int('specialty_id').references(() => providerSpecialty.id),

		/**
		 * The licence to practise, issued by the Ministry of Health's regulatory office or a
		 * regional health bureau.
		 *
		 * `licenceExpiresOn` is the column that earns this table. Ethiopian licences are renewable,
		 * and treating patients on an expired one puts the clinic in breach — so "whose licence
		 * lapses in the next sixty days" has to be a query the system can answer before the
		 * regulator asks it. Indexed for exactly that.
		 *
		 * All nullable: a clinic will enter staff before it has gathered their paperwork, and a
		 * system that refuses to record a dentist until someone finds the certificate is a system
		 * that gets worked around.
		 */
		licenceNumber: varchar('licence_number', { length: 64 }),
		licenceIssuedOn: date('licence_issued_on'),
		licenceExpiresOn: date('licence_expires_on'),
		/** Which body issued it — "FMOH", "Oromia Regional Health Bureau". */
		licenceBody: varchar('licence_body', { length: 100 }),

		/**
		 * How this person is addressed on anything the clinic prints — a prescription, a
		 * certificate, a referral letter.
		 *
		 * A stored value rather than "Dr." hardcoded at the point of printing, because it is not
		 * true of everyone in this table: a hygienist, a therapist, a radiographer and a nurse are
		 * not doctors, and printing them as one on a document that leaves the building is a
		 * misrepresentation of a licensed cadre. Deriving it from `specialty` was the alternative
		 * and is worse — it puts a presentation rule inside clinical reference data and still
		 * needs an override the first time a clinic disagrees.
		 *
		 * Separate from `abbreviation` below: that is a label squeezed into a column heading,
		 * this is part of a name on a printed page.
		 */
		title: varchar('title', { length: 10 }),

		/**
		 * Initials for the appointment grid — "Dr M.T.". A day view is dense enough that a full
		 * Ethiopian three-part name does not fit in a column heading.
		 */
		abbreviation: varchar('abbreviation', { length: 12 }),

		/**
		 * Hex colour for this provider's column in the day view. The one legitimate use of an
		 * inline style per CLAUDE.md §7 — a value computed from data, not styling that could be a
		 * class.
		 */
		colour: varchar('colour', { length: 7 }),

		/**
		 * Whether new appointments may be booked to this person. Distinct from soft delete and
		 * from `employee.isActive`: a dentist on three months' leave, or one who now only
		 * supervises, should keep every past appointment and disappear from the booking picker.
		 */
		isBookable: boolean('is_bookable').notNull().default(true),

		/** An oral surgeon's default slot is not a hygienist's. Minutes. */
		defaultAppointmentMinutes: int('default_appointment_minutes').notNull().default(30),

		/**
		 * Whether this person may prescribe. Not every clinician can: therapists, hygienists,
		 * nurses and radiographers treat or image without prescribing authority, and the
		 * distinction is the regulator's rather than the clinic's.
		 *
		 * **Defaults to false**, unlike the other flags here, because it grants an authority
		 * rather than describing a preference. A dentist row that nobody ticked fails safe — the
		 * first prescription is refused and someone fixes the record — where a nurse row that
		 * nobody unticked fails the other way, and the record would say a nurse prescribed.
		 */
		canPrescribe: boolean('can_prescribe').notNull().default(false),

		/** "Mondays and Thursdays only", "no surgical lists after 4pm". Prose, for the front desk. */
		scheduleNote: varchar('schedule_note', { length: 255 }),

		/**
		 * A scan of the practising licence, stored through `server/files.ts` like every other file
		 * and named here by the same `varchar(255)` convention as `employee.photo`,
		 * `employee.govtId` and `qualification.certificate`.
		 *
		 * Not the same document as `qualification.certificate`, which is the degree: one says
		 * where they trained, this says they may practise today. An inspector asks for the second
		 * one, and `licenceExpiresOn` above is only as trustworthy as the paper behind it.
		 */
		licenceDocument: varchar('licence_document', { length: 255 }),

		/**
		 * One live provider row per employee, enforced in the database. Same generated-column
		 * trick as `patient_allergies.live_key` and for the same reason: a plain
		 * `unique(employee_id)` would make a soft-deleted provider impossible to reinstate, and
		 * staff leaving and returning is common. Null once deleted, so any number of dead rows
		 * coexist while only one live row is allowed. Never write to it.
		 */
		liveEmployeeKey: int('live_employee_key').generatedAlwaysAs(
			(): ReturnType<typeof sql> => sql`(if(\`deleted_at\` is null, \`employee_id\`, null))`,
			{ mode: 'virtual' }
		),

		...secureFields
	},
	(table) => [
		unique('provider_live_employee_unique').on(table.liveEmployeeKey),
		// "Whose licence expires soon" — the query this table exists to make answerable.
		index('provider_licence_expiry_idx').on(table.licenceExpiresOn),
		index('provider_specialty_idx').on(table.specialtyId)
	]
);

export const providerSpecialtyRelations = relations(providerSpecialty, ({ many }) => ({
	providers: many(provider)
}));

export const providerRelations = relations(provider, ({ one }) => ({
	employee: one(employee, { fields: [provider.employeeId], references: [employee.id] }),
	specialty: one(providerSpecialty, {
		fields: [provider.specialtyId],
		references: [providerSpecialty.id]
	})
}));
