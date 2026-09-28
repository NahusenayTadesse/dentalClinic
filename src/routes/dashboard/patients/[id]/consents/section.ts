import { and, eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { patientConsent, patientFile, procedures } from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';
import { childCrud, refuseUnless } from '$lib/server/childCrud';
import { checkedProvider } from '$lib/server/appointments';
import { clinicToday } from '$lib/clinicTime';
import { addConsent, editConsent } from './schema';

/**
 * A patient's consents, as one `childCrud` section with the rules the form cannot keep.
 *
 * **Withdrawn, never deleted.** The schema says why (`consents.ts`): "she agreed in March and
 * changed her mind in June" is the history, and a deleted row reads as though she never agreed.
 * So a reason for withdrawing is what withdraws it, dated by the server the first time, and the
 * delete is a super admin's, for a consent entered on the wrong patient (`superAdminDelete`).
 *
 * **A verbal consent names its witness.** Verbal consent before a witness is how consent is given
 * by a patient who does not read, and it is legitimate — but the witness is what carries the weight
 * a signature carries elsewhere, so a verbal consent without one is refused.
 *
 * **Every chosen row is this patient's.** The witness is a live clinician; the procedure and the
 * scanned form are checked to belong to the patient the consent is filed under — the owner id is
 * stamped by `childCrud`, and nothing else from the form is trusted to agree with it.
 *
 * Audited (`patient_consent`), and written under `patients.clinical`.
 */

/** A chosen id, or null for none. */
const chosen = (value: unknown) => Number(value) || null;

/** Refuses a row id that is not this patient's live row in `table`. */
async function ownedBy(
	table: typeof procedures | typeof patientFile,
	id: number | null,
	patientId: number,
	field: string,
	text: string
) {
	if (id === null) return null;
	const [row] = await db
		.select({ id: table.id })
		.from(table)
		.where(and(eq(table.id, id), eq(table.patientId, patientId), notDeleted(table)))
		.limit(1);
	refuseUnless(Boolean(row), text, field);
	return id;
}

/**
 * The server's half of a consent write: the witness, the treatment and the form checked, a verbal
 * consent refused without its witness, and the withdrawal dated. Exported for its tests.
 */
export async function consentTransform(
	values: Record<string, unknown>,
	before?: Record<string, unknown>
): Promise<Record<string, unknown>> {
	const patientId = Number(values.patientId ?? before?.patientId);
	const witnessedBy = await checkedProvider(db, chosen(values.witnessedBy));
	refuseUnless(
		values.method !== 'verbal' || witnessedBy !== null,
		'A verbal consent needs the clinician who witnessed it.',
		'witnessedBy'
	);
	const reason = typeof values.withdrawnReason === 'string' ? values.withdrawnReason.trim() : '';
	return {
		...values,
		givenBy: values.givenBy || null,
		relationship: values.relationship || null,
		note: values.note || null,
		witnessedBy,
		procedureId: await ownedBy(
			procedures,
			chosen(values.procedureId),
			patientId,
			'procedureId',
			'That treatment is not on this patient’s chart.'
		),
		documentFileId: await ownedBy(
			patientFile,
			chosen(values.documentFileId),
			patientId,
			'documentFileId',
			'That file is not attached to this patient.'
		),
		withdrawnReason: reason || null,
		// Dated the first time it is withdrawn and kept after; cleared if it stands again.
		withdrawnOn: reason ? (before?.withdrawnOn ?? clinicToday()) : null
	};
}

export const CONSENT_SECTIONS = {
	Consent: childCrud({
		table: patientConsent,
		ownerColumn: 'patientId',
		label: 'Consent',
		addSchema: addConsent,
		editSchema: editConsent,
		audit: 'patient_consent',
		permission: 'patients.clinical',
		superAdminDelete: true,
		transform: (values, _event, before) => consentTransform(values, before)
	})
};
