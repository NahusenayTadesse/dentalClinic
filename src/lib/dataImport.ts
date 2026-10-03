/**
 * Bringing lists in from a spreadsheet: the part the screen, the template and the server share.
 *
 * A clinic moving onto the system arrives with its people already written down — a patient
 * register in Excel, a staff list from HR, the insurers' details on someone's laptop. Typing those
 * in one form at a time is days of work and the reason a clinic would put off starting. The import
 * screen takes the file instead, checks every row, and writes the rows that pass through the same
 * code the forms use (`insertPatient`, `addPayer`, `addEmployee`, `addSupplier`).
 *
 * What this module owns:
 *
 *   - **which lists can be imported, and their columns** (`IMPORT_LISTS`) — the template is drawn
 *     from these, and the file is read against them, so the two cannot disagree
 *   - **recognising a heading** (`matchHeadings`) — "Father's Name *", "father name" and
 *     "FatherName" are one column; a person's own spreadsheet will not use our exact words
 *   - **reading a cell** — dates in either calendar, phone numbers Excel has taken the 0 off, yes
 *     and no, names in a list (`dateCell`, `phoneCell`, `yesNoCell`, `lookupKey`)
 *   - **the report** the server sends back (`ImportReport`)
 *
 * Client-safe: no database, no Node. What a row must contain to be valid is not here — each list is
 * validated by its own form's schema, on the server, so an imported patient is exactly as valid as
 * a registered one.
 *
 * Non-goals: updating records that already exist (a row that matches one is reported and left
 * out, never merged into it), and importing anything clinical — appointments, charts, balances —
 * whose history cannot honestly be reconstructed from a row of cells.
 */
import { ethiopianToIso, ethiopianYearEnd } from '$lib/ethiopianCalendar';

/** The lists that can be imported. */
export const IMPORT_KINDS = ['patients', 'payers', 'employees', 'suppliers'] as const;
export type ImportKind = (typeof IMPORT_KINDS)[number];

export function isImportKind(value: unknown): value is ImportKind {
	return typeof value === 'string' && (IMPORT_KINDS as readonly string[]).includes(value);
}

/** The calendar a file's dates are written in. Asked of the person, never guessed: see `dateCell`. */
export type DateCalendar = 'gregorian' | 'ethiopian';

/** One column a list takes. */
export type ImportColumn = {
	/** The field it fills, and the key the server reads it by. */
	key: string;
	/** The heading in the template. */
	label: string;
	required?: boolean;
	/** What to write in it, for the template's instructions and the screen's column guide. */
	hint: string;
	/** Other headings that mean the same column — what a clinic's own spreadsheet likely says. */
	aliases?: string[];
	/** The reference list its value must be a name from. The template lists the names allowed. */
	list?: ImportListName;
	/** A date: read in the calendar the person chose. */
	date?: boolean;
	/**
	 * Formatted as text in the Excel template, so Excel keeps a phone's or a TIN's leading 0 and a
	 * date the way it was typed, instead of turning them into numbers.
	 */
	text?: boolean;
};

/** The reference lists a column can be matched against. */
export type ImportListName =
	| 'allergens'
	| 'referralSources'
	| 'payers'
	| 'subcities'
	| 'departments'
	| 'positions'
	| 'employmentStatuses'
	| 'educationalLevels';

/** What each reference list is called on screen, and where it is kept. */
export const LIST_NAMES: Record<ImportListName, { title: string; where: string }> = {
	allergens: { title: 'Allergens', where: 'Clinic Setup → Allergens' },
	referralSources: { title: 'Referral Sources', where: 'Clinic Setup → Referral Sources' },
	payers: { title: 'Payers', where: 'Payers → All Payers' },
	subcities: { title: 'Subcities', where: 'Admin Panel → Subcities' },
	departments: { title: 'Departments', where: 'Admin Panel → Departments' },
	positions: { title: 'Positions', where: 'Admin Panel → Positions' },
	employmentStatuses: { title: 'Employment Statuses', where: 'Admin Panel → Employment Status' },
	educationalLevels: { title: 'Educational Levels', where: 'Admin Panel → Educational Level' }
};

