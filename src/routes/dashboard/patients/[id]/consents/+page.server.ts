import { childActions } from '$lib/server/childCrud';
import { hasPermission } from '$lib/server/permissions';
import { livePatientId, logPatientView } from '$lib/server/patients';
import { providerOptions } from '$lib/server/appointments';
import { chartProcedures } from '$lib/server/procedures';
import { patientFiles } from '$lib/server/patientFiles';
import { printableConsents } from '$lib/server/consentTemplates';
import { formatEthiopianDate } from '$lib/global.svelte';
import { whereLabel } from '$lib/teeth';
import { CLINICAL_PERMISSION } from '../clinicalAction';
import { CONSENT_SECTIONS } from './section';
import type { Actions, PageServerLoad } from './$types';

/**
 * The consents tab: what the patient agreed to, how, and whether it still stands. Reading is the
 * chart's `patients.view`; recording and withdrawing is `patients.clinical`; deleting one entered
 * on the wrong patient is a super admin's. The rules are `section.ts`'s.
 * Opening it is logged as a read of the consents.
 */
export const load: PageServerLoad = async (event) => {
	const { patient } = await event.parent();
	await logPatientView(patient.id, 'consent', event);

	const [consents, providers, work, files, printable] = await Promise.all([
		CONSENT_SECTIONS.Consent.load(patient.id),
		providerOptions(),
		chartProcedures(patient.id),
		patientFiles(patient.id),
		printableConsents()
	]);

	return {
		consents,
		// `childCrud` types its rows as no more than an id, so the count is taken here.
		withdrawn: consents.rows.filter((row) => 'withdrawnOn' in row && row.withdrawnOn).length,
		options: {
			witnessedBy: providers.map((p) => ({ value: p.value, name: p.name })),
			procedureId: work
				.filter((w) => w.status !== 'existing')
				.map((w) => ({ value: w.id, name: `${w.service ?? 'Treatment'} · ${whereLabel(w)}` })),
			// Consent forms first: that is what this is for, though any attached paper will do.
			documentFileId: [...files]
				.sort((a, b) => Number(b.kind === 'consent') - Number(a.kind === 'consent'))
				.map((f) => ({
					value: f.id,
					name: `${f.description ?? f.originalName ?? 'File'} · ${formatEthiopianDate(new Date(f.createdAt))}`
				}))
		},
		// The forms that can be printed for signature, and the language to print in to start with.
		printable,
		lang: event.locals.lang,
		canWrite: hasPermission(event.locals, CLINICAL_PERMISSION),
		canDelete: event.locals.isSuperAdmin === true
	};
};

export const actions: Actions = childActions(CONSENT_SECTIONS, livePatientId);
