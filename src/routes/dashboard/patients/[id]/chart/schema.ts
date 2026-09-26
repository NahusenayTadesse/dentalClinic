import { z } from 'zod/v4';
import { PROCEDURE_STATUSES } from '$lib/procedureStatus';

/**
 * The charting form.
 *
 * Deliberately permissive about *where*: tooth, surfaces and span are all optional here, because
 * which of them a procedure needs depends on the service, and only the server knows the service's
 * area for certain. `procedureTransform` in `$lib/server/procedures.ts` checks the combination and
 * refuses with the field that is wrong. The form hides the fields the chosen service does not use,
 * which is guidance, not the rule.
 */

/**
 * An optional choice, kept as the text it arrived as: `''`, `null` or `undefined` for none, `"12"`
 * for an id. The server reads all of those (`idOrNull` in `$lib/server/procedures.ts`).
 *
 * **The client validator's output has to equal its input.** When a form becomes valid, superforms
 * writes the parsed data back into the form. An earlier version parsed `''` as `undefined`; the
 * visit dropdown's bound value wrote `''` back, and the two went round forever — a few hundred
 * writes a second while the dialog was open, each re-running client validation and erasing the
 * server's refusal before anyone could read it. A string that stays a string settles after one
 * write (`12` becomes `"12"`, which parses to itself), and `null`/`undefined` pass through
 * untouched because the wrappers check them before the coercion runs.
 *
 * Not a `union` of `''` and a number, which would say this more exactly: superforms cannot parse a
 * union out of posted form data, and refuses the whole request.
 */
const optionalId = z.coerce.string().nullable().optional();

const fields = {
	serviceId: z.coerce.number('Choose what was done or found').int().positive(),
	status: z.enum(PROCEDURE_STATUSES, 'Choose a status'),
	toothId: optionalId,
	surfaces: z.string().max(12).optional(),
	toothRange: z.string().max(64).optional(),
	providerId: optionalId,
	appointmentId: optionalId,
	/** Empty means "the service's price" — the server fills it in. */
	fee: z.coerce
		.string()
		.refine((v) => v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0), {
			message: 'A fee cannot be negative'
		})
		.nullable()
		.optional(),
	note: z.string().max(500).optional()
};

export const addProcedure = z.object(fields);
export type AddProcedure = z.infer<typeof addProcedure>;

export const editProcedure = z.object({ id: z.coerce.number(), ...fields });
export type EditProcedure = z.infer<typeof editProcedure>;
