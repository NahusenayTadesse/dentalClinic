import { error } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';

import { hasPermission } from '$lib/server/permissions';
import { logPatientView } from '$lib/server/patients';
import { patientAction } from '$lib/server/patientAction';
import {
	PERIO_PERMISSION,
	discardExam,
	finishExam,
	perioExamDetail,
	saveReadings
} from '$lib/server/perio';
import { examStep, saveExam } from '../schema';
import type { Actions, PageServerLoad } from './$types';

/** The exam id from the path, or a 404 — never a query for `NaN`. */
function examIdParam(raw: string): number {
	const id = Number(raw);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Exam not found');
	return id;
}

/**
 * One periodontal exam: the grid, with the finished exam before it shown beside each reading.
 * A draft is filled in, saved as often as the clinician likes, and finished; a finished exam is
 * read only. Every step re-checks the exam is this patient's and still a draft
 * (`server/perio.ts`).
 */
export const load: PageServerLoad = async (event) => {
	const { patient } = await event.parent();
	const examId = examIdParam(event.params.examId);
	const detail = await perioExamDetail(patient.id, examId);
	if (!detail) error(404, 'That exam is not on this patient’s record.');

	await logPatientView(patient.id, 'perio', event, { recordId: examId });

	const [save, step] = await Promise.all([
		superValidate({ teeth: detail.teeth, notes: detail.exam.notes ?? '' }, zod4(saveExam), {
			errors: false
		}),
		superValidate(zod4(examStep))
	]);

	return {
		...detail,
		forms: { save, step },
		canWrite: hasPermission(event.locals, PERIO_PERMISSION)
	};
};

export const actions: Actions = {
	save: (event) =>
		patientAction(event, PERIO_PERMISSION, saveExam, async (tx, { patientId, data }) => {
			const changed = await saveReadings(tx, event, patientId, examIdParam(event.params.examId), {
				teeth: data.teeth,
				notes: data.notes
			});
			return changed ? `Saved ${changed} reading${changed === 1 ? '' : 's'}.` : 'Saved.';
		}),

	finish: (event) =>
		patientAction(event, PERIO_PERMISSION, examStep, async (tx, { patientId }) => {
			await finishExam(tx, event, patientId, examIdParam(event.params.examId));
			return 'Exam finished. The next one will be compared with it.';
		}),

	discard: (event) =>
		patientAction(event, PERIO_PERMISSION, examStep, async (tx, { patientId }) => {
			await discardExam(tx, event, patientId, examIdParam(event.params.examId));
			return { redirect: `/dashboard/patients/${patientId}/perio`, text: 'Draft discarded.' };
		})
};
