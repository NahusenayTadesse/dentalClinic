import type { LookupConfig } from '@nahu/admin-kit/components/lookup/types.js';
import type { Messages } from '$lib/i18n/messages';

/**
 * How each child section of the chart looks: its table columns and its form fields, as data, in
 * the viewer's language — each a function of the messages, built in a `$derived` on the page.
 *
 * The client half of `sections.ts`. Reference fields name their options by field — the page loads
 * `allergenId`'s options once and every allergy row and form uses them. Stored values (`severe`,
 * `active`…) never change with the language; only the names shown for them do.
 */

/** The allergies section. */
export const allergyConfig = (m: Messages): LookupConfig => {
	const a = m.patients.sections.allergy;
	return {
		entity: a.entity,
		plural: a.plural,
		fields: [
			{ name: 'allergenId', label: a.allergen, type: 'reference', picker: 'combo' },
			{
				name: 'severity',
				label: a.severity,
				type: 'select',
				choices: [
					{ value: 'severe', name: a.severe },
					{ value: 'moderate', name: a.moderate },
					{ value: 'mild', name: a.mild },
					{ value: 'unknown', name: a.notAssessed }
				]
			},
			{
				name: 'reaction',
				label: a.reaction,
				type: 'text',
				required: false,
				placeholder: a.reactionPlaceholder
			}
		]
	};
};

/** The conditions section. */
export const conditionConfig = (m: Messages): LookupConfig => {
	const c = m.patients.sections.condition;
	return {
		entity: c.entity,
		plural: c.plural,
		fields: [
			{ name: 'conditionId', label: c.condition, type: 'reference', picker: 'combo' },
			{
				name: 'status',
				label: c.status,
				type: 'select',
				choices: [
					{ value: 'active', name: c.active },
					{ value: 'suspected', name: c.suspected },
					{ value: 'inRemission', name: c.inRemission },
					{ value: 'resolved', name: c.resolved }
				]
			},
			{ name: 'resolvedOn', label: c.resolvedOn, type: 'date', inForm: false },
			{ name: 'note', label: c.note, type: 'textarea', rows: 3, required: false }
		]
	};
};

/** The medications section. */
export const medicationConfig = (m: Messages): LookupConfig => {
	const d = m.patients.sections.medication;
	return {
		entity: d.entity,
		plural: d.plural,
		fields: [
			{
				name: 'nameAsReported',
				label: d.asReported,
				type: 'text',
				placeholder: d.asReportedPlaceholder
			},
			{
				name: 'medicineId',
				label: d.formulary,
				type: 'reference',
				picker: 'combo',
				required: false
			},
			{
				name: 'dose',
				label: d.dose,
				type: 'text',
				required: false,
				placeholder: d.dosePlaceholder
			},
			{
				name: 'frequency',
				label: d.frequency,
				type: 'text',
				required: false,
				placeholder: d.frequencyPlaceholder
			},
			{
				name: 'status',
				label: d.status,
				type: 'select',
				choices: [
					{ value: 'active', name: d.taking },
					{ value: 'stopped', name: d.stopped },
					{ value: 'unknown', name: d.notSure }
				]
			},
			{ name: 'stoppedOn', label: d.stoppedOn, type: 'date', inForm: false },
			{ name: 'note', label: d.note, type: 'textarea', rows: 3, required: false }
		]
	};
};

/** The other contacts section. */
export const contactConfig = (m: Messages): LookupConfig => {
	const k = m.patients.sections.contact;
	return {
		entity: k.entity,
		plural: k.plural,
		fields: [
			{ name: 'value', label: k.detail, type: 'text', placeholder: k.detailPlaceholder },
			{ name: 'contactTypeId', label: k.kind, type: 'reference', picker: 'select' },
			{
				name: 'label',
				label: k.label,
				type: 'text',
				required: false,
				placeholder: k.labelPlaceholder
			},
			{
				name: 'isPrimary',
				label: k.primary,
				type: 'checkbox',
				required: false,
				trueLabel: k.primary,
				falseLabel: '—'
			}
		]
	};
};

/** The emergency contacts section. */
export const emergencyContactConfig = (m: Messages): LookupConfig => {
	const e = m.patients.sections.emergency;
	return {
		entity: e.entity,
		plural: e.plural,
		fields: [
			{ name: 'name', label: e.name, type: 'text' },
			{
				name: 'relation',
				label: e.relation,
				type: 'text',
				required: false,
				placeholder: e.relationPlaceholder
			},
			{ name: 'phone', label: e.phone, type: 'text', placeholder: '0911 23 45 67' },
			{ name: 'altPhone', label: e.altPhone, type: 'text', required: false },
			{
				name: 'isPrimary',
				label: e.callFirst,
				type: 'checkbox',
				required: false,
				trueLabel: e.callFirst,
				falseLabel: '—'
			}
		]
	};
};