/** One importable list. */
export type ImportList = {
	kind: ImportKind;
	/** "Patients" */
	title: string;
	/** "patient", for counts: "312 patients". */
	one: string;
	many: string;
	/** A sentence for the screen. */
	blurb: string;
	/** Where the imported records can be seen. */
	listUrl: string;
	/** Said before importing when the records enter an approval queue rather than going live. */
	approval?: string;
	/**
	 * The records are filed at the branch being worked at, so they cannot be imported while looking
	 * at "all branches", which is not a place (CLAUDE.md §15).
	 */
	needsBranch?: boolean;
	columns: ImportColumn[];
};

const GIVEN = ['first name', 'name', 'given'];
const FATHER = ['father name', 'fathers name', 'middle name'];
const GRANDFATHER = ['grandfather name', 'grand father name', 'last name', 'surname'];
const PHONE = ['phone number', 'mobile', 'mobile number', 'telephone', 'tel'];
const DAY = 'Day/month/year, like 15/03/1990, or 1990-03-15';

/** Columns every address takes — payers, suppliers and staff are each given one. */
function addressColumns(subcityRequired: boolean): ImportColumn[] {
	return [
		{
			key: 'subcity',
			label: 'Subcity',
			required: subcityRequired,
			hint: 'A subcity from the list',
			list: 'subcities',
			aliases: ['sub city', 'woreda']
		},
		{ key: 'street', label: 'Street', hint: 'Street or area name' },
		{ key: 'kebele', label: 'Kebele', hint: 'Kebele number or name', text: true },
		{ key: 'buildingNumber', label: 'Building number', hint: 'Up to 10 characters', text: true },
		{ key: 'floor', label: 'Floor', hint: 'A number' },
		{ key: 'houseNumber', label: 'House number', hint: 'A number', aliases: ['house no'] }
	];
}

const BLOOD = {
	key: 'bloodType',
	label: 'Blood type',
	hint: 'A+, A-, B+, B-, AB+, AB-, O+ or O-',
	aliases: ['blood group']
} satisfies ImportColumn;

