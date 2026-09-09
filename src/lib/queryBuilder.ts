/**
 * Typed, composable row filtering for data tables.
 *
 * `FilterMenu` already handles "pick some values from this column", but it can
 * only do exact matches on categorical text. Pages whose interesting columns are
 * numbers or dates — stock levels, leases, supplier spend — need comparisons:
 * "free to lease under 5", "still out and due back before today", "spend over
 * 10,000". That is what this adds.
 *
 * The evaluation is pure and data-shape agnostic; the component in
 * `Table/QueryBuilder.svelte` is only the UI over it. Filtering happens on the
 * client over the rows the page already loaded, which matches how every other
 * table in this app works. If one of these tables ever outgrows loading in full,
 * the `FieldDef` list is the thing that would move to the server — the field
 * keys and operators are already declarative enough to compile into SQL.
 */

export type FieldType = 'number' | 'text' | 'date' | 'enum' | 'boolean';

export type FieldDef = {
	/** Property on the row object. */
	key: string;
	label: string;
	type: FieldType;
	/** For `enum`. Derived from the data when omitted. */
	options?: { value: string; label: string }[];
	/** Shown after number inputs, e.g. "pcs". */
	unit?: string;
	/** Longer explanation shown under the condition row. */
	hint?: string;
};

export type Operator =
	// numbers and dates
	| 'eq'
	| 'ne'
	| 'gt'
	| 'gte'
	| 'lt'
	| 'lte'
	| 'between'
	// dates only — `before`/`after` read better than `lt`/`gt` on a date and are
	// aliased onto them at evaluation time
	| 'before'
	| 'after'
	| 'lastDays'
	| 'nextDays'
	// text
	| 'contains'
	| 'notContains'
	| 'startsWith'
	| 'endsWith'
	// enum
	| 'anyOf'
	| 'noneOf'
	// boolean
	| 'isTrue'
	| 'isFalse'
	// any type
	| 'empty'
	| 'notEmpty';

export type Condition = {
	id: string;
	field: string;
	operator: Operator;
	/** Primary operand. */
	value: string;
	/** Upper bound, for `between`. */
	value2: string;
	/** Selected members, for `anyOf` / `noneOf`. */
	values: string[];
};

export type MatchMode = 'all' | 'any';

/** A one-click filter offered above the builder. */
export type Preset = {
	label: string;
	description?: string;
	match?: MatchMode;
	conditions: Array<Partial<Condition> & { field: string; operator: Operator }>;
};

const OPERATOR_LABELS: Record<Operator, string> = {
	eq: 'is',
	ne: 'is not',
	gt: 'is more than',
	gte: 'is at least',
	lt: 'is less than',
	lte: 'is at most',
	between: 'is between',
	before: 'is before',
	after: 'is after',
	lastDays: 'is within the last',
	nextDays: 'is within the next',
	contains: 'contains',
	notContains: 'does not contain',
	startsWith: 'starts with',
	endsWith: 'ends with',
	anyOf: 'is any of',
	noneOf: 'is none of',
	isTrue: 'is yes',
	isFalse: 'is no',
	empty: 'is empty',
	notEmpty: 'is not empty'
};

const BY_TYPE: Record<FieldType, Operator[]> = {
	number: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between', 'empty', 'notEmpty'],
	date: [
		'eq',
		'before' as Operator,
		'after' as Operator,
		'between',
		'lastDays',
		'nextDays',
		'empty',
		'notEmpty'
	],
	text: ['contains', 'notContains', 'eq', 'ne', 'startsWith', 'endsWith', 'empty', 'notEmpty'],
	enum: ['anyOf', 'noneOf', 'empty', 'notEmpty'],
	boolean: ['isTrue', 'isFalse']
};

/** `before`/`after` behave identically to `lt`/`gt`; only the wording differs. */
const DATE_ALIASES: Partial<Record<Operator, Operator>> = { before: 'lt', after: 'gt' };

export function operatorsFor(type: FieldType): { value: string; name: string }[] {
	if (type === 'date') {
		return [
			{ value: 'eq', name: 'is on' },
			{ value: 'before', name: 'is before' },
			{ value: 'after', name: 'is after' },
			{ value: 'between', name: 'is between' },
			{ value: 'lastDays', name: 'is within the last (days)' },
			{ value: 'nextDays', name: 'is within the next (days)' },
			{ value: 'empty', name: 'is empty' },
			{ value: 'notEmpty', name: 'is not empty' }
		];
	}

	return BY_TYPE[type].map((op) => ({ value: op, name: OPERATOR_LABELS[op] }));
}

/** Operators that take no operand, so the UI hides the value input. */
export const NO_OPERAND: Operator[] = ['empty', 'notEmpty', 'isTrue', 'isFalse'];

export function defaultOperator(type: FieldType): Operator {
	return type === 'enum' ? 'anyOf' : type === 'boolean' ? 'isTrue' : BY_TYPE[type][0];
}

/** Distinct values of a field, for an `enum` with no explicit options. */
export function optionsFromData(rows: any[], key: string): { value: string; label: string }[] {
	const seen = new Set<string>();

	for (const row of rows) {
		const raw = row?.[key];
		if (raw === null || raw === undefined || raw === '') continue;
		seen.add(String(raw));
	}

	return [...seen].sort((a, b) => a.localeCompare(b)).map((v) => ({ value: v, label: v }));
}

function toNumber(value: unknown): number | null {
	if (value === null || value === undefined || value === '') return null;
	const n = Number(value);
	return Number.isNaN(n) ? null : n;
}

