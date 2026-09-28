import type { RequestEvent } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';

import { requireSuperAdmin } from '$lib/server/permissions';
import { patientAction } from '$lib/server/patientAction';
import { possibleDuplicates } from '$lib/server/patients';
import { mergePatients } from '$lib/server/patientMerge';
import { mergeForm } from './mergeSchema';

/**
 * Merging a duplicate into the patient whose chart is open — the overview's part of it. The rules
 * are `server/patientMerge.ts`'s; this is who may, what the screen offers, and the action.
 *
 * A super admin's alone (CLAUDE.md §9: it retires a record, which is a delete by another name). The
 * suggestions are the registration check run against this patient, so the same loose match that
 * warns a receptionist is what a manager sees here.
 */

/** The suggestions and the form, for a super admin; null for everyone else. */
export async function loadMerge(
	record: { id: number; name: string; fatherName: string; phone: string | null },
	locals: App.Locals
) {
	if (!locals.isSuperAdmin) return null;
	// Two forms: the row buttons share one, and the search dialog needs its own — handed the same
	// object, superforms saw the dialog as another copy of the last row's form.
	const [duplicates, form, pick] = await Promise.all([
		possibleDuplicates({ name: record.name, fatherName: record.fatherName, phone: record.phone }),
		superValidate(zod4(mergeForm)),
		superValidate(zod4(mergeForm), { id: 'merge-pick' })
	]);
	return { duplicates: duplicates.filter((d) => d.id !== record.id), form, pick };
}

/** The merge action: this chart's patient keeps; the chosen one becomes its tombstone. */
export function mergeAction(event: RequestEvent) {
	requireSuperAdmin(event.locals);
	return patientAction(event, 'patients.edit', mergeForm, async (tx, { patientId, data }) => {
		const moved = await mergePatients(tx, event, {
			survivorId: patientId,
			duplicateId: data.duplicateId
		});
		const rows = Object.values(moved).reduce((sum, n) => sum + n, 0);
		return `Merged. ${rows} record${rows === 1 ? '' : 's'} moved to this chart; the old file number now leads here.`;
	});
}