export const IMPORT_LISTS: Record<ImportKind, ImportList> = {
	patients: {
		kind: 'patients',
		title: 'Patients',
		one: 'patient',
		many: 'patients',
		blurb:
			'Your patient register: names, phones, birth dates or ages, allergies, and who pays. Charts, appointments and balances are not imported — they start here.',
		listUrl: '/dashboard/patients',
		columns: [
			{
				key: 'fileNo',
				label: 'File number',
				hint: 'The number on the paper chart. Must not already be in use.',
				aliases: ['file no', 'card number', 'card no', 'mrn', 'chart number'],
				text: true
			},
			{ key: 'name', label: 'Given name', required: true, hint: 'The first name', aliases: GIVEN },
			{
				key: 'fatherName',
				label: 'Father’s name',
				required: true,
				hint: 'The father’s name',
				aliases: FATHER
			},
			{
				key: 'grandFatherName',
				label: 'Grandfather’s name',
				hint: 'Leave empty if not known',
				aliases: GRANDFATHER
			},
			{
				key: 'sex',
				label: 'Sex',
				required: true,
				hint: 'Female or Male (F or M)',
				aliases: ['gender']
			},
			{
				key: 'birthDate',
				label: 'Birth date',
				hint: `${DAY}. Leave empty and give the age instead if the day is not known.`,
				aliases: ['date of birth', 'dob', 'born'],
				date: true,
				text: true
			},
			{
				key: 'ageYears',
				label: 'Age',
				hint: 'Whole years — used only when there is no birth date, and saved as an estimate',
				aliases: ['age years', 'age in years']
			},
			{ key: 'phone', label: 'Phone', hint: 'Like 0911 23 45 67', aliases: PHONE, text: true },
			{
				key: 'altPhone',
				label: 'Second phone',
				hint: 'Another number, if there is one',
				aliases: ['other phone', 'alternative phone', 'phone 2', 'alt phone'],
				text: true
			},
			BLOOD,
			{
				key: 'allergies',
				label: 'Allergies',
				hint: 'Names from the list, separated by commas. A name not on the list stops the row, so an allergy is never quietly dropped.',
				list: 'allergens',
				aliases: ['allergy', 'allergic to']
			},
			{
				key: 'referralSource',
				label: 'How they heard of us',
				hint: 'A referral source from the list',
				list: 'referralSources',
				aliases: ['referral source', 'referral', 'source']
			},
			{
				key: 'referredBy',
				label: 'Referred by',
				hint: 'The person who sent them, if any'
			},
			{
				key: 'payer',
				label: 'Payer',
				hint: 'The employer or insurer who pays, by name or TIN, as registered under Payers',
				list: 'payers',
				aliases: ['insurer', 'insurance', 'employer', 'company']
			},
			{
				key: 'medicalNotes',
				label: 'Medical notes',
				hint: 'Medical history that has nowhere else to go',
				aliases: ['notes', 'medical history', 'history']
			}
		]
	},

	payers: {
		kind: 'payers',
		title: 'Payers',
		one: 'payer',
		many: 'payers',
		blurb:
			'Employers and insurers that pay for some patients. Import these before patients, so a patient’s payer can be named.',
		listUrl: '/dashboard/customers',
		approval: 'Payers wait in Approvals → Payers until somebody approves them.',
		columns: [
			{ key: 'name', label: 'Name', required: true, hint: 'As it should appear on bills' },
			{
				key: 'phone',
				label: 'Phone',
				required: true,
				hint: 'Like 011 123 4567',
				aliases: PHONE,
				text: true
			},
			{ key: 'email', label: 'Email', hint: 'The accounts office’s address', aliases: ['e-mail'] },
			{
				key: 'tinNo',
				label: 'TIN',
				required: true,
				hint: '10 digits',
				aliases: ['tin number', 'tin no', 'tax number'],
				text: true
			},
			...addressColumns(true).map((c) => (c.key === 'street' ? { ...c, required: true } : c))
		]
	},

	employees: {
		kind: 'employees',
		title: 'Employees',
		one: 'employee',
		many: 'employees',
		blurb:
			'Your staff list, with each person’s department, position and pay. Photos and ID scans are added on each employee’s page afterwards.',
		listUrl: '/dashboard/employees',
		approval:
			'Employees wait in Approvals → Employees, and their salaries in Approvals → Salary Changes, until somebody approves them.',
		needsBranch: true,
		columns: [
			{ key: 'name', label: 'Given name', required: true, hint: 'The first name', aliases: GIVEN },
			{
				key: 'fatherName',
				label: 'Father’s name',
				required: true,
				hint: 'The father’s name',
				aliases: FATHER
			},
			{
				key: 'grandFatherName',
				label: 'Grandfather’s name',
				required: true,
				hint: 'The grandfather’s name',
				aliases: GRANDFATHER
			},
			{
				key: 'gender',
				label: 'Gender',
				required: true,
				hint: 'Female or Male (F or M)',
				aliases: ['sex']
			},
			{
				key: 'birthDate',
				label: 'Birth date',
				required: true,
				hint: `${DAY}. At least 18 years ago.`,
				aliases: ['date of birth', 'dob'],
				date: true,
				text: true
			},
			{
				key: 'hireDate',
				label: 'Hire date',
				required: true,
				hint: `${DAY}. The opening salary starts on this day.`,
				aliases: ['date hired', 'start date', 'employment date', 'joined'],
				date: true,
				text: true
			},
			{
				key: 'phone',
				label: 'Phone',
				required: true,
				hint: 'Like 0911 23 45 67',
				aliases: PHONE,
				text: true
			},
			{ key: 'email', label: 'Email', hint: 'Their own address', aliases: ['e-mail'] },
			{ key: 'nationality', label: 'Nationality', hint: 'Ethiopia if left empty' },
			BLOOD,
			{
				key: 'tinNo',
				label: 'TIN',
				hint: '10 digits',
				aliases: ['tin number', 'tin no', 'tax number'],
				text: true
			},
			{
				key: 'martialStatus',
				label: 'Marital status',
				hint: 'Single, Married, Widowed, Divorced or Other — Single if left empty',
				aliases: ['martial status', 'marital']
			},
			{
				key: 'department',
				label: 'Department',
				required: true,
				hint: 'A department from the list',
				list: 'departments'
			},
			{
				key: 'position',
				label: 'Position',
				required: true,
				hint: 'A position from the list, in that department',
				list: 'positions',
				aliases: ['job title', 'title', 'role']
			},
			{
				key: 'employmentStatus',
				label: 'Employment status',
				required: true,
				hint: 'From the list — permanent, contract, and so on',
				list: 'employmentStatuses',
				aliases: ['employment type', 'status']
			},
			{
				key: 'educationalLevel',
				label: 'Educational level',
				hint: 'From the list',
				list: 'educationalLevels',
				aliases: ['education', 'education level']
			},
			{
				key: 'salary',
				label: 'Basic salary',
				required: true,
				hint: 'Birr a month, like 12000',
				aliases: ['salary', 'gross salary', 'basic pay']
			},
			{ key: 'positionAllowance', label: 'Position allowance', hint: 'Birr a month; 0 if empty' },
			{ key: 'transportAllowance', label: 'Transport allowance', hint: 'Birr a month; 0 if empty' },
			{ key: 'housingAllowance', label: 'Housing allowance', hint: 'Birr a month; 0 if empty' },
			{
				key: 'nonTaxAllowance',
				label: 'Non-taxable allowance',
				hint: 'Birr a month; 0 if empty',
				aliases: ['non taxable allowance']
			},
			...addressColumns(false)
		]
	},

	suppliers: {
		kind: 'suppliers',
		title: 'Suppliers',
		one: 'supplier',
		many: 'suppliers',
		blurb: 'Who the clinic buys supplies from.',
		listUrl: '/dashboard/supplies/suppliers',
		columns: [
			{ key: 'name', label: 'Name', required: true, hint: 'Up to 50 characters' },
			{
				key: 'phone',
				label: 'Phone',
				required: true,
				hint: 'Like 0911 23 45 67',
				aliases: PHONE,
				text: true
			},
			{ key: 'email', label: 'Email', hint: 'Their address', aliases: ['e-mail'] },
			{
				key: 'description',
				label: 'What they supply',
				hint: 'A short note',
				aliases: ['description', 'notes']
			},
			...addressColumns(true),
			{
				key: 'status',
				label: 'Active',
				hint: 'Yes or No — Yes if left empty',
				aliases: ['status', 'is active']
			}
		]
	}
};

