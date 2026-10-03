/**
 * The importers, by list. A new importable list is an entry in `IMPORT_LISTS` (its columns) and an
 * importer here (how a row becomes its form's input, and how it is written) — the screen, the
 * template and the route need nothing new.
 */
import type { ImportKind } from '$lib/dataImport';
import type { Importer } from './importer.server';
import { patientImporter } from './patients.server';
import { payerImporter } from './payers.server';
import { employeeImporter } from './employees.server';
import { supplierImporter } from './suppliers.server';

/*
 * Each importer is typed over its own form's values. The registry holds them at `unknown`, which is
 * sound only because the run hands a list's rows back to the importer that parsed them and to no
 * other — `Importer`'s methods are declared as methods, so TypeScript allows the widening.
 */
export const IMPORTERS: Record<ImportKind, Importer<unknown>> = {
	patients: patientImporter,
	payers: payerImporter,
	employees: employeeImporter,
	suppliers: supplierImporter
};
