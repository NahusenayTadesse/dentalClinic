import { fail, message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { db } from '$lib/server/db';
import { approvalLinks, findEntity, rejectedRows, reopenApprovals } from '$lib/server/approvals';
import { hasPermission } from '$lib/server/permissions';
import { reopenSchema } from '../schema';
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
		rows: await rejectedRows(entity),
		form: await superValidate(zod4(reopenSchema))
	};
};

export const actions: Actions = {
	reopen: async ({ request, params, locals }) => {
		const entity = findEntity(params.entity);
		const form = await superValidate(request, zod4(reopenSchema));

		if (!form.valid) {
			return message(form, { type: 'error', text: 'Select at least one record.' }, { status: 400 });
		}

		const userId = locals.user?.id;
		if (!userId) return fail(401);

		// Rejections are a separate desk from approvals: whoever clears them holds
		// `rejections.reopen`, which says nothing about being allowed to approve anything.
		// A super admin holds it by construction.
		const canReopen = hasPermission(locals, 'rejections.reopen');
		if (!canReopen) {
			return message(
				form,
				{ type: 'error', text: 'You do not have permission to reopen records.' },
				{ status: 403 }
			);
		}

		try {
			const reopened = await db.transaction((tx) =>
				reopenApprovals({ entity, ids: form.data.ids, userId, database: tx })
			);

			if (reopened === 0) {
				return message(form, {
					type: 'error',
					text: 'Nothing was reopened — those records are no longer rejected.'
				});
			}

			const noun = reopened === 1 ? entity.singular : entity.label.toLowerCase();

			return message(form, {
				type: 'success',
				text: `${reopened} ${noun} back in the approval queue. The rejection reason was cleared.`
			});
		} catch (err) {
			console.error('Reopen failed:', err);
			return message(form, {
				type: 'error',
				text: `Could not reopen that: ${err instanceof Error ? err.message : 'Unknown error'}`
			});
		}
	}
};
