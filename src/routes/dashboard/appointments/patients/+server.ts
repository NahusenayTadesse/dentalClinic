import { json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { branch, patient } from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';
import { flagsFor, livePatient, patientFullName, patientSearch } from '$lib/server/patients';
import type { RequestHandler } from './$types';

/**
 * Patient search for the booking form's picker.
 *
 * Gated by the route rule it sits under (`appointments.view`): whoever may open the diary may find
 * the patient to put in it. **Searches every branch** — this is a deliberate search for a named
 * person, the case CLAUDE.md §15 keeps unscoped — and says which branch each result is from.
 *
 * Returns at most ten, and nothing for fewer than two characters: the picker is for finding one
 * person, and an empty query listing the roster is exactly the bulk read the list's branch scope
 * exists to avoid.
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	const q = (url.searchParams.get('q') ?? '').trim();
	if (q.length < 2) return json([]);

	const rows = await db
		.select({
			id: patient.id,
			name: patientFullName,
			fileNo: patient.fileNo,
			phone: patient.phone,
			branchId: patient.branchId,
			branch: branch.name
		})
		.from(patient)
		.leftJoin(branch, and(eq(branch.id, patient.branchId), notDeleted(branch)))
		.where(and(livePatient(), patientSearch(q)))
		.limit(10);

	const flags = await flagsFor(rows.map((r) => r.id));

	return json(
		rows.map((row) => ({
			...row,
			severeAllergies:
				flags
					.get(row.id)
					?.allergies.filter((a) => a.severity === 'severe')
					.map((a) => a.name) ?? [],
			fromOtherBranch:
				locals.branch.active !== null &&
				row.branchId !== null &&
				row.branchId !== locals.branch.active
		}))
	);
};
