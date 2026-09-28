import type { RequestEvent } from '@sveltejs/kit';
import { message, setError, superValidate, type SuperValidated } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';

import { db } from '$lib/server/db';
import { requirePermission } from '$lib/server/permissions';
import { WriteRefused } from '$lib/server/childCrud';
import { closeDrawer, drawerState, openDrawer } from '$lib/server/cashDrawer';
import { formatETB } from '$lib/global.svelte';
import { closeDrawerForm, openDrawerForm } from './schema';
import type { Actions, PageServerLoad } from './$types';

/** Who may open and count the drawer — also the page's route rule. */
const DRAWER_PERMISSION = 'billing.cash_session';

/**
 * The cash drawer at the branch being worked at: open it with a float in the morning; through the
 * day it shows what it should hold; count and close it at night. The last month of counts sits
 * below with their variances, so a drawer that keeps coming up short is visible as a pattern.
 */
export const load: PageServerLoad = async ({ locals }) => {
	const [state, openForm, closeForm] = await Promise.all([
		drawerState(locals.branch),
		superValidate(zod4(openDrawerForm)),
		superValidate(zod4(closeDrawerForm))
	]);
	return {
		...state,
		forms: { open: openForm, close: closeForm },
		branchChosen: locals.branch.active !== null
	};
};

/** The drawer's two writes share their refusal handling: the reason under its field, as a 400. */
async function drawerWrite(
	form: SuperValidated<Record<string, unknown>>,
	write: () => Promise<string>
) {
	try {
		return message(form, { type: 'success' as const, text: await write() });
	} catch (err: unknown) {
		if (err instanceof WriteRefused) {
			if (err.field && err.field in form.data) return setError(form, err.field, err.message);
			return message(form, { type: 'error' as const, text: err.message }, { status: 400 });
		}
		console.error('[cash drawer] write failed:', err);
		return message(
			form,
			{ type: 'error' as const, text: 'That could not be saved.' },
			{ status: 500 }
		);
	}
}

export const actions: Actions = {
	open: async (event: RequestEvent) => {
		requirePermission(event.locals, DRAWER_PERMISSION);
		const form = await superValidate(event.request, zod4(openDrawerForm));
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form.' }, { status: 400 });
		return drawerWrite(form, async () => {
			await db.transaction((tx) =>
				openDrawer(tx, event, event.locals.branch.active, form.data.openingFloat)
			);
			return `Drawer open with ${formatETB(form.data.openingFloat)}.`;
		});
	},

	close: async (event: RequestEvent) => {
		requirePermission(event.locals, DRAWER_PERMISSION);
		const form = await superValidate(event.request, zod4(closeDrawerForm));
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form.' }, { status: 400 });
		return drawerWrite(form, async () => {
			const variance = await db.transaction((tx) =>
				closeDrawer(tx, event, event.locals.branch.active, {
					counted: form.data.countedAmount,
					banked: form.data.bankedAmount,
					note: form.data.note ?? null
				})
			);
			return variance === 0
				? 'Drawer counted and closed. It balanced.'
				: `Drawer closed ${variance > 0 ? 'over' : 'short'} by ${formatETB(Math.abs(variance))}.`;
		});
	}
};