/** Whether the list has a date column, so the screen must ask which calendar the file uses. */
export function hasDates(kind: ImportKind): boolean {
	return IMPORT_LISTS[kind].columns.some((c) => c.date);
}

/* ── Headings ──────────────────────────────────────────────────────────────────────────────── */

/**
 * A heading reduced to what identifies it: letters and digits only, lower case. The template's
 * "Father’s name *" and a clinic's "FATHER NAME" both become `fathersname`/`fathername`, which is
 * why the aliases list both spellings.
 */
export function headingKey(heading: string): string {
	return heading
		.normalize('NFKC')
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, '');
}

/** How a file's headings line up with a list's columns. */
export type HeadingMatch = {
	/** The column each heading is, by position; undefined for a heading that is not one of them. */
	columns: (ImportColumn | undefined)[];
	/** Required columns the file does not have. */
	missing: ImportColumn[];
	/** Headings that are no column of this list — ignored, and said so. */
	ignored: string[];
	/** Columns given twice. Only the first is read. */
	repeated: string[];
};

export function matchHeadings(headings: string[], columns: ImportColumn[]): HeadingMatch {
	const byKey = new Map<string, ImportColumn>();
	for (const column of columns) {
		for (const name of [column.label, column.key, ...(column.aliases ?? [])]) {
			byKey.set(headingKey(name), column);
		}
	}

	const seen = new Set<string>();
	const ignored: string[] = [];
	const repeated: string[] = [];
	const matched = headings.map((heading) => {
		const key = headingKey(heading);
		if (!key) return undefined;
		const column = byKey.get(key);
		if (!column) {
			ignored.push(heading.trim());
			return undefined;
		}
		if (seen.has(column.key)) {
			repeated.push(heading.trim());
			return undefined;
		}
		seen.add(column.key);
		return column;
	});

	return {
		columns: matched,
		missing: columns.filter((c) => c.required && !seen.has(c.key)),
		ignored,
		repeated
	};
}

