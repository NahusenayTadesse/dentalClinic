/**
 * Whether a medicine clashes with an allergy on the patient's chart — the one check a prescribing
 * screen exists to make.
 *
 * Shared by the prescription form, which warns as the medicine is chosen, and by
 * `server/prescriptions.ts`, which refuses the prescription unless the clinician has said they
 * know. One rule in one place, so the warning and the refusal cannot disagree (the same reason
 * `$lib/teeth.ts` is shared).
 *
 * **Two ways to clash**, because the allergen list names both families and single drugs:
 *
 *   - **the family** — the medicine's `allergenId` is the allergy recorded: amoxicillin belongs to
 *     "Penicillin", so a penicillin allergy stops it
 *   - **the name** — the allergen's name appears in the generic name: an allergy recorded as
 *     "Amoxicillin" stops "Amoxicillin + Clavulanic acid", though that belongs to "Penicillin"
 *
 * Deliberately generous. A false warning costs a clinician one tick; a missed one is anaphylaxis
 * in the chair.
 *
 * Non-goals: cross-reactivity between families (a penicillin allergy and cephalosporins), and
 * drug–drug interactions with what the patient already takes. Both need clinical data this clinic
 * does not keep; the form lists the patient's current medicines so the clinician can judge.
 */

/** An allergy on the chart, as the check needs it. */
export type ChartAllergy = { allergenId: number; name: string; severity: string };

/** A medicine, as the check needs it. */
export type ClashMedicine = { genericName: string; allergenId: number | null };

/** The patient's allergies this medicine clashes with; empty when it is safe to write. */
export function allergyClashes(allergies: ChartAllergy[], medicine: ClashMedicine): ChartAllergy[] {
	const name = medicine.genericName.toLowerCase();
	return allergies.filter(
		(allergy) =>
			allergy.allergenId === medicine.allergenId || name.includes(allergy.name.toLowerCase())
	);
}
