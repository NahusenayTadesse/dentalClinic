/**
 * Importing suppliers, into the supplier form's own schema and through `addSupplier`.
 *
 * A supplier with the same name as one already here is a possible duplicate — the same company
 * typed twice — and is left out unless the person says otherwise. Not audited: suppliers are
 * reference data (CLAUDE.md §11).
 */
import { db } from '$lib/server/db';
import { supplySuppliers } from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';
import { subcities } from '$lib/server/fastData';
import { addSupplier } from '$lib/server/suppliers';
import { supplier, type Supplier } from '$lib/forms/supplier';
import {
	IMPORT_LISTS,
	cellText,
	lookupKey,
	nameText,
	phoneCell,
	yesNoCell,
	type ImportMatch
} from '$lib/dataImport';
import { Problems, optional, repeatsWithin, type Importer } from './importer.server';

export const supplierImporter: Importer<Supplier> = {
	list: IMPORT_LISTS.suppliers,
	permission: 'supplies_suppliers.manage',

	async lookups() {
		return { subcities: await subcities() };
	},

	previewHeadings: ['Name', 'Phone', 'Email', 'Subcity', 'Active'],

	parse(cells, { lists }) {
		const problems = new Problems(this.list);
		problems.requireFilled(cells);

		const subcity = problems.take(
			'subcity',
			lists.find('subcities', nameText(cells.get('subcity'))),
			undefined
		);
		const active = problems.take('status', yesNoCell(cells.get('status')), undefined);

		const result = supplier.safeParse({
			name: nameText(cells.get('name')),
			phone: phoneCell(cells.get('phone')),
			email: cellText(cells.get('email')),
			description: cellText(cells.get('description')),
			subcity: subcity?.value,
			street: nameText(cells.get('street')),
			kebele: cellText(cells.get('kebele')),
			buildingNumber: cellText(cells.get('buildingNumber')),
			floor: optional(cellText(cells.get('floor'))),
			houseNumber: optional(cellText(cells.get('houseNumber'))),
			status: active ?? true
		});
		if (!result.success) problems.addSchema(result.error);
		if (problems.any || !result.success) return { ok: false, problems: problems.all };

		const s = result.data;
		return {
			ok: true,
			value: s,
			label: s.name,
			shown: [s.name, s.phone, s.email, subcity?.name ?? '', s.status ? 'Yes' : 'No']
		};
	},

	async check(rows) {
		const existing = await db
			.select({ id: supplySuppliers.id, name: supplySuppliers.name })
			.from(supplySuppliers)
			.where(notDeleted(supplySuppliers));
		const byName = new Map(existing.map((s) => [lookupKey(s.name), s]));
		const sameName = repeatsWithin(rows, (s) => lookupKey(s.name));

		const duplicates: ImportMatch[] = [];
		for (const { row, value, label } of rows) {
			const found = byName.get(lookupKey(value.name));
			const earlier = sameName.get(row);
			const matches = [
				...(found
					? [
							{
								name: found.name,
								reason: 'Same name',
								href: `/dashboard/supplies/suppliers/${found.id}`
							}
						]
					: []),
				...(earlier !== undefined
					? [{ name: `Row ${earlier} of this file`, reason: 'Same name' }]
					: [])
			];
			if (matches.length) duplicates.push({ row, name: label, matches });
		}
		return { problems: [], duplicates };
	},

	async write(tx, rows) {
		const ids: number[] = [];
		for (const row of rows) ids.push(await addSupplier(row, tx));
		return ids;
	}
};
