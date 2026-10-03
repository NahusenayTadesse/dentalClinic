/**
 * Importing patients: a clinic's register, read row by row into registration's own form.
 *
 * **Allergies are all or nothing.** A row naming an allergen that is not on the Allergens list is
 * left out, not imported without it. Importing the patient and dropping "Amoxycillin" because it
 * was spelled differently would put a chart on screen whose empty allergy list reads as "none
 * reported" — the very failure registration's duplicate check exists to prevent (see
 * `possibleDuplicates`).
 *
 * **Duplicates are checked the way registration checks them** — same given and father's name, or
 * the same phone, across every branch, with `matchReason` deciding — and are left out unless the
 * person says they are different people. A file number already in use is never imported: it is the
 * number on a paper chart, and two charts cannot share it.
 */
import { isNotNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { customers, patient } from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';
import { allergens, referralSources } from '$lib/server/fastData';
import { livePatient, matchReason, patientFullName, phoneDigits } from '$lib/server/patients';
import { insertPatient } from '$lib/server/patientWrites';
import {
	IMPORT_LISTS,
	SEX_CHOICES,
	cellText,
	choiceCell,
	dateCell,
	lookupKey,
	nameText,
	phoneCell,
	type ImportMatch,
	type ImportProblem
} from '$lib/dataImport';
import { registerPatient } from '../../patients/schema';
import { Problems, repeatsWithin, shownDay, type Importer } from './importer.server';

type Patient = (typeof registerPatient)['_output'];

/** The form fields whose column has another name. */
const COLUMN_OF = {
	referralSourceId: 'referralSource',
	customerId: 'payer',
	allergenIds: 'allergies',
	knowsBirthDate: 'birthDate'
};

const nameKey = (p: { name: string; fatherName: string }) =>
	`${lookupKey(p.name)}|${lookupKey(p.fatherName)}`;

export const patientImporter: Importer<Patient> = {
	list: IMPORT_LISTS.patients,
	permission: 'patients.register',
	audit: 'patient',

	async lookups() {
		const [allergenList, referralList, payerList] = await Promise.all([
			allergens(),
			referralSources(),
			db
				.select({ value: customers.id, name: customers.name, tinNo: customers.tinNo })
				.from(customers)
				.where(notDeleted(customers))
		]);
		return {
			allergens: allergenList,
			referralSources: referralList,
			// A payer is named by its name or by its TIN, which is what an HR list is more likely to hold.
			payers: payerList.map((p) => ({ value: p.value, name: p.name, also: [p.tinNo] }))
		};
	},

	previewHeadings: ['File number', 'Name', 'Sex', 'Born', 'Phone', 'Allergies', 'Payer'],

	parse(cells, { lists, calendar }) {
		const problems = new Problems(this.list);
		problems.requireFilled(cells);

		const birth = problems.take('birthDate', dateCell(cells.get('birthDate'), calendar), undefined);

		const allergyNames = cellText(cells.get('allergies'))
			.split(/[,;\n]/)
			.map((name) => name.trim())
			.filter(Boolean);
		const allergies = allergyNames
			.map((name) => problems.take('allergies', lists.find('allergens', name), undefined))
			.filter((found) => found !== undefined);

		const referral = problems.take(
			'referralSource',
			lists.find('referralSources', nameText(cells.get('referralSource'))),
			undefined
		);
		const payer = problems.take(
			'payer',
			lists.find('payers', nameText(cells.get('payer'))),
			undefined
		);

		const result = registerPatient.safeParse({
			fileNo: cellText(cells.get('fileNo')),
			name: nameText(cells.get('name')),
			fatherName: nameText(cells.get('fatherName')),
			grandFatherName: nameText(cells.get('grandFatherName')),
			sex: choiceCell(cells.get('sex'), SEX_CHOICES),
			knowsBirthDate: Boolean(birth),
			birthDate: birth ?? '',
			// An age only stands in for a birth date that was not given (see `birthDateFrom`).
			ageYears: birth ? '' : cellText(cells.get('ageYears')),
			phone: phoneCell(cells.get('phone')),
			altPhone: phoneCell(cells.get('altPhone')),
			bloodType: cellText(cells.get('bloodType')).toUpperCase().replace(/\s+/g, ''),
			medicalNotes: cellText(cells.get('medicalNotes')),
			referralSourceId: referral?.value ?? '',
			referredBy: nameText(cells.get('referredBy')),
			customerId: payer?.value ?? '',
			allergenIds: allergies.map((a) => a.value).join(','),
			confirmNotDuplicate: false
		});
		if (!result.success) problems.addSchema(result.error, COLUMN_OF);
		if (problems.any || !result.success) return { ok: false, problems: problems.all };

		const p = result.data;
		return {
			ok: true,
			value: p,
			label: [p.name, p.fatherName, p.grandFatherName].filter(Boolean).join(' '),
			shown: [
				p.fileNo ?? '',
				[p.name, p.fatherName, p.grandFatherName].filter(Boolean).join(' '),
				p.sex === 'female' ? 'Female' : 'Male',
				birth ? shownDay(birth) : p.ageYears !== undefined ? `About ${p.ageYears} years` : '',
				p.phone ?? '',
				allergies.map((a) => a.name).join(', '),
				payer?.name ?? ''
			]
		};
	},

	async check(rows) {
		const problems: ImportProblem[] = [];
		const duplicates: ImportMatch[] = [];

		// The file-number key covers every row ever written — deleted and merged ones too.
		const [roster, numbered] = await Promise.all([
			db
				.select({
					id: patient.id,
					label: patientFullName,
					name: patient.name,
					fatherName: patient.fatherName,
					phone: patient.phone,
					altPhone: patient.altPhone
				})
				.from(patient)
				.where(livePatient()),
			db.select({ fileNo: patient.fileNo }).from(patient).where(isNotNull(patient.fileNo))
		]);

		/*
		 * The roster, indexed the two ways `matchReason` matches, so each row meets only its likely
		 * pairs rather than every patient. A phone is indexed by its digits as `phoneDigits` gives
		 * them, which is what `matchReason` compares.
		 */
		const byName = new Map<string, typeof roster>();
		const byPhone = new Map<string, typeof roster>();
		for (const p of roster) {
			byName.set(nameKey(p), [...(byName.get(nameKey(p)) ?? []), p]);
			for (const phone of [p.phone, p.altPhone]) {
				const digits = phone ? phoneDigits(phone) : '';
				if (digits.length >= 6) byPhone.set(digits, [...(byPhone.get(digits) ?? []), p]);
			}
		}

		const usedNumbers = new Set(numbered.map((r) => lookupKey(r.fileNo ?? '')));
		const sameNumber = repeatsWithin(rows, (p) => (p.fileNo ? lookupKey(p.fileNo) : undefined));
		const sameName = repeatsWithin(rows, nameKey);
		const samePhone = repeatsWithin(rows, (p) => {
			const digits = p.phone ? phoneDigits(p.phone) : '';
			return digits.length >= 6 ? digits : undefined;
		});

		for (const { row, value, label } of rows) {
			if (value.fileNo && usedNumbers.has(lookupKey(value.fileNo))) {
				problems.push({
					row,
					column: 'File number',
					message: `File number ${value.fileNo} is already in use`
				});
			} else if (sameNumber.has(row)) {
				problems.push({
					row,
					column: 'File number',
					message: `File number ${value.fileNo} is also on row ${sameNumber.get(row)}`
				});
			}

			const digits = value.phone ? phoneDigits(value.phone) : '';
			const candidates = new Map(
				[...(byName.get(nameKey(value)) ?? []), ...(byPhone.get(digits) ?? [])].map((p) => [
					p.id,
					p
				])
			);
			const matches: ImportMatch['matches'] = [];
			for (const existing of candidates.values()) {
				const reason = matchReason(existing, value);
				if (reason) {
					matches.push({
						name: existing.label,
						reason,
						href: `/dashboard/patients/${existing.id}`
					});
				}
			}
			const earlier = sameName.get(row) ?? samePhone.get(row);
			if (earlier !== undefined) {
				matches.push({
					name: `Row ${earlier} of this file`,
					reason: sameName.has(row) ? 'Same name and father’s name' : 'Same phone number'
				});
			}
			if (matches.length) duplicates.push({ row, name: label, matches: matches.slice(0, 3) });
		}

		return { problems, duplicates };
	},

	async write(tx, rows, stamp) {
		const ids: number[] = [];
		for (const row of rows) ids.push((await insertPatient(tx, row, stamp)).id);
		return ids;
	}
};
