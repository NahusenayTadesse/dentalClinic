/**
 * Reading the consent forms' wording for printing. Editing it is the Clinic Setup screen's
 * (`contentCrud`); the rules for filling it are `$lib/consentForms.ts`.
 */
import { and, asc, eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { consentTemplate } from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';

/** The forms that can be printed — active ones, by kind then name. */
export function printableConsents() {
	return db
		.select({
			id: consentTemplate.id,
			name: consentTemplate.name,
			consentType: consentTemplate.consentType
		})
		.from(consentTemplate)
		.where(and(eq(consentTemplate.isActive, true), notDeleted(consentTemplate)))
		.orderBy(asc(consentTemplate.consentType), asc(consentTemplate.name));
}

/** One form's wording, or null for one retired or never there. */
export async function consentWording(id: number) {
	const [row] = await db
		.select({
			name: consentTemplate.name,
			consentType: consentTemplate.consentType,
			bodyEn: consentTemplate.bodyEn,
			bodyAm: consentTemplate.bodyAm
		})
		.from(consentTemplate)
		.where(
			and(
				eq(consentTemplate.id, id),
				eq(consentTemplate.isActive, true),
				notDeleted(consentTemplate)
			)
		)
		.limit(1);
	return row ?? null;
}
