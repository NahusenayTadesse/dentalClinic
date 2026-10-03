/**
 * Importing employees: a staff list, read into the add form's own schema less its four files.
 *
 * Photos, ID scans, signatures and pension cards cannot come from a spreadsheet, so an imported
 * employee has none (see the schema note on `employee.photo`) and gets them on their own page. Each
 * one waits in Approvals → Employees, with their opening salary in Approvals → Salary Changes, as
 * the form's do (`addEmployee`).
 *
 * A position is matched within the row's department: "Manager" may be a position in two
 * departments, and the department column says which. A position named in the wrong department is a
 * problem rather than a guess.
 *
 * Someone with the same three names already on the staff list is a possible duplicate — the form's
 * own check — and is left out unless the person says otherwise.
 */
import { db } from '$lib/server/db';
import { employee } from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';
import { departments, eduLevel, empStatus, positions, subcities } from '$lib/server/fastData';
import { addEmployee, tidyName } from '$lib/server/employees';
import { formatETB } from '$lib/global.svelte';
import {
	IMPORT_LISTS,
	SEX_CHOICES,
	cellText,
	choiceCell,
	dateCell,
	lookupKey,
	moneyText,
	nameText,
	phoneCell,
	type ImportMatch
} from '$lib/dataImport';
import { add } from '../../employees/add-employee/schema';
import {
	Problems,
	TIN_LOST_ZEROS,
	notListed,
	optional,
	repeatsWithin,
	shownDay,
	tinLostZeros,
	type Importer
} from './importer.server';

/** The add form less what only a form can carry. */
const imported = add.omit({ photo: true, govtId: true, signature: true, pensionCard: true });
type Employee = (typeof imported)['_output'];

const MARITAL = {
	single: ['s', 'unmarried', 'ያላገባ'],
	married: ['ያገባ'],
	widowed: ['widow', 'widower'],
	divorced: [],
	other: []
};

const NO_FILES = { photo: null, govtId: null, signature: null, pensionCard: null };

const nameKey = (e: { name: string; fatherName: string; grandFatherName: string }) =>
	[e.name, e.fatherName, e.grandFatherName].map((n) => lookupKey(tidyName(n))).join('|');

/** An allowance as the form reads it: empty is none. */
const allowance = (text: string) => (text === '' ? '0' : text);

