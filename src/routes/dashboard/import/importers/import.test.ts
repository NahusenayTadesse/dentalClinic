import { describe, expect, it } from 'vitest';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	allergen,
	employee,
	patient,
	patientAllergies,
	salaries,
	staffContacts
} from '$lib/server/db/schema';
import { inRollback } from '$lib/testing/rollback';
import { readSpreadsheet, SpreadsheetRefused } from '$lib/server/spreadsheet';
import { IMPORT_KINDS, matchHeadings } from '$lib/dataImport';
import { IMPORTERS } from './index.server';
import { checkSheet } from './run.server';
import { templateFor } from './template.server';

/**
 * The import end to end, against the real database: a file is read, its rows parsed by the forms'
 * own schemas, checked against what is stored, and written through the forms' own writes.
 *
 * Reading and checking run outside a transaction — they only read — and the writes run inside one
 * that is rolled back, so the test leaves nothing behind (CLAUDE.md §16). Names carry a marker no
 * clinic uses, so the checks cannot mistake the test's people for real ones.
 */

const csv = (name: string, text: string) => new File([text], name, { type: 'text/csv' });
const MARK = 'Zqimport';

describe('the spreadsheet reader', () => {
	it('reads back every template it writes, with every heading recognised', async () => {
		for (const kind of IMPORT_KINDS) {
			const importer = IMPORTERS[kind];
			const template = await templateFor(importer, 'xlsx');
			const file = new File([template.body], template.name);
			const sheet = await readSpreadsheet(file);

			// The thousand rows formatted as text ahead of time are empty, so none of them is a row.
			expect(sheet.rows, kind).toEqual([]);

			const match = matchHeadings(sheet.headings, importer.list.columns);
			expect(
				match.columns.map((c) => c?.key),
				kind
			).toEqual(importer.list.columns.map((c) => c.key));
			expect(match.ignored, kind).toEqual([]);
		}
	});

	it('keeps Excel’s row numbers across empty lines, and reads a Windows-saved CSV', async () => {
		// "Café" as the Windows code page writes it: é is the single byte 0xE9.
		const bytes = new Uint8Array([
			...new TextEncoder().encode('Name,Phone\n\nCaf'),
			0xe9,
			...new TextEncoder().encode(',911234567\n')
		]);
		const sheet = await readSpreadsheet(new File([bytes], 'old.csv'));
		expect(sheet.headings).toEqual(['Name', 'Phone']);
		expect(sheet.rows).toEqual([{ row: 3, cells: ['Café', '911234567'] }]);
	});

	it('refuses the old .xls format with a way out', async () => {
		await expect(readSpreadsheet(csv('register.xls', 'x'))).rejects.toThrow(SpreadsheetRefused);
	});
});

describe('importing patients', () => {
	const options = { calendar: 'ethiopian' as const, includeDuplicates: false };

	it('refuses a file without the required columns, naming them', async () => {
		await expect(
			checkSheet(IMPORTERS.patients, csv('p.csv', 'First name,Phone\nAbebe,0911\n'), options)
		).rejects.toThrow(/Father’s name.*Sex/);
	});

	it('imports what passes, leaves out what does not, and says why by row', async () => {
		const [anAllergen] = await db
			.select({ id: allergen.id, name: allergen.name })
			.from(allergen)
			.where(and(eq(allergen.isActive, true), isNull(allergen.deletedAt)))
			.limit(1);

		const file = csv(
			'register.csv',
			[
				'First name,Father Name,Grandfather name,Gender,DOB,Age,Mobile,Allergies',
				`${MARK}a,Testa,,F,15/03/1982,,911000001,${anAllergen?.name ?? ''}`,
				`${MARK}b,Testa,,,,,0911000002,`,
				`${MARK}c,Testa,,M,,,0911000003,Not An Allergen ${MARK}`,
				'',
				`${MARK}d,Testa,,M,,,0911000001,`,
				`${MARK}e,Testa,,Female,,40,,`
			].join('\n')
		);

		const { report, ready } = await checkSheet(IMPORTERS.patients, file, options);

		expect(report.rows).toBe(5);
		expect(report.problems).toEqual([
			{ row: 3, column: 'Sex', message: 'Sex is empty' },
			expect.objectContaining({ row: 4, column: 'Allergies' })
		]);
		// Row 6 has row 2's phone — the 0 Excel took off row 2 put back — so it is held back.
		expect(report.duplicates).toEqual([
			expect.objectContaining({
				row: 6,
				matches: [{ name: 'Row 2 of this file', reason: 'Same phone number' }]
			})
		]);
		expect(ready.map((r) => r.row)).toEqual([2, 7]);

		// The Ethiopian date is stored as its Gregorian day; the age as an estimate.
		const [first, aged] = ready.map((r) => r.value as { phone?: string; birthDate?: string });
		expect(first.phone).toBe('0911000001');
		expect(first.birthDate).toBe('1989-11-24');

		await inRollback(async (tx) => {
			const ids = await IMPORTERS.patients.write(
				tx,
				ready.map((r) => r.value),
				{ userId: undefined, branchId: null }
			);
			const rows = await tx
				.select({ birthDate: patient.birthDate, estimated: patient.birthDateEstimated })
				.from(patient)
				.where(eq(patient.id, ids[1]));
			expect(rows[0].estimated).toBe(true);
			expect(String(rows[0].birthDate)).toContain(`${new Date().getFullYear() - 40}`);

			if (anAllergen) {
				const allergies = await tx
					.select({ id: patientAllergies.allergenId, severity: patientAllergies.severity })
					.from(patientAllergies)
					.where(eq(patientAllergies.patientId, ids[0]));
				expect(allergies).toEqual([{ id: anAllergen.id, severity: 'unknown' }]);
			}
		});
		expect(aged).toBeDefined();
	});

	it('imports a possible duplicate when the person says they are different people', async () => {
		const file = csv(
			'twins.csv',
			[
				'Given name,Father’s name,Sex,Phone',
				`${MARK}t,Testa,F,0911000009`,
				`${MARK}u,Testa,M,0911000009`
			].join('\n')
		);
		const held = await checkSheet(IMPORTERS.patients, file, options);
		const taken = await checkSheet(IMPORTERS.patients, file, {
			...options,
			includeDuplicates: true
		});
		expect(held.ready).toHaveLength(1);
		expect(taken.ready).toHaveLength(2);
	});

	it('holds back someone already registered, with a link to their chart', async () => {
		const [someone] = await db
			.select({ id: patient.id, name: patient.name, fatherName: patient.fatherName })
			.from(patient)
			.where(and(isNull(patient.deletedAt), isNull(patient.mergedIntoId)))
			.limit(1);
		if (!someone) return expect(someone).toBeUndefined();

		const { report, ready } = await checkSheet(
			IMPORTERS.patients,
			csv('again.csv', `Given name,Father’s name,Sex\n${someone.name},${someone.fatherName},F\n`),
			options
		);
		expect(ready).toEqual([]);
		expect(report.duplicates[0].matches).toContainEqual(
			expect.objectContaining({ href: `/dashboard/patients/${someone.id}` })
		);
	});
});

