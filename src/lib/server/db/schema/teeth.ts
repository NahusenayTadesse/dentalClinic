// teeth.ts - The teeth themselves, as reference data.
import { mysqlTable, mysqlEnum, smallint, tinyint, varchar } from 'drizzle-orm/mysql-core';
// Relative, not `$lib/…`: drizzle-kit loads the schema without SvelteKit's aliases.
import { teethInQuadrant, toothName, toothType } from '../../../teeth';

/**
 * One tooth, identified by its FDI (ISO 3950) two-digit code.
 *
 * **FDI, not the Universal 1–32 numbering.** Universal is the American system; FDI is used in
 * every other country and is what Ethiopian dentists are trained on. It also survives contact
 * with a database better: the first digit is the quadrant and the second the position from the
 * midline, so "every upper right tooth" or "every second molar" is arithmetic on the code rather
 * than a lookup table of exceptions. Primary teeth reuse the scheme in quadrants 5–8, which is
 * why a child's chart needs no separate representation.
 *
 * **The FDI code *is* the primary key.** No surrogate id: the code is already unique, already
 * stable for the lifetime of dentistry, and already what a dentist says out loud. A `tooth_id`
 * of 11 that means tooth 11 is one less join and one less thing to get wrong when reading raw
 * rows — which is the point of coding teeth in the first place.
 *
 * **No `secureFields`.** The only table in the schema without them, deliberately. Human dentition
 * is not business data: nobody creates a tooth, nobody soft-deletes one, and there is no author
 * to attribute. Audit columns here would be five columns of nulls implying an editability that
 * does not exist. Rows are seeded once and never change.
 */
export const tooth = mysqlTable('tooth', {
	/** The FDI code: 11–18, 21–28, 31–38, 41–48 permanent; 51–55, 61–65, 71–75, 81–85 primary. */
	id: smallint('id').primaryKey(),

	/** 'Upper right central incisor' — for anyone reading a chart or a report. */
	name: varchar('name', { length: 50 }).notNull(),

	/** First digit of the code. 1–4 permanent, 5–8 primary, clockwise from the patient's upper right. */
	quadrant: tinyint('quadrant').notNull(),

	/** Second digit: distance from the midline, 1 at the centre. */
	position: tinyint('position').notNull(),

	dentition: mysqlEnum('dentition', ['permanent', 'primary']).notNull(),

	/** Grouping a clinician thinks in — "the molars", "the anteriors". Derived from position. */
	toothType: mysqlEnum('tooth_type', ['incisor', 'canine', 'premolar', 'molar']).notNull()
});

export type ToothRow = typeof tooth.$inferInsert;

/**
 * Every tooth, generated rather than typed out.
 *
 * Fifty-two near-identical rows written by hand is fifty-two chances to put a canine in the
 * wrong quadrant, and the mistake would be invisible until a dentist charted the wrong tooth.
 * The FDI scheme is regular by construction, so deriving the rows from it cannot drift.
 */
export function allTeeth(): ToothRow[] {
	const rows: ToothRow[] = [];

	for (const quadrant of [1, 2, 3, 4, 5, 6, 7, 8] as const) {
		for (let position = 1; position <= teethInQuadrant(quadrant); position++) {
			const id = quadrant * 10 + position;
			rows.push({
				id,
				name: toothName(id),
				quadrant,
				position,
				dentition: quadrant >= 5 ? 'primary' : 'permanent',
				toothType: toothType(id)
			});
		}
	}

	return rows;
}