function toDate(value: unknown): Date | null {
	if (!value) return null;
	const d = value instanceof Date ? value : new Date(String(value));
	return isNaN(d.getTime()) ? null : d;
}

/** Midnight, so a date comparison is not thrown off by the time of day. */
function startOfDay(d: Date): number {
	return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function isBlank(value: unknown): boolean {
	return value === null || value === undefined || value === '';
}

/** Whether one row satisfies one condition. Unknown fields never filter. */
export function matches(row: any, condition: Condition, fields: FieldDef[]): boolean {
	const field = fields.find((f) => f.key === condition.field);
	if (!field) return true;

	const raw = row?.[field.key];
	const operator = (DATE_ALIASES[condition.operator] ?? condition.operator) as Operator;

	if (operator === 'empty') return isBlank(raw);
	if (operator === 'notEmpty') return !isBlank(raw);

	switch (field.type) {
		case 'boolean': {
			const truthy = Boolean(raw);
			return operator === 'isTrue' ? truthy : !truthy;
		}

		case 'enum': {
			// An empty selection is "no opinion", not "match nothing" — otherwise
			// adding a row to the builder would blank the table before it is filled in.
			if (!condition.values.length) return true;
			const hit = condition.values.includes(String(raw ?? ''));
			return operator === 'noneOf' ? !hit : hit;
		}

		case 'number': {
			const actual = toNumber(raw);
			const a = toNumber(condition.value);
			if (actual === null) return false;
			if (operator === 'between') {
				const b = toNumber(condition.value2);
				if (a === null || b === null) return true;
				const [lo, hi] = a <= b ? [a, b] : [b, a];
				return actual >= lo && actual <= hi;
			}
			if (a === null) return true;
			switch (operator) {
				case 'eq':
					return actual === a;
				case 'ne':
					return actual !== a;
				case 'gt':
					return actual > a;
				case 'gte':
					return actual >= a;
				case 'lt':
					return actual < a;
				case 'lte':
					return actual <= a;
				default:
					return true;
			}
		}

		case 'date': {
			const actual = toDate(raw);
			if (actual === null) return false;
			const day = startOfDay(actual);
			const today = startOfDay(new Date());

			if (operator === 'lastDays' || operator === 'nextDays') {
				const span = toNumber(condition.value);
				if (span === null) return true;
				const offset = span * 86400000;
				return operator === 'lastDays'
					? day <= today && day >= today - offset
					: day >= today && day <= today + offset;
			}

			const a = toDate(condition.value);
			if (operator === 'between') {
				const b = toDate(condition.value2);
				if (!a || !b) return true;
				const [lo, hi] =
					startOfDay(a) <= startOfDay(b)
						? [startOfDay(a), startOfDay(b)]
						: [startOfDay(b), startOfDay(a)];
				return day >= lo && day <= hi;
			}
			if (!a) return true;
			const target = startOfDay(a);
			switch (operator) {
				case 'eq':
					return day === target;
				case 'ne':
					return day !== target;
				case 'lt':
					return day < target;
				case 'gt':
					return day > target;
				case 'lte':
					return day <= target;
				case 'gte':
					return day >= target;
				default:
					return true;
			}
		}

		default: {
			// text
			const actual = String(raw ?? '').toLowerCase();
			const needle = condition.value.trim().toLowerCase();
			if (!needle) return true;
			switch (operator) {
				case 'contains':
					return actual.includes(needle);
				case 'notContains':
					return !actual.includes(needle);
				case 'eq':
					return actual === needle;
				case 'ne':
					return actual !== needle;
				case 'startsWith':
					return actual.startsWith(needle);
				case 'endsWith':
					return actual.endsWith(needle);
				default:
					return true;
			}
		}
	}
}

/**
 * Applies the whole query. `all` is AND, `any` is OR. An empty condition list
 * returns the rows untouched.
 */
export function applyQuery<T>(
	rows: T[],
	conditions: Condition[],
	match: MatchMode,
	fields: FieldDef[]
): T[] {
	if (!conditions.length) return rows;

	return rows.filter((row) =>
		match === 'all'
			? conditions.every((c) => matches(row, c, fields))
			: conditions.some((c) => matches(row, c, fields))
	);
}

let counter = 0;

export function newCondition(field: FieldDef): Condition {
	return {
		id: `c${++counter}`,
		field: field.key,
		operator: defaultOperator(field.type),
		value: '',
		value2: '',
		values: []
	};
}

/** Expands a preset into full conditions. */
export function fromPreset(preset: Preset): Condition[] {
	return preset.conditions.map((c) => ({
		id: `c${++counter}`,
		value: '',
		value2: '',
		values: [],
		...c
	}));
}

/** Short human summary of one condition, for the active-filter chips. */
export function describe(condition: Condition, fields: FieldDef[]): string {
	const field = fields.find((f) => f.key === condition.field);
	if (!field) return '';

	const label = operatorsFor(field.type).find((o) => o.value === condition.operator)?.name ?? '';

	if (NO_OPERAND.includes(condition.operator)) return `${field.label} ${label}`;
	if (field.type === 'enum') return `${field.label} ${label} ${condition.values.join(', ') || '…'}`;
	if (condition.operator === 'between')
		return `${field.label} ${label} ${condition.value || '…'} and ${condition.value2 || '…'}`;

	const suffix =
		condition.operator === 'lastDays' || condition.operator === 'nextDays' ? ' days' : '';
	return `${field.label} ${label} ${condition.value || '…'}${suffix}`;
}
