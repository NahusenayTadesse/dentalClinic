/**
 * Importing payers — employers and insurers — into the add form's own schema.
 *
 * Refused the way the form refuses them: a TIN already registered (the unique key, which counts
 * deleted payers too) and a phone another payer already uses. A payer is not a person, so there is
 * no "may be the same" middle ground: both are hard problems, and the row is left out.
 *
 * Each imported payer starts pending, as the form's do (`addPayer`).
 */
import { db } from '$lib/server/db';
import { customers } from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';
import { subcities } from '$lib/server/fastData';
import { addPayer } from '$lib/server/payers';
import { IMPORT_LISTS, cellText, nameText, phoneCell, type ImportProblem } from '$lib/dataImport';
import { customerSchema } from '../../customers/add-customer/schema';
import {
	Problems,
	TIN_LOST_ZEROS,
	optional,
	repeatsWithin,
	tinLostZeros,
	type Importer
} from './importer.server';

type Payer = (typeof customerSchema)['_output'];

const phoneKey = (phone: string) => phone.replace(/\D/g, '');

export const payerImporter: Importer<Payer> = {
	list: IMPORT_LISTS.payers,
	permission: 'customers.record',

	async lookups() {
		return { subcities: await subcities() };
	},

	previewHeadings: ['Name', 'Phone', 'TIN', 'Email', 'Subcity'],

	parse(cells, { lists }) {
		const problems = new Problems(this.list);
		problems.requireFilled(cells);
		if (tinLostZeros(cells.get('tinNo'))) problems.add('tinNo', TIN_LOST_ZEROS);

		const subcity = problems.take(
			'subcity',
			lists.find('subcities', nameText(cells.get('subcity'))),
			undefined
		);

		const result = customerSchema.safeParse({
			name: nameText(cells.get('name')),
			phone: phoneCell(cells.get('phone')),
			email: optional(cellText(cells.get('email'))),
			tinNo: cellText(cells.get('tinNo')),
			// `z.coerce.number()` reads '' as 0, a subcity that does not exist; `requireFilled` above
			// is what refuses an empty one.
			subcity: subcity?.value,
			street: nameText(cells.get('street')),
			kebele: optional(cellText(cells.get('kebele'))),
			buildingNumber: optional(cellText(cells.get('buildingNumber'))),
			floor: optional(cellText(cells.get('floor'))),
			houseNumber: optional(cellText(cells.get('houseNumber')))
		});
		if (!result.success) problems.addSchema(result.error);
		if (problems.any || !result.success) return { ok: false, problems: problems.all };

		const p = result.data;
		return {
			ok: true,
			value: p,
			label: p.name,
			shown: [p.name, p.phone, p.tinNo, p.email ?? '', subcity?.name ?? '']
		};
	},

	async check(rows) {
		const problems: ImportProblem[] = [];
		const [everyTin, livePhones] = await Promise.all([
			// The TIN key is unique across every row, deleted payers included.
			db.select({ tinNo: customers.tinNo }).from(customers),
			db.select({ phone: customers.phone }).from(customers).where(notDeleted(customers))
		]);
		const tins = new Set(everyTin.map((r) => r.tinNo));
		const phones = new Set(livePhones.map((r) => phoneKey(r.phone)));
		const sameTin = repeatsWithin(rows, (p) => p.tinNo);
		const samePhone = repeatsWithin(rows, (p) => phoneKey(p.phone));

		for (const { row, value } of rows) {
			if (tins.has(value.tinNo)) {
				problems.push({
					row,
					column: 'TIN',
					message: `A payer with TIN ${value.tinNo} is already registered`
				});
			} else if (sameTin.has(row)) {
				problems.push({
					row,
					column: 'TIN',
					message: `TIN ${value.tinNo} is also on row ${sameTin.get(row)}`
				});
			}
			if (phones.has(phoneKey(value.phone))) {
				problems.push({
					row,
					column: 'Phone',
					message: `A payer with phone ${value.phone} already exists`
				});
			} else if (samePhone.has(row)) {
				problems.push({
					row,
					column: 'Phone',
					message: `Phone ${value.phone} is also on row ${samePhone.get(row)}`
				});
			}
		}
		return { problems, duplicates: [] };
	},

	async write(tx, rows, stamp) {
		const ids: number[] = [];
		for (const row of rows) ids.push(await addPayer(tx, row, stamp.userId));
		return ids;
	}
};
