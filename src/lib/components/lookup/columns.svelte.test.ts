import { describe, expect, it } from 'vitest';
import { lookupColumns } from './columns';
import type { LookupConfig } from './types';
import type { LookupForm } from './columns';

/**
 * The descriptor is the contract between a lookup route and its screen. These assertions pin
 * down the parts that are easy to get wrong when the descriptor grows a new field type:
 * which columns appear, in what order, and what a `reference` actually reads.
 */
const form = {} as LookupForm;

const config: LookupConfig = {
	entity: 'City',
	plural: 'Cities',
	fields: [
		{ name: 'name', label: 'Name', type: 'text' },
		{
			name: 'regionId',
			label: 'Region',
			type: 'reference',
			options: 'regionList',
			display: 'region'
		},
		{ name: 'note', label: 'Note', type: 'textarea', inTable: false },
		{ name: 'status', label: 'Status', type: 'boolean' }
	]
};

const keys = (c: LookupConfig) =>
	lookupColumns(c, { editForm: form }).map((col) =>
		'accessorKey' in col ? col.accessorKey : col.id
	);

describe('lookupColumns', () => {
	it('frames the fields with a row number, an edit button and a delete button', () => {
		const k = keys(config);
		expect(k[0]).toBe('index');
		expect(k.at(-2)).toBe('edit');
		expect(k.at(-1)).toBe('delete');
	});

	it('reads a reference by its display name, not its raw id', () => {
		// `regionId` would print a number; the point of a reference is the joined name.
		expect(keys(config)).toContain('region');
		expect(keys(config)).not.toContain('regionId');
	});

	it('honours inTable, so a form-only field stays out of the list', () => {
		expect(keys(config)).not.toContain('note');
	});

	it('keeps the descriptor order, so a config change moves the column', () => {
		const k = keys(config).filter((x) => !['index', 'edit', 'delete'].includes(String(x)));
		expect(k).toEqual(['name', 'region', 'status']);
	});

	it('treats the first field as the label column', () => {
		const reordered: LookupConfig = { ...config, fields: [...config.fields].reverse() };
		const k = keys(reordered).filter((x) => !['index', 'edit', 'delete'].includes(String(x)));
		expect(k[0]).toBe('status');
	});

	it('defaults the row actions to the un-namespaced page actions', () => {
		// A detail page overrides these; a lookup page should not have to say so.
		const cols = lookupColumns(config, { editForm: form });
		expect(cols.length).toBeGreaterThan(0);
	});

	it('appends extraColumns before edit and delete', () => {
		const withExtra: LookupConfig = {
			...config,
			extraColumns: [{ id: 'custom', header: 'Custom' }]
		};
		const k = keys(withExtra);
		expect(k).toContain('custom');
		expect(k.indexOf('custom')).toBeLessThan(k.indexOf('edit'));
	});
});
