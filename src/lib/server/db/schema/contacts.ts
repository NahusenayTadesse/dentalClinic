// contacts.ts - How to reach a patient, and who to call about them.
import {
	mysqlTable,
	mysqlEnum,
	varchar,
	int,
	boolean,
	unique,
	index
} from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';
import { secureFields } from './secureFields';
import { patient } from './patients';

/**
 * The channels a clinic can record against a patient — Email, Telegram, WhatsApp, Viber.
 *
 * A lookup table rather than the `varchar(50)` that `staff_contacts` and `customer_contacts`
 * use, because free text made those columns unextendable in the only way that matters: nothing
 * downstream can tell an email from a Telegram handle, so nothing can validate one, render it
 * as a link, or count them. Three spellings of "whatsapp" become three channels.
 *
 * `kind` and `linkPrefix` are what make this genuinely extendable. Adding Viber is a row in the
 * admin panel — it arrives already validated as a phone number and already clickable — rather
 * than a migration and a deploy. That distinction matters here: these clinics do not have a
 * developer on call, and the competition is a paper book.
 *
 * Named `contact_types`, not `patient_contact_types`: `staff_contacts` and `customer_contacts`
 * are the same idea with a different owner and should migrate onto this table rather than grow
 * a second copy of it (CLAUDE.md §2). Not done here — that is their own change.
 */
export const contactTypes = mysqlTable('contact_types', {
	id: int('id').primaryKey().autoincrement(),
	name: varchar('name', { length: 50 }).notNull().unique(),

	/**
	 * What the value *is*, which is how the UI knows to validate and render it:
	 *
	 *   `email`    — validate as an address, link as `mailto:`
	 *   `phone`    — validate as a number, link as `tel:`
	 *   `username` — a handle with no meaning on its own; the link is `linkPrefix` + the value
	 *   `url`      — the value is already a full address
	 *
	 * Four kinds, not one per app: a new messenger is almost always a `username` behind a
	 * different prefix, and that is the case this column exists to make free.
	 */
	kind: mysqlEnum('kind', ['email', 'phone', 'username', 'url']).notNull().default('username'),

	/**
	 * Joined to the value to make a working link — `https://t.me/`, `https://wa.me/`. Null for
	 * `email` and `phone`, whose scheme is implied, and for `url`, where the value is complete.
	 */
	linkPrefix: varchar('link_prefix', { length: 120 }),

	description: varchar('description', { length: 255 }),

	/** Display order in the picker, so a clinic can put what it actually uses at the top. */
	sortOrder: int('sort_order').notNull().default(0),

	...secureFields
});

/**
 * The ways a patient has agreed to be reached, beyond the phone number on the patient record.
 *
 * **`patient.phone` is not one of these rows.** That column is the number the clinic calls and
 * the index the front desk searches by; it stays where it is because a join is the wrong price
 * for the most common query in the app. This table is *everything else*, and recording the
 * primary phone here as well would give two answers to one question — the same trap the
 * birth-date note on `patient` describes.
 *
 * Optional by design: the patient volunteers these or does not, and none is required to be
 * treated.
 */
export const patientContacts = mysqlTable(
	'patient_contacts',
	{
		id: int('id').primaryKey().autoincrement(),
		patientId: int('patient_id')
			.notNull()
			.references(() => patient.id, { onDelete: 'cascade' }),

		/**
		 * `restrict`, not `set null`: a contact whose channel is unknown is an unusable string.
		 * Retiring a channel is a soft delete on the type, which leaves existing rows readable.
		 */
		contactTypeId: int('contact_type_id')
			.notNull()
			.references(() => contactTypes.id),

		/** The address, handle or number itself. Interpreted according to the type's `kind`. */
		value: varchar('value', { length: 255 }).notNull(),

		/** "Work", "Mother's phone" — free text, and usually empty. */
		label: varchar('label', { length: 50 }),

		/**
		 * Which one to try first within a channel. Not enforced by a unique index: MySQL has no
		 * partial index, so "one primary per patient" is a server-side rule the write path owns.
		 * Two primaries render as two primaries; nothing breaks.
		 */
		isPrimary: boolean('is_primary').notNull().default(false),

		...secureFields
	},
	(table) => [
		index('patient_contacts_patient_idx').on(table.patientId),
		// The same handle twice on the same channel is a double entry, not a second contact.
		unique('patient_contacts_unique').on(table.patientId, table.contactTypeId, table.value)
	]
);

/**
 * Who to call if something goes wrong during treatment.
 *
 * One-to-many, replacing the three inline columns this table was carved out of. The inline
 * version was defended as "there is exactly one of these" — which is wrong often enough to
 * matter: a child has two parents, an elderly patient has a son in Addis and a daughter abroad,
 * and the first number frequently does not answer. The cost is a join on the patient screen,
 * paid deliberately.
 *
 * `phone` is `notNull` where almost everything else about a patient is nullable. An emergency
 * contact with no number is not a contact, and a row that cannot serve its one purpose is worse
 * than an empty list — it looks like cover.
 *
 * Non-goal: this is not a next-of-kin or guardian record for consent. If consent to treat a
 * minor ever needs recording, that is a separate thing with its own rules, not a flag here.
 */
export const patientEmergencyContacts = mysqlTable(
	'patient_emergency_contacts',
	{
		id: int('id').primaryKey().autoincrement(),
		patientId: int('patient_id')
			.notNull()
			.references(() => patient.id, { onDelete: 'cascade' }),

		name: varchar('name', { length: 100 }).notNull(),

		/**
		 * Free text, deliberately, where `contactTypes` above is a lookup. The split is not
		 * inconsistency: a channel is a closed set the clinic controls and the UI must interpret,
		 * while a relationship is whatever the patient says — "her neighbour's son", "the man who
		 * brought her in". A required picker here would be answered "other" and the real answer
		 * lost, which is the same reasoning as the free-text `allergies` column.
		 */
		relation: varchar('relation', { length: 50 }),

		phone: varchar('phone', { length: 20 }).notNull(),
		altPhone: varchar('alt_phone', { length: 20 }),

		/** Who to try first. Same non-enforcement note as `patientContacts.isPrimary`. */
		isPrimary: boolean('is_primary').notNull().default(false),

		...secureFields
	},
	(table) => [index('patient_emergency_patient_idx').on(table.patientId)]
);

export const contactTypesRelations = relations(contactTypes, ({ many }) => ({
	patientContacts: many(patientContacts)
}));

export const patientContactsRelations = relations(patientContacts, ({ one }) => ({
	patient: one(patient, { fields: [patientContacts.patientId], references: [patient.id] }),
	contactType: one(contactTypes, {
		fields: [patientContacts.contactTypeId],
		references: [contactTypes.id]
	})
}));

export const patientEmergencyContactsRelations = relations(patientEmergencyContacts, ({ one }) => ({
	patient: one(patient, { fields: [patientEmergencyContacts.patientId], references: [patient.id] })
}));
