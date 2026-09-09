import type { ColumnDef } from '@tanstack/table-core';

/**
 * The shape of an admin-panel lookup screen, as data.
 *
 * Eighteen routes under `admin-panel/` are the same screen — a table of rows with a name, some
 * attributes and a status, plus an add dialog and an edit dialog. They were written out
 * eighteen times: `educational-level/edit.svelte` and `employment-status/edit.svelte` were
 * byte-identical, and their pages were 96% identical. The entire difference between any two of
 * them is the table, the entity name, and the field list.
 *
 * All three are data, so they live here. A new lookup table is a `LookupConfig` and nothing
 * else — see `LookupPage.svelte`.
 *
 * Non-goals: a multi-row editor, or a screen with actions of its own. Those keep their own
 * pages. Foreign keys *are* covered — see the `reference` field type.
 *
 * To extend: add an optional property here and honour it in `LookupFields.svelte` (the form),
 * `columns.ts` (the table) and, if it needs data, `contentCrud` (the load). Defaulting it to
 * today's behaviour keeps every existing config working, which is the rule in CLAUDE.md §1.
 */

/** How a field is entered, and how it renders in the table. */
export type LookupFieldType =
	/** Single-line text. */
	| 'text'
	/** Multi-line text. */
	| 'textarea'
	/** Numeric input; rendered right-aligned in the table. */
	| 'number'
	/** A true/false choice shown as a dropdown, and as a status badge in the table. */
	| 'boolean'
	/** A true/false choice shown as a single checkbox, and as a status badge in the table. */
	| 'checkbox'
	/**
	 * A foreign key. Entered through a picker of real options, and shown in the table as the
	 * referenced row's name rather than its id. Requires `options` and `display`.
	 */
	| 'reference';

export type LookupField = {
	/** The column on the table and the key in the form. */
	name: string;
	/** Shown above the input, and as the column header. */
	label: string;
	type: LookupFieldType;
	placeholder?: string;
	/** Defaults to true — every lookup column in this app is required. */
	required?: boolean;
	/** Rows for a `textarea`. */
	rows?: number;
	/**
	 * Badge and dropdown wording for `boolean` and `checkbox` fields. `Statuses` already knows
	 * active/inactive, removable/unremovable and calculated/not calculated, so those render in
	 * colour; anything else falls back to grey, which is what these pages did before.
	 */
	trueLabel?: string;
	falseLabel?: string;
	/** Show as a table column. Defaults to true. */
	inTable?: boolean;
	/** Show in the add and edit forms. Defaults to true. */
	inForm?: boolean;

	// ── `reference` fields only ────────────────────────────────────────────────────────────────

	/**
	 * The key in the page's load data holding this field's options, as `{ value, name }[]` —
	 * `'regionList'`, say. Populated by `contentCrud`'s `references` option, which is where the
	 * matching query lives.
	 */
	options?: string;
	/**
	 * The key on the row carrying the referenced row's name, for the table cell — `'region'`.
	 * Without it the table would print a raw id.
	 */
	display?: string;
	/**
	 * `combo` is a searchable popover, `select` a plain dropdown. Defaults to `combo`, which is
	 * what the longer lists (cities, departments) already used.
	 */
	picker?: 'combo' | 'select';
};

export type LookupConfig = {
	/** Singular, title case — 'Educational Level'. Used in headings, buttons and the delete prompt. */
	entity: string;
	/** Plural, title case — 'Educational Levels'. Used in the page title and the export filename. */
	plural: string;
	/**
	 * In display order, for both the table and the forms.
	 *
	 * The **first field is the label column**: it renders as the link that opens the edit dialog,
	 * which is how every one of these pages already behaved.
	 */
	fields: LookupField[];
	/**
	 * Columns the descriptor cannot express, inserted after the fields and before Edit/Delete.
	 *
	 * The escape hatch, so a screen with one unusual column does not have to fork the whole
	 * page. If you find yourself using it twice for the same shape, that is a new field type.
	 */
	extraColumns?: ColumnDef<LookupRow>[];
};

/** A row of a lookup table. Columns vary per table, so this is as narrow as it can honestly be. */
export type LookupRow = { id: number } & Record<string, unknown>;

/** One `{ value, name }` option for a `reference` picker, as `fastData` returns them. */
export type LookupOption = { value: number; name: string };

/** Options for every `reference` field on a screen, keyed by the field's own `name`. */
export type LookupOptions = Record<string, LookupOption[]>;
