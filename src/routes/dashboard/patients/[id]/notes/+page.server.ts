import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';

import { hasPermission } from '$lib/server/permissions';
import { logPatientView } from '$lib/server/patients';
import { providerOptions, recentVisits } from '$lib/server/appointments';
import {
	amendNote,
	discardDraft,
	editDraft,
	patientNotes,
	signNote,
	writeNote
} from '$lib/server/clinicalNotes';
import { clinicDate, ethiopianClock } from '$lib/clinicTime';
import { formatEthiopianDate } from '$lib/global.svelte';
import { CLINICAL_PERMISSION, clinicalAction } from '../clinicalAction';
import { amendNote as amendForm, editNote, newNote, noteStep } from './schema';
import type { Actions, PageServerLoad } from './$types';

/**
 * The notes tab: what clinicians wrote about this patient, newest first, and writing, signing and
 * correcting a note. Reading is the chart's `patients.view`; every write is `patients.clinical`,
 * checked in the action. Opening the tab is logged as a read of the notes.
 */
export const load: PageServerLoad = async (event) => {
	const { patient } = await event.parent();
	await logPatientView(patient.id, 'note', event);

	const [notes, visits, providers, add, edit, amend, step] = await Promise.all([
		patientNotes(patient.id),
		recentVisits(patient.id),
		providerOptions(),
		superValidate(zod4(newNote)),
		superValidate(zod4(editNote)),
		superValidate(zod4(amendForm)),
		superValidate(zod4(noteStep))
	]);

	return {
		notes,
		me: event.locals.user?.id ?? null,
		providers: providers.map((p) => ({ value: String(p.value), name: p.name })),
		visits: visits.map((v) => ({
			value: String(v.id),
			name: `${formatEthiopianDate(new Date(clinicDate(v.startsAt)))} ${ethiopianClock(v.startsAt)}${v.provider ? ` · ${v.provider}` : ''}`
		})),
		forms: { add, edit, amend, step },
		canWrite: hasPermission(event.locals, CLINICAL_PERMISSION)
	};
};

/** A chosen id from a select, or null for none. */
const chosen = (value: string) => Number(value) || null;

export const actions: Actions = {
	add: (event) =>
		clinicalAction(event, newNote, async (tx, { patientId, data }) => {
			await writeNote(tx, event, patientId, {
				kind: data.kind,
				summary: data.summary ?? null,
				body: data.body,
				providerId: chosen(data.providerId),
				appointmentId: chosen(data.appointmentId),
				sign: data.sign
			});
			return data.sign ? 'Note signed.' : 'Draft saved. Sign it when it is finished.';
		}),

	edit: (event) =>
		clinicalAction(event, editNote, async (tx, { patientId, data }) => {
			await editDraft(tx, event, patientId, data.noteId, {
				kind: data.kind,
				summary: data.summary ?? null,
				body: data.body,
				providerId: chosen(data.providerId),
				appointmentId: chosen(data.appointmentId)
			});
			return 'Draft saved.';
		}),

	sign: (event) =>
		clinicalAction(event, noteStep, async (tx, { patientId, data }) => {
			await signNote(tx, event, patientId, data.noteId);
			return 'Note signed. It can be corrected by an amendment from now on, not changed.';
		}),

	discard: (event) =>
		clinicalAction(event, noteStep, async (tx, { patientId, data }) => {
			await discardDraft(tx, event, patientId, data.noteId);
			return 'Draft thrown away.';
		}),

	amend: (event) =>
		clinicalAction(event, amendForm, async (tx, { patientId, data }) => {
			await amendNote(tx, event, patientId, data.noteId, {
				summary: data.summary ?? null,
				body: data.body
			});
			return 'Amendment added. The original note stays as it was.';
		})
};
