import { fail, message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { db } from '$lib/server/db';
import { approvalLinks, findEntity, pendingRows, settleApprovals } from '$lib/server/approvals';
import { hasPermission } from '$lib/server/permissions';
import { settleSchema } from '../schema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const entity = findEntity(params.entity);

	return {
		entity: {
			key: entity.key,
			label: entity.label,
			singular: entity.singular,
			listHref: entity.listHref,
			// Which columns point at another record, so the table can link them.
			links: approvalLinks(entity)
		},
		rows: await pendingRows(entity),
		form: await superValidate(zod4(settleSchema))
	};
};

export const actions: Actions = {
	settle: async ({ request, params, locals }) => {
		const entity = findEntity(params.entity);
		const form = await superValidate(request, zod4(settleSchema));

		if (!form.valid) {
			// The same schema runs here, so a rejection missing its reason lands in this branch
			// too — the client is where it is caught first, not the only place it is checked.
			const text = form.errors.reason?.[0] ?? 'Select at least one record.';
			return message(form, { type: 'error', text }, { status: 400 });
		}

		const userId = locals.user?.id;
		if (!userId) return fail(401);

		// A super admin holds every permission, so this is true for them by construction — which
		// is the intended "root can do anything", not an accident.
		const canOverride = hasPermission(locals, 'approvals.override');

		const { ids, decision, reason } = form.data;

		try {
			const result = await db.transaction((tx) =>
				settleApprovals({
					entity,
					ids,
					decision,
					userId,
					canOverride,
					reason,
					database: tx
				})
			);

			const verb = decision === 'approved' ? 'Approved' : 'Rejected';
			const noun = result.settled === 1 ? entity.singular : entity.label.toLowerCase();

			if (result.settled === 0 && result.blocked > 0) {
				return message(form, {
					type: 'error',
					text: `Nothing was ${decision}. You requested ${result.blocked === 1 ? 'this record' : 'these records'} yourself, and releasing your own request needs the override permission.`
				});
			}

			const notes: string[] = [];
			if (result.blocked > 0) {
				notes.push(
					` ${result.blocked} left pending because you requested ${result.blocked === 1 ? 'it' : 'them'} yourself.`
				);
			}
			if (result.overridden > 0) {
				notes.push(
					` ${result.overridden} of these were your own request, released using your override permission and recorded as such.`
				);
			}

			return message(form, {
				type: result.blocked > 0 ? 'error' : 'success',
				text: `${verb} ${result.settled} ${noun}.` + notes.join('')
			});
		} catch (err) {
			console.error('Approval failed:', err);
			return message(form, {
				type: 'error',
				text: `Could not complete that: ${err instanceof Error ? err.message : 'Unknown error'}`
			});
		}
	}
};
