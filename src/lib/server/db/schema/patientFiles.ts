// patientFiles.ts - What is attached to a patient: radiographs, photographs, paper.
import { mysqlTable, mysqlEnum, varchar, int, smallint, date, index } from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';
import { secureFields } from './secureFields';
import { patient } from './patients';
import { tooth } from './teeth';
import { appointment } from './scheduling';
// Relative, not `$lib/…`: drizzle-kit loads the schema without SvelteKit's aliases.
import { PROJECTIONS } from '../../../radiographs';

/**
 * A stored file, attached to the patient it belongs to.
 *
 * This is the table CLAUDE.md §9 says is owed. `/dashboard/files/[name]` can only check that the
 * caller is signed in, because the store is flat and a filename records nothing about what it is
 * attached to — the 122-bit random name stands in for a permission check. A row here is what
 * lets that route ask whether this caller may see *this patient's* files, which is the
 * difference between a URL that is hard to guess and one that is actually protected. The route
 * is not changed here; the record it needs now exists.
 *
 * `paperRecord` is the kind that matters most in the first year. Clinics here run paper and
 * screen side by side for a long time, and the realistic way an old chart gets into the system
 * is a phone photograph of it, taken at the desk — not a scanner. `takenOn` exists for exactly
 * that case: the photograph is from today, the record in it is from 2019, and filing it under
 * today's date loses the only thing that made it worth keeping.
 */
export const patientFile = mysqlTable(
	'patient_file',
	{
		id: int('id').primaryKey().autoincrement(),

		patientId: int('patient_id')
			.notNull()
			.references(() => patient.id, { onDelete: 'cascade' }),

		/** The visit it came from, where there was one. */
		appointmentId: int('appointment_id').references(() => appointment.id, {
			onDelete: 'set null'
		}),

		kind: mysqlEnum('kind', [
			'radiograph',
			'photo',
			'consent',
			'referral',
			'labResult',
			'paperRecord',
			'other'
		])
			.notNull()
			.default('other'),

		/**
		 * The name in the file store, produced by `saveUploadedFile` in `server/files.ts`. Random
		 * and meaningless by design — never build a path from this yourself, and never trust a
		 * name that did not come from there.
		 */
		storedName: varchar('stored_name', { length: 255 }).notNull(),

		/** What the file was called when it arrived, for showing a human something recognisable. */
		originalName: varchar('original_name', { length: 255 }),

		mimeType: varchar('mime_type', { length: 100 }),

		/**
		 * Recorded because bandwidth is the expensive part here, not disk. A clinic on a slow
		 * connection needs to be able to see which patients are carrying fifty megabytes of
		 * uncompressed phone photographs before the backup starts failing.
		 */
		sizeBytes: int('size_bytes'),

		/**
		 * What kind of film, for a radiograph — periapical, bitewing, panoramic… Null for anything
		 * else, and for radiographs attached before it was asked. The viewer compares a film with
		 * the last one of the same projection (`$lib/radiographs.ts`).
		 */
		projection: mysqlEnum('projection', PROJECTIONS),

		/**
		 * Which tooth, for a periapical or bitewing of one. Null for a panoramic, a face
		 * photograph or anything that is not of a single tooth.
		 */
		toothId: smallint('tooth_id').references(() => tooth.id),

		/**
		 * When the image was made or the paper was written — not when it was uploaded, which is
		 * `createdAt`. The two differ by years for a photographed chart.
		 */
		takenOn: date('taken_on'),

		description: varchar('description', { length: 255 }),

		...secureFields
	},
	(table) => [
		index('patient_file_patient_kind_idx').on(table.patientId, table.kind),
		index('patient_file_appointment_idx').on(table.appointmentId),
		index('patient_file_tooth_idx').on(table.toothId),
		// The lookup the file route needs: given a stored name, whose file is this?
		index('patient_file_stored_name_idx').on(table.storedName)
	]
);

export const patientFileRelations = relations(patientFile, ({ one }) => ({
	patient: one(patient, { fields: [patientFile.patientId], references: [patient.id] }),
	appointment: one(appointment, {
		fields: [patientFile.appointmentId],
		references: [appointment.id]
	}),
	tooth: one(tooth, { fields: [patientFile.toothId], references: [tooth.id] })
}));