/* ── Cells ─────────────────────────────────────────────────────────────────────────────────── */

/** A cell as the spreadsheet readers hand it over. */
export type Cell = string | number | boolean | Date | null;

/** A Date's calendar day, read in UTC — Excel dates carry no time zone, and the reader gives UTC. */
function utcDay(date: Date): { year: number; month: number; day: number } {
	return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** A cell as trimmed text. A number is written plainly; a date as `YYYY-MM-DD`. */
export function cellText(cell: Cell | undefined): string {
	if (cell === null || cell === undefined) return '';
	if (cell instanceof Date) {
		const { year, month, day } = utcDay(cell);
		return `${year}-${pad(month)}-${pad(day)}`;
	}
	if (typeof cell === 'boolean') return cell ? 'yes' : 'no';
	return String(cell).trim();
}

/** A name or a short value as text, with runs of spaces closed up. */
export function nameText(cell: Cell | undefined): string {
	return cellText(cell).replace(/\s+/g, ' ');
}

/**
 * A phone number as text, with the leading 0 put back where Excel took it off.
 *
 * Every Ethiopian number dialled at home is ten digits starting with 0 — 09… and 07… for mobiles,
 * 011…, 022… and the rest for landlines. Excel reads "0911234567" as the number 911,234,567 and
 * drops the 0, in a cell it was never told is text, and on every CSV it opens. So exactly nine
 * digits, and nothing else, is one of ours missing its 0. Anything else is left as written for the
 * form's own check to judge.
 */
export function phoneCell(cell: Cell | undefined): string {
	const text = cellText(cell);
	return /^\d{9}$/.test(text) ? `0${text}` : text;
}

/** An amount of money: commas and a trailing "birr" or "ETB" allowed, as people type them. */
export function moneyText(cell: Cell | undefined): string {
	if (typeof cell === 'number') return String(cell);
	return cellText(cell)
		.replace(/,/g, '')
		.replace(/\s*(birr|etb|br)\.?$/i, '')
		.trim();
}

/** The outcome of reading a cell that can be wrong. */
export type CellResult<T> = { ok: true; value: T } | { ok: false; message: string };

const YES = ['yes', 'y', 'true', '1', 'active', 'አዎ'];
const NO = ['no', 'n', 'false', '0', 'inactive', 'አይ', 'የለም'];

/** A yes-or-no cell; empty is `undefined`, for the column's own default. */
export function yesNoCell(cell: Cell | undefined): CellResult<boolean | undefined> {
	if (typeof cell === 'boolean') return { ok: true, value: cell };
	const text = cellText(cell).toLowerCase();
	if (!text) return { ok: true, value: undefined };
	if (YES.includes(text)) return { ok: true, value: true };
	if (NO.includes(text)) return { ok: true, value: false };
	return { ok: false, message: `Write Yes or No, not “${cellText(cell)}”` };
}

/**
 * One of a few fixed values, by any of its spellings. Empty is `''`; a value nobody spells that
 * way is returned as written, for the form's schema to refuse in its own words.
 */
export function choiceCell(cell: Cell | undefined, choices: Record<string, string[]>): string {
	const text = cellText(cell);
	const key = text.toLowerCase().replace(/\s+/g, '');
	for (const [value, spellings] of Object.entries(choices)) {
		if (key === value.toLowerCase() || spellings.includes(key)) return value;
	}
	return text;
}

/** The spellings `choiceCell` accepts for a person's sex. */
export const SEX_CHOICES = {
	female: ['f', 'female', 'woman', 'ሴት'],
	male: ['m', 'male', 'man', 'ወንድ']
};

/**
 * A date cell as a Gregorian `YYYY-MM-DD`, which is what every form posts and the database keeps.
 *
 * **The calendar is the person's answer, not a guess.** 15/03/2016 is a perfectly good day in
 * both calendars, seven and a half years apart, and nothing in the cell says which. A wrong guess
 * would not fail — it would file every birth date years out, and every age on screen with them. So
 * the screen asks once for the whole file, and the preview shows the result.
 *
 * Accepted: a date cell (Excel's own dates, read as the day shown — an Ethiopian day typed into a
 * date-formatted cell is still the day the person typed), `YYYY-MM-DD`, and day first —
 * `DD/MM/YYYY`, with `/`, `-` or `.` — which is how dates are written here. Month-first is not
 * accepted, because 03/04 cannot then be told from 04/03.
 */
export function dateCell(
	cell: Cell | undefined,
	calendar: DateCalendar
): CellResult<string | undefined> {
	if (cell === null || cell === undefined || cellText(cell) === '')
		return { ok: true, value: undefined };

	let parts: { year: number; month: number; day: number } | undefined;
	if (cell instanceof Date) {
		parts = utcDay(cell);
	} else if (typeof cell === 'string') {
		const text = cell.trim();
		const isoLike = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(text);
		const dayFirst = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(text);
		if (isoLike) parts = { year: +isoLike[1], month: +isoLike[2], day: +isoLike[3] };
		else if (dayFirst) parts = { year: +dayFirst[3], month: +dayFirst[2], day: +dayFirst[1] };
	}

	if (!parts) {
		return {
			ok: false,
			message: `Write the date as day/month/year, like 15/03/1990, not “${cellText(cell)}”`
		};
	}

	const { year, month, day } = parts;
	const written = `${pad(day)}/${pad(month)}/${year}`;

	if (calendar === 'gregorian') {
		const date = new Date(Date.UTC(year, month - 1, day));
		if (
			date.getUTCFullYear() !== year ||
			date.getUTCMonth() !== month - 1 ||
			date.getUTCDate() !== day
		) {
			return { ok: false, message: `${written} is not a day in the Gregorian calendar` };
		}
		return { ok: true, value: `${year}-${pad(month)}-${pad(day)}` };
	}

	// Thirteen months: twelve of thirty days, and Pagume of five or six.
	if (year < 1000 || month < 1 || month > 13 || day < 1 || day > (month === 13 ? 6 : 30)) {
		return { ok: false, message: `${written} is not a day in the Ethiopian calendar` };
	}
	const iso = ethiopianToIso(year, month, day);
	if (month === 13 && iso > ethiopianYearEnd(year)) {
		return { ok: false, message: `Pagume ${year} has only five days, so ${written} is not a day` };
	}
	return { ok: true, value: iso };
}

/**
 * A name as reference lists are matched on: case, spacing and the shape of Unicode ignored.
 * "Penicillin", "penicillin " and "PENICILLIN" are one allergen.
 */
export function lookupKey(name: string): string {
	return name.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

/* ── The report ────────────────────────────────────────────────────────────────────────────── */

/**
 * The most problems and matches a report lists. The counts are always whole; past this the screen
 * says how many more there are, rather than sending a thousand lines nobody reads before fixing the
 * first ten — which are usually one mistake repeated.
 */
export const REPORT_LIMIT = 200;

/** A row that cannot be imported, and why. `row` is the row number Excel shows. */
export type ImportProblem = { row: number; column?: string; message: string };

/** A row that looks like a record already here, or like an earlier row in the file. */
export type ImportMatch = {
	row: number;
	/** Who the row describes. */
	name: string;
	matches: { name: string; reason: string; href?: string }[];
};

export type ImportReport = {
	kind: ImportKind;
	/** The file the report is about, so the screen can tell when a different one has been chosen. */
	file: { name: string; size: number };
	/** Rows with anything in them, after the headings. */
	rows: number;
	/** Rows that will be imported, or were. */
	ready: number;
	problemRows: number;
	problems: ImportProblem[];
	/** Problems past `REPORT_LIMIT`, not listed. A row can have several, one per column. */
	problemsHidden: number;
	duplicateRows: number;
	duplicates: ImportMatch[];
	/** Whether rows like records already here are imported anyway. */
	includeDuplicates: boolean;
	/** Headings in the file that are no column of the list. */
	ignored: string[];
	/** The first few ready rows, as they will be saved. */
	preview: { headings: string[]; rows: { row: number; cells: string[] }[] };
	/** Set once the rows are saved: how many were. */
	imported?: number;
};

/** How many of a list, in words: "1 patient", "312 patients". */
export function countOf(kind: ImportKind, n: number): string {
	const list = IMPORT_LISTS[kind];
	return `${n.toLocaleString('en-US')} ${n === 1 ? list.one : list.many}`;
}