describe('importing payers and employees', () => {
	const options = { calendar: 'gregorian' as const, includeDuplicates: false };

	it('says plainly when Excel has eaten a TIN’s leading zero', async () => {
		const sheet = await checkSheet(
			IMPORTERS.payers,
			csv(
				'payers.csv',
				`Name,Phone,TIN,Subcity,Street\n${MARK} Insurance,0111000001,12345678,,Main\n`
			),
			options
		);
		// A CSV cell is text, so this one reads as a short TIN; the schema's own words say so.
		expect(sheet.report.problems).toContainEqual(
			expect.objectContaining({ row: 2, column: 'TIN' })
		);
		expect(sheet.report.problems).toContainEqual({
			row: 2,
			column: 'Subcity',
			message: 'Subcity is empty'
		});
	});

	/*
	 * The add form's write could not save an employee against a strict database: the salary had no
	 * start date, an absent email became an empty contact row, and the transport allowance was
	 * written under a key the table does not have. The import shares that write (`addEmployee`).
	 */
	it('files an employee pending, with an opening salary from the hire date', async () => {
		const lookups = await IMPORTERS.employees.lookups();
		const position = lookups.positions?.find((p) => p.departmentId);
		const department = lookups.departments?.find((d) => d.value === position?.departmentId);
		const status = lookups.employmentStatuses?.[0];
		if (!position || !department || !status) return expect(position).toBeUndefined();

		const { ready } = await checkSheet(
			IMPORTERS.employees,
			csv(
				'staff.csv',
				[
					'Given name,Father’s name,Grandfather’s name,Gender,Birth date,Hire date,Phone,Department,Position,Employment status,Basic salary,Transport allowance',
					`${MARK},Testa,Probe,F,1990-01-01,2024-01-15,0911000011,${department.name},${position.name},${status.name},"12,000",600`
				].join('\n')
			),
			options
		);
		expect(ready).toHaveLength(1);

		await inRollback(async (tx) => {
			const [id] = await IMPORTERS.employees.write(
				tx,
				ready.map((r) => r.value),
				{ userId: undefined, branchId: 1 }
			);
			const [staff] = await tx
				.select({ status: employee.approvalStatus, photo: employee.photo, idNo: employee.idNo })
				.from(employee)
				.where(eq(employee.id, id));
			const [pay] = await tx
				.select({
					start: salaries.startDate,
					amount: salaries.amount,
					transport: salaries.transportationAllowance
				})
				.from(salaries)
				.where(eq(salaries.staffId, id));
			const contacts = await tx
				.select({ type: staffContacts.contactType })
				.from(staffContacts)
				.where(eq(staffContacts.staffId, id));

			expect(staff).toEqual({
				status: 'pending',
				photo: null,
				idNo: expect.stringMatching(`^SP${id}`)
			});
			expect(pay).toEqual({ start: '2024-01-15', amount: '12000.00', transport: '600.00' });
			expect(contacts).toEqual([{ type: 'Phone' }]);
		});
	});

	it('names the department a position belongs to when the row puts it in another', async () => {
		const lookups = await IMPORTERS.employees.lookups();
		const position = lookups.positions?.find((p) => p.departmentId);
		const other = lookups.departments?.find((d) => d.value !== position?.departmentId);
		if (!position || !other) return expect(position && other).toBeFalsy();

		const { report } = await checkSheet(
			IMPORTERS.employees,
			csv(
				'staff.csv',
				[
					'Given name,Father’s name,Grandfather’s name,Gender,Birth date,Hire date,Phone,Department,Position,Employment status,Basic salary',
					`${MARK},Testa,Probe,F,1990-01-01,2024-01-01,0911000010,${other.name},${position.name},x,1000`
				].join('\n')
			),
			options
		);
		expect(report.problems).toContainEqual(
			expect.objectContaining({
				column: 'Position',
				message: `${position.name} is not a position in ${other.name}`
			})
		);
	});
});
