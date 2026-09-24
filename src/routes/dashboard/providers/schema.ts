import { z } from 'zod/v4';

/** A field the form may leave empty; `''` from a select or a text box means "not given". */
const blank = (value: unknown) => (value === '' || value === null ? undefined : value);
const optionalText = (max: number) => z.preprocess(blank, z.string().trim().max(max).optional());

const fields = {
	employeeId: z.coerce
		.number('Choose the member of staff')
		.int()
		.positive('Choose the member of staff'),
	specialtyId: z.preprocess(blank, z.coerce.number().int().positive().optional()),
	/** "Dr", "Prof" — printed in front of the name everywhere a provider is shown. */
	title: optionalText(10),
	/** Short form for the day view, where a column is narrow. */
	abbreviation: optionalText(12),
	licenceNumber: optionalText(64),
	licenceIssuedOn: optionalText(10),
	licenceExpiresOn: optionalText(10),
	licenceBody: optionalText(100),
	/** Hex, so the day view can paint with it directly. */
	colour: z.preprocess(
		blank,
		z
			.string()
			.regex(/^#[0-9a-fA-F]{6}$/, 'Colour must be a hex value like #2563eb')
			.optional()
	),
	defaultAppointmentMinutes: z.coerce.number().int().min(5).max(480).default(30),
	isBookable: z.boolean().default(true),
	canPrescribe: z.boolean().default(false),
	scheduleNote: optionalText(255),
	/*
	 * Active by default. Every other lookup add form starts on Inactive — a required boolean has no
	 * value until one is picked, and superforms fills it with `false` — so a row added without
	 * touching the field is created switched off. On this screen that would mean a dentist who
	 * cannot be booked and does not say why.
	 */
	status: z.boolean().default(true)
};

export const add = z.object(fields);

export const edit = z.object({ id: z.coerce.string(), ...fields });
