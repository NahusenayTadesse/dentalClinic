import { z } from 'zod/v4';

/*
 * The prescription form: what the clinician writes. The date, the branch and who entered it are the
 * server's (`server/prescriptions.ts`), and so is every check that matters — the prescriber, the
 * medicines and the allergy clash are all checked again there. Posted as JSON: a list of lines does
 * not survive form fields. Optional choices stay strings (CLAUDE.md §13).
 */

/** One medicine on the sheet. Free text but for the medicine, as the schema explains. */
export const item = z.object({
	medicineId: z.number().int().positive('Choose the medicine.'),
	dose: z.string().max(50),
	frequency: z.string().max(80),
	durationDays: z.number().int().min(0).max(365),
	quantity: z.string().max(50),
	instructions: z.string().max(1000)
});

export const newPrescription = z.object({
	providerId: z.string().min(1, 'Choose who is prescribing.'),
	appointmentId: z.string(),
	weightKg: z.number().min(0).max(400),
	indication: z.string().trim().min(1, 'Say what it is being prescribed for.').max(255),
	notes: z.string().max(2000),
	allergyAcknowledged: z.boolean().default(false),
	items: z.array(item).min(1, 'Add at least one medicine.').max(10)
});

/** Cancelling one: which. */
export const cancelPrescription = z.object({ prescriptionId: z.coerce.number().int().positive() });

export type NewPrescription = z.infer<typeof newPrescription>;
export type PrescriptionItem = z.infer<typeof item>;