export const employeeImporter: Importer<Employee> = {
	list: IMPORT_LISTS.employees,
	permission: 'employees.create_followup',
	audit: 'employee',

	async lookups() {
		const [departmentList, positionList, statusList, levelList, subcityList] = await Promise.all([
			departments(),
			positions(),
			empStatus(),
			eduLevel(),
			subcities()
		]);
		return {
			departments: departmentList,
			positions: positionList,
			employmentStatuses: statusList,
			educationalLevels: levelList,
			subcities: subcityList
		};
	},

	previewHeadings: ['Name', 'Gender', 'Born', 'Hired', 'Department · position', 'Salary'],

	parse(cells, { lists, calendar }) {
		const problems = new Problems(this.list);
		problems.requireFilled(cells);
		if (tinLostZeros(cells.get('tinNo'))) problems.add('tinNo', TIN_LOST_ZEROS);

		const birthDate = problems.take(
			'birthDate',
			dateCell(cells.get('birthDate'), calendar),
			undefined
		);
		const hireDate = problems.take(
			'hireDate',
			dateCell(cells.get('hireDate'), calendar),
			undefined
		);
		const find = (field: string, list: Parameters<typeof lists.find>[0]) =>
			problems.take(field, lists.find(list, nameText(cells.get(field))), undefined);

		const department = find('department', 'departments');
		const status = find('employmentStatus', 'employmentStatuses');
		const level = find('educationalLevel', 'educationalLevels');
		const subcity = find('subcity', 'subcities');

		const positionText = nameText(cells.get('position'));
		const candidates = lists.all('positions', positionText);
		const position = candidates.find(
			(p) => !department || !p.departmentId || p.departmentId === department.value
		);
		if (positionText && !candidates.length) {
			problems.add('position', notListed('positions', positionText));
		} else if (positionText && !position) {
			problems.add('position', `${positionText} is not a position in ${department?.name}`);
		}

		const result = imported.safeParse({
			name: nameText(cells.get('name')),
			fatherName: nameText(cells.get('fatherName')),
			grandFatherName: nameText(cells.get('grandFatherName')),
			gender: choiceCell(cells.get('gender'), SEX_CHOICES),
			phone: phoneCell(cells.get('phone')),
			email: optional(cellText(cells.get('email'))),
			nationality: optional(nameText(cells.get('nationality'))),
			bloodType: optional(cellText(cells.get('bloodType')).toUpperCase().replace(/\s+/g, '')),
			tinNo: optional(cellText(cells.get('tinNo'))),
			department: department?.value,
			position: position?.value,
			birthDate: birthDate ?? '',
			hireDate: hireDate ?? '',
			employmentStatus: status?.value,
			educationalLevel: level?.value ?? null,
			martialStatus: optional(choiceCell(cells.get('martialStatus'), MARITAL)),
			salary: moneyText(cells.get('salary')),
			positionAllowance: allowance(moneyText(cells.get('positionAllowance'))),
			transportAllowance: allowance(moneyText(cells.get('transportAllowance'))),
			housingAllowance: allowance(moneyText(cells.get('housingAllowance'))),
			nonTaxAllowance: allowance(moneyText(cells.get('nonTaxAllowance'))),
			subcity: subcity?.value,
			street: optional(nameText(cells.get('street'))),
			kebele: optional(cellText(cells.get('kebele'))),
			buildingNumber: optional(cellText(cells.get('buildingNumber'))),
			floor: optional(cellText(cells.get('floor'))),
			houseNumber: optional(cellText(cells.get('houseNumber')))
		});
		if (!result.success) problems.addSchema(result.error);
		if (problems.any || !result.success) return { ok: false, problems: problems.all };

		const e = result.data;
		return {
			ok: true,
			value: e,
			label: `${e.name} ${e.fatherName} ${e.grandFatherName}`,
			shown: [
				`${e.name} ${e.fatherName} ${e.grandFatherName}`,
				e.gender === 'female' ? 'Female' : 'Male',
				shownDay(birthDate),
				shownDay(hireDate),
				`${department?.name} · ${position?.name}`,
				formatETB(e.salary)
			]
		};
	},

	async check(rows) {
		const staff = await db
			.select({
				id: employee.id,
				name: employee.name,
				fatherName: employee.fatherName,
				grandFatherName: employee.grandFatherName
			})
			.from(employee)
			.where(notDeleted(employee));
		const byName = new Map(staff.map((s) => [nameKey(s), s]));
		const sameName = repeatsWithin(rows, nameKey);

		const duplicates: ImportMatch[] = [];
		for (const { row, value, label } of rows) {
			const existing = byName.get(nameKey(value));
			const earlier = sameName.get(row);
			const matches = [
				...(existing
					? [
							{
								name: `${existing.name} ${existing.fatherName} ${existing.grandFatherName}`,
								reason: 'Same three names',
								href: `/dashboard/employees/single/${existing.id}`
							}
						]
					: []),
				...(earlier !== undefined
					? [{ name: `Row ${earlier} of this file`, reason: 'Same three names' }]
					: [])
			];
			if (matches.length) duplicates.push({ row, name: label, matches });
		}
		return { problems: [], duplicates };
	},

	async write(tx, rows, stamp) {
		const branchId = stamp.branchId;
		// `list.needsBranch` keeps "all branches" from getting this far; this is the type's guard.
		if (branchId === null) throw new Error('An employee import needs the branch being worked at.');
		const ids: number[] = [];
		for (const row of rows) {
			ids.push(await addEmployee(tx, row, NO_FILES, { userId: stamp.userId, branchId }));
		}
		return ids;
	}
};
