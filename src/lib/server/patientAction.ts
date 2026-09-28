import type { RequestEvent } from '@sveltejs/kit';
import {
	message,
	setError,
	superValidate,
	type Infer,
	type SuperValidated
} from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { z } from 'zod/v4';
import { redirect } from 'sveltekit-flash-message/server';

import { db } from '$lib/server/db';
import { WriteRefused } from '$lib/server/childCrud';
import { requirePermission } from '$lib/server/permissions';
import { livePatientId } from '$lib/server/patients';

/** A transaction on the database, as `db.transaction` hands it over. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * One write on a tab of a patient's chart, the same way every time: the permission (the chart's
 * route gate is only `patients.view`, so the action is the control — CLAUDE.md §9), the posted
 * form, the live patient, and the write in a transaction. A `WriteRefused` from the write rolls it
 * back and comes back as the reason — under its field where the form has one, as a message where
 * it does not — with a 400; anything else is logged and reported as a failure.
 *
 * Built for treatment plans and adopted by billing, whose actions differ only in their permission,
 * their schema and their write (CLAUDE.md §2).
 *
 * `write` returns the success text, or somewhere to go with it — a new record's page, after
 * creating one. The redirect is thrown after the transaction commits, so it cannot roll it back.
 */
export function patientAction<S extends z.ZodObject>(
	event: RequestEvent,
	permission: string,
	schema: S,
	write: (
		tx: Tx,
		input: { patientId: number; data: Infer<S, 'zod4'> }
	) => Promise<string | { redirect: string; text: string }>
) {
	return ownedAction(
		event,
		permission,
		schema,
		() => livePatientId(event),
		(tx, { ownerId, data }) => write(tx, { patientId: ownerId, data })
	);
}

/**
 * `patientAction` for a record that is not a patient — an employer or insurer paying bills. `owner`
 * resolves the live record the path names, and throws its own 404 when there is none; it runs after
 * the form is read, so a bad form is answered before the database is asked.
 */
export async function ownedAction<S extends z.ZodObject>(
	event: RequestEvent,
	permission: string,
	schema: S,
	owner: () => Promise<number>,
	write: (
		tx: Tx,
		input: { ownerId: number; data: Infer<S, 'zod4'> }
	) => Promise<string | { redirect: string; text: string }>
) {
	requirePermission(event.locals, permission);
	// A form posted as JSON (the answer) is read the same way: superforms tells the two apart.
	const form = await superValidate(event.request, zod4(schema));
	if (!form.valid) {
		return message(form, { type: 'error' as const, text: 'Check the form.' }, { status: 400 });
	}
	const ownerId = await owner();

	let outcome: string | { redirect: string; text: string };
	try {
		outcome = await db.transaction((tx) => write(tx, { ownerId, data: form.data }));
	} catch (err: unknown) {
		if (err instanceof WriteRefused) return refused(form, err);
		console.error(`[action] ${event.url.pathname} failed:`, err);
		return message(
			form,
			{ type: 'error' as const, text: 'That could not be saved. Nothing was changed.' },
			{ status: 500 }
		);
	}

	if (typeof outcome === 'string')
		return message(form, { type: 'success' as const, text: outcome });
	redirect(outcome.redirect, { type: 'success', message: outcome.text }, event.cookies);
}

/** The reason for a refusal, under its field when the form has that field. */
function refused(form: SuperValidated<Record<string, unknown>>, err: WriteRefused) {
	if (err.field && err.field in form.data) {
		return setError(form, err.field, err.message);
	}
	return message(form, { type: 'error' as const, text: err.message }, { status: 400 });
}
