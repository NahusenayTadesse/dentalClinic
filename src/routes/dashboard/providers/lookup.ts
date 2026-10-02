import type { LookupConfig } from '@nahu/admin-kit/components/lookup/types.js';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import ExpiryCell from '@nahu/admin-kit/components/Table/expiry-cell.svelte';
import { LICENCE_WARNING_DAYS } from './licence';

/**
 * The clinicians who can be booked, prescribe, and sign work.
 *
 * A provider is **not** an employee record: it is the clinical licence and diary settings attached
 * to one. `appointment.provider_id` points here rather than at `employee` precisely so the
 * accountant cannot end up in the day view, and `provider.employee_id` is unique among live rows,
 * so one member of staff has at most one provider record.
 *
 * The licence column is the reason this is not a plain name-and-status screen: practising on an
 * expired licence is a legal problem, and the expiry is the one field a manager comes here to read.
 */
export const config: LookupConfig = {
	// "Dentist" on screen, `provider` in the schema: the clinic's word, and the table's.
	entity: 'Dentist',
	plural: 'Dentists',
	fields: [
		{
			name: 'employeeId',
			label: 'Member of staff',
			type: 'reference',
			options: 'employeeList',
			display: 'employee',
			picker: 'combo'
		},
		{ name: 'title', label: 'Title', type: 'text', required: false, placeholder: 'Dr' },
		{
			name: 'specialtyId',
			label: 'Specialty',
			type: 'reference',
			required: false,
			options: 'specialtyList',
			display: 'specialty',
			picker: 'select'
		},
		{
			name: 'abbreviation',
			label: 'Short name',
			type: 'text',
			required: false,
			placeholder: 'Dr A.K.',
			inTable: false
		},
		{ name: 'licenceNumber', label: 'Licence number', type: 'text', required: false },
		{
			name: 'licenceBody',
			label: 'Issued by',
			type: 'text',
			required: false,
			placeholder: 'Ministry of Health',
			inTable: false
		},
		{ name: 'licenceIssuedOn', label: 'Issued on', type: 'date', required: false, inTable: false },
		// Shown by `extraColumns` below, which says how long is left rather than only when.
		{
			name: 'licenceExpiresOn',
			label: 'Licence expires',
			type: 'date',
			required: false,
			inTable: false
		},
		{
			name: 'isBookable',
			label: 'Bookable',
			type: 'checkbox',
			required: false,
			trueLabel: 'Bookable',
			falseLabel: 'Not bookable'
		},
		{
			name: 'canPrescribe',
			label: 'May prescribe',
			type: 'checkbox',
			required: false,
			trueLabel: 'Prescribes',
			falseLabel: 'No'
		},
		{
			name: 'defaultAppointmentMinutes',
			label: 'Usual slot (minutes)',
			type: 'number',
			inTable: false
		},
		{
			name: 'colour',
			label: 'Colour',
			type: 'text',
			required: false,
			placeholder: '#2563eb',
			inTable: false
		},
		{ name: 'scheduleNote', label: 'Schedule note', type: 'text', required: false, inTable: false },
		{ name: 'status', label: 'Status', type: 'boolean' }
	],
	extraColumns: [
		{
			id: 'licence',
			header: 'Licence',
			cell: ({ row }) => {
				// A `LookupRow`'s columns are `unknown` — the descriptor is generic over tables — so the
				// date is narrowed here rather than asserted (CLAUDE.md §3).
				const expires = row.original.licenceExpiresOn;
				const on = typeof expires === 'string' || expires instanceof Date ? expires : null;
				return renderComponent(ExpiryCell, { expiresOn: on, warningDays: LICENCE_WARNING_DAYS });
			}
		}
	]
};
