import { z } from 'zod';

/**
 * The patient forms, shared by registration and the chart so the two can never disagree about
 * what a valid patient is.
 *
 * Built from three field groups — who they are, how to reach them, how they came and who pays —
 * because the chart edits each group in its own dialog and registration asks all three at once.
 *
 * Deliberately lenient where the schema is (see `patients.ts` in the schema): a grandfather's
 * name, a birth date, a phone and a blood type are all optional. A patient in pain at the window
 * is registered with what they can tell you, and a required field is answered with whatever is
 * first in the list — which is worse than blank, because it looks like data.
 */

/** A select or combo left empty posts `''`; to zod that is "not given", not an invalid value. */
const blank = (value: unknown) => (value === '' || value === null ? undefined : value);

const optionalText = (max: number, label: string) =>
	z.preprocess(
		blank,
		z.string().trim().max(max, `${label} must be ${max} characters or fewer`).optional()
	);

const optionalId = z.preprocess(blank, z.coerce.number().int().positive().optional());

const phone = (label: string) =>
	z.preprocess(
		blank,
		z
			.string()
			.trim()
			.regex(/^\+?[\d\s-]{7,20}$/, `${label} should be digits, like 0911 23 45 67`)
			.optional()
	);

export const SEX_OPTIONS = [
	{ value: 'female', name: 'Female' },
	{ value: 'male', name: 'Male' }
];

export const BLOOD_TYPE_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((t) => ({
	value: t,
	name: t
}));

/** Who the patient is. */
const identityFields = {
	fileNo: optionalText(32, 'File number'),
	name: z.string('Given name is required').trim().min(1, 'Given name is required').max(50),
	fatherName: z
		.string('Father’s name is required')
		.trim()
		.min(1, 'Father’s name is required')
		.max(50),
	grandFatherName: optionalText(50, 'Grandfather’s name'),
	sex: z.enum(['male', 'female'], 'Choose the patient’s sex'),
	/**
	 * Many adults here do not know their date of birth. The form asks which it is: a date when they
	 * know it, an approximate age when they do not — and the age becomes an estimated birth date,
	 * flagged as such, because age must be derived from one place (see the schema note).
	 */
	knowsBirthDate: z.boolean().default(false),
	birthDate: optionalText(10, 'Birth date'),
	ageYears: z.preprocess(
		blank,
		z.coerce
			.number('Age must be a number')
			.int('Age is in whole years')
			.min(0, 'Age cannot be negative')
			.max(120, 'Age must be 120 or less')
			.optional()
	),
	bloodType: z.preprocess(
		blank,
		z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional()
	)
};

/** A birth date given as a date must be a real one, and not in the future. */
function checkBirthDate(
	data: { knowsBirthDate: boolean; birthDate?: string },
	ctx: z.RefinementCtx
) {
	if (!data.knowsBirthDate) return;

	const date = data.birthDate ? new Date(data.birthDate) : null;
	if (!date || Number.isNaN(date.getTime())) {
		ctx.addIssue({ code: 'custom', path: ['birthDate'], message: 'Pick the birth date' });
	} else if (date > new Date()) {
		ctx.addIssue({
			code: 'custom',
			path: ['birthDate'],
			message: 'A birth date cannot be in the future'
		});
	}
}

/** How to reach them. */
const contactFields = {
	phone: phone('Phone'),
	altPhone: phone('Second phone')
};

/** How they came, and who pays. */
const referralFields = {
	referralSourceId: optionalId,
	referredBy: optionalText(150, 'Referred by'),
	customerId: optionalId
};

export const registerPatient = z
	.object({
		...identityFields,
		...contactFields,
		...referralFields,
		medicalNotes: optionalText(5000, 'Medical notes'),
		/**
		 * Allergies reported at the desk, as a comma-separated list of allergen ids — the shape the
		 * checkbox group posts. Recorded with severity "unknown"; a clinician grades them.
		 */
		allergenIds: optionalText(1000, 'Allergies'),
		/**
		 * Set when the receptionist has seen the possible duplicates and says this is someone else.
		 * Without it, a match stops the registration so the question gets asked.
		 */
		confirmNotDuplicate: z.boolean().default(false)
	})
	.superRefine(checkBirthDate);
export type RegisterPatient = z.infer<typeof registerPatient>;

export const editIdentity = z.object(identityFields).superRefine(checkBirthDate);
export type EditIdentity = z.infer<typeof editIdentity>;

export const editReach = z.object({
	...contactFields,
	...referralFields,
	/** The patient asked not to be texted: reminders and recalls skip them (`patient.smsOptOut`). */
	smsOptOut: z.boolean().default(false)
});
export type EditReach = z.infer<typeof editReach>;

export const editHistory = z.object({
	medicalNotes: optionalText(5000, 'Medical notes'),
	/**
	 * "I asked the questions today." Separate from editing the notes, because fixing a typo in the
	 * notes is not taking a history, and stamping `historyTakenAt` on every save would make a stale
	 * history look current.
	 */
	markTaken: z.boolean().default(false)
});
export type EditHistory = z.infer<typeof editHistory>;

/* ── The child sections of the chart ─────────────────────────────────────────────────────────── */

const id = { id: z.coerce.number().int().positive() };

export const addAllergy = z.object({
	allergenId: z.coerce.number('Choose the allergen').int().positive('Choose the allergen'),
	severity: z.enum(['unknown', 'mild', 'moderate', 'severe']).default('unknown'),
	reaction: optionalText(255, 'Reaction')
});
export const editAllergy = addAllergy.extend(id);

export const addCondition = z.object({
	conditionId: z.coerce.number('Choose the condition').int().positive('Choose the condition'),
	status: z.enum(['suspected', 'active', 'inRemission', 'resolved']).default('active'),
	diagnosedOn: optionalText(10, 'Diagnosed on'),
	resolvedOn: optionalText(10, 'Resolved on'),
	note: optionalText(2000, 'Note')
});
export const editCondition = addCondition.extend(id);

export const addMedication = z.object({
	nameAsReported: z
		.string('What the patient calls it is required')
		.trim()
		.min(1, 'What the patient calls it is required')
		.max(160),
	medicineId: optionalId,
	dose: optionalText(50, 'Dose'),
	frequency: optionalText(80, 'How often'),
	status: z.enum(['active', 'stopped', 'unknown']).default('active'),
	note: optionalText(2000, 'Note')
});
export const editMedication = addMedication.extend(id);

export const addContact = z.object({
	contactTypeId: z.coerce.number('Choose the kind of contact').int().positive(),
	value: z.string('The contact detail is required').trim().min(1).max(255),
	label: optionalText(50, 'Label'),
	isPrimary: z.boolean().default(false)
});
export const editContact = addContact.extend(id);

export const addEmergencyContact = z.object({
	name: z.string('Name is required').trim().min(1, 'Name is required').max(100),
	relation: optionalText(50, 'Relation'),
	phone: z
		.string('Phone is required')
		.trim()
		.regex(/^\+?[\d\s-]{7,20}$/, 'Phone should be digits, like 0911 23 45 67'),
	altPhone: phone('Second phone'),
	isPrimary: z.boolean().default(false)
});
export const editEmergencyContact = addEmergencyContact.extend(id);
