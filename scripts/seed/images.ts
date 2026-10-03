/**
 * Real pictures and documents behind the seeded records, so the file-handling screens can be tried.
 *
 * Before this, all 120 employees' photo and ID pointed at `seed-placeholder.jpg`, which did not
 * exist — 240 broken images — and every one of the 61 patient files, radiographs included, was a
 * copy of the clinic's logo. Nothing else that can hold a file held one. Testing uploads, previews,
 * the radiograph viewer or the file route against that told nobody anything.
 *
 * What goes where:
 *
 *   - **radiographs** — real X-rays from Wikimedia Commons (`images/CREDITS.md`), with their
 *     projection set; six patients get an older film of the same projection and tooth, so the
 *     viewer's side-by-side comparison has pairs to compare
 *   - **clinical photographs** — real intraoral photographs, from the same source
 *   - **people** — drawn avatars (CC0), never photographs: a real face on a made-up employee is a
 *     real person's face on a lie
 *   - **documents** — IDs, certificates, letters, licences, receipts, scanned paper charts: PDFs
 *     generated here, each stamped SAMPLE and saying it is test data. Nothing that could pass for
 *     a real identity document.
 *
 * Every row gets its own copy under a fresh stored name, as an upload would (`files.ts`): the file
 * route finds a patient file's owner by its stored name, so two rows must never share one.
 *
 * Runs once: it is done when no employee still points at the missing placeholder and no patient
 * file is still a logo copy. A database whose records were never seeded has neither, so this never
 * touches a real record's files.
 */
import { randomUUID } from 'node:crypto';
import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	unlinkSync,
	writeFileSync
} from 'node:fs';
import { join } from 'node:path';
import { and, eq, isNull, like, or, sql, type SQL } from 'drizzle-orm';
import type { MySqlColumn, MySqlTable } from 'drizzle-orm/mysql-core';
import { jsPDF } from 'jspdf';

import {
	employee,
	employeeGuarantor,
	employeeTermination,
	leave,
	qualification,
	workExperience
} from '../../src/lib/server/db/schema/staff';
import { provider } from '../../src/lib/server/db/schema/providers';
import { patientFile } from '../../src/lib/server/db/schema/patientFiles';
import { expenses, transactions } from '../../src/lib/server/db/schema/finance';
import { dateAt, randomness, type SeedDb } from './util';

// The same fallback as `server/files.ts`.
const STORE = process.env.FILES_DIR ?? '.tempFiles';
const ASSETS = join('scripts', 'seed', 'images');
const PLACEHOLDER = 'seed-placeholder.jpg';

const XRAYS = {
	periapical: ['xray-periapical-2.jpg', 'xray-periapical-3.jpg', 'xray-periapical-4.jpg'],
	panoramic: ['xray-panoramic-1.jpg', 'xray-panoramic-2.jpg'],
	cephalometric: ['xray-cephalometric.jpg']
} as const;
const PHOTOS = [
	'photo-gingivitis.jpg',
	'photo-gingivitis-2.jpg',
	'photo-caries.jpg',
	'photo-child-incisors.jpg',
	'photo-braces.jpg'
];
const AVATARS = Array.from({ length: 20 }, (_, i) => `avatar-${i + 1}.png`);

/** A file's bytes and how it is stored: its extension and content type. */
type Source = { bytes: Buffer; ext: string; mime: string; original: string };

const asset = (name: string): Source => ({
	bytes: readFileSync(join(ASSETS, name)),
	ext: name.split('.').pop()!,
	mime: name.endsWith('.png') ? 'image/png' : 'image/jpeg',
	original: name
});

/**
 * A one-page PDF standing in for a scanned document: a title, a few lines, and SAMPLE across it.
 * Generated rather than downloaded — it needs no licence, and it cannot be mistaken for the real
 * thing.
 */
function samplePdf(title: string, lines: string[]): Source {
	const doc = new jsPDF({ unit: 'mm', format: 'a5' });
	doc.setTextColor(225);
	doc.setFontSize(64);
	doc.text('SAMPLE', 28, 130, { angle: 35 });
	doc.setTextColor(20);
	doc.setFontSize(16);
	doc.text(title, 12, 20);
	doc.setFontSize(10);
	lines.forEach((line, i) => doc.text(line, 12, 34 + i * 7));
	doc.setFontSize(8);
	doc.setTextColor(140);
	doc.text('Test data from the development seed. Not a real document.', 12, 200);
	return {
		bytes: Buffer.from(doc.output('arraybuffer')),
		ext: 'pdf',
		mime: 'application/pdf',
		original: `${title.toLowerCase().replace(/[^a-z]+/g, '-')}.pdf`
	};
}

const DOCUMENTS = {
	id: samplePdf('Identity document', ['Name: as on the record', 'ID number: SAMPLE-0000']),
	pension: samplePdf('Pension card', ['Member number: SAMPLE-PEN-0000']),
	certificate: samplePdf('Certificate of qualification', [
		'Awarded for the course shown on the record'
	]),
	experience: samplePdf('Work experience letter', ['Confirms the employment shown on the record']),
	guarantee: samplePdf('Guarantee agreement', [
		'The guarantor named on the record guarantees',
		'the employee named on the record.'
	]),
	leave: samplePdf('Leave request', ['Requested for the dates shown on the record']),
	termination: samplePdf('Termination letter', ['Effective on the date shown on the record']),
	licence: samplePdf('Professional licence', ['Licence number and expiry as on the record']),
	receipt: samplePdf('Receipt', ['Amount and date as on the record']),
	paperChart: samplePdf('Scanned paper chart', [
		'Dental chart kept on paper before',
		'the clinic used this system.'
	])
};

/** Writes a copy of `source` into the store under a new name, as an upload would. */
function store(source: Source): { name: string; size: number } {
	const name = `${randomUUID()}.${source.ext}`;
	writeFileSync(join(STORE, name), source.bytes);
	return { name, size: source.bytes.length };
}

export async function seedImages(db: SeedDb) {
	if (!existsSync(ASSETS)) {
		console.log('No seed images found; skipping files.');
		return;
	}

	const [placeholderStaff] = await db
		.select({ id: employee.id })
		.from(employee)
		.where(eq(employee.photo, PLACEHOLDER))
		.limit(1);
	const [logoCopy] = await db
		.select({ id: patientFile.id })
		.from(patientFile)
		.where(like(patientFile.storedName, 'seedplaceholder%'))
		.limit(1);
	if (!placeholderStaff && !logoCopy) {
		console.log('Seeded records already have their files; skipping.');
		return;
	}

	if (!existsSync(STORE)) mkdirSync(STORE, { recursive: true });
	const { pick, chance } = randomness(20261004);
	let written = 0;

	/**
	 * Gives a share of a table's empty file column a copy each. `empty` says which rows count as
	 * having no file; `source` picks what each one gets.
	 */
	async function fill(
		table: MySqlTable,
		id: MySqlColumn,
		column: MySqlColumn,
		share: number,
		source: (i: number) => Source,
		empty: SQL = isNull(column)
	) {
		const rows = (await db.select({ id }).from(table).where(empty)) as { id: number }[];
		for (const [i, row] of rows.entries()) {
			if (!chance(share)) continue;
			const { name } = store(source(i));
			await db.execute(sql`update ${table} set ${column} = ${name} where ${id} = ${row.id}`);
			written++;
		}
	}

	const avatar = () => asset(pick(AVATARS));
	const placeholderOrEmpty = (column: MySqlColumn) =>
		or(isNull(column), eq(column, PLACEHOLDER)) as SQL;

	// Staff, and the people and papers around them.
	await fill(employee, employee.id, employee.photo, 1, avatar, placeholderOrEmpty(employee.photo));
	await fill(
		employee,
		employee.id,
		employee.govtId,
		1,
		() => DOCUMENTS.id,
		placeholderOrEmpty(employee.govtId)
	);
	await fill(employee, employee.id, employee.signiture, 0.6, () => asset('signature.png'));
	await fill(employee, employee.id, employee.pensionCard, 0.5, () => DOCUMENTS.pension);
	await fill(employeeGuarantor, employeeGuarantor.id, employeeGuarantor.photo, 0.8, avatar);
	await fill(
		employeeGuarantor,
		employeeGuarantor.id,
		employeeGuarantor.govtId,
		0.8,
		() => DOCUMENTS.id
	);
	await fill(
		employeeGuarantor,
		employeeGuarantor.id,
		employeeGuarantor.gurantorDocument,
		0.7,
		() => DOCUMENTS.guarantee
	);
	await fill(
		qualification,
		qualification.id,
		qualification.certificate,
		0.8,
		() => DOCUMENTS.certificate
	);
	await fill(
		workExperience,
		workExperience.id,
		workExperience.certificate,
		0.6,
		() => DOCUMENTS.experience
	);
	await fill(leave, leave.id, leave.leaveLetter, 0.5, () => DOCUMENTS.leave);
	await fill(
		employeeTermination,
		employeeTermination.id,
		employeeTermination.terminationLetter,
		1,
		() => DOCUMENTS.termination
	);
	await fill(provider, provider.id, provider.licenceDocument, 1, () => DOCUMENTS.licence);

	// Receipts on most expenses: the expense's own transaction carries the link.
	const spent = await db
		.select({ id: transactions.id })
		.from(expenses)
		.innerJoin(transactions, eq(expenses.transactionId, transactions.id))
		.where(isNull(transactions.recieptLink));
	for (const row of spent) {
		if (!chance(0.75)) continue;
		const { name } = store(DOCUMENTS.receipt);
		await db.update(transactions).set({ recieptLink: name }).where(eq(transactions.id, row.id));
		written++;
	}

	written += await replacePatientFiles(db, pick);
	written += await addComparisonPairs(db);
	removeLogoCopies();

	console.log(`Stored ${written} files and pointed the seeded records at them.`);
}

/**
 * The patient files that were logo copies: radiographs become X-rays with a projection, photos
 * become intraoral photographs, paper records become a scanned chart.
 */
async function replacePatientFiles(db: SeedDb, pick: <T>(items: readonly T[]) => T) {
	const rows = await db
		.select({ id: patientFile.id, patientId: patientFile.patientId, kind: patientFile.kind })
		.from(patientFile)
		.where(like(patientFile.storedName, 'seedplaceholder%'));

	let n = 0;
	for (const row of rows) {
		let source: Source;
		let projection: 'periapical' | 'panoramic' | 'cephalometric' | null = null;
		if (row.kind === 'radiograph') {
			projection = pick([
				'periapical',
				'periapical',
				'panoramic',
				'panoramic',
				'cephalometric'
			] as const);
			source = asset(pick(XRAYS[projection]));
		} else if (row.kind === 'paperRecord') {
			source = DOCUMENTS.paperChart;
		} else {
			source = asset(pick(PHOTOS));
		}
		const { name, size } = store(source);
		await db
			.update(patientFile)
			.set({
				storedName: name,
				originalName: source.original,
				mimeType: source.mime,
				sizeBytes: size,
				...(projection ? { projection, toothId: projection === 'periapical' ? 46 : null } : {})
			})
			.where(eq(patientFile.id, row.id));
		n++;
	}
	return n;
}

/**
 * Six patients with one radiograph get an older film of the same projection and tooth, so the
 * viewer's side-by-side comparison — "this film beside the last of its kind" — has something to
 * show. Until now one patient in the whole database had two.
 */
async function addComparisonPairs(db: SeedDb) {
	const singles = await db
		.select({
			patientId: patientFile.patientId,
			projection: patientFile.projection,
			toothId: patientFile.toothId
		})
		.from(patientFile)
		.where(
			and(
				eq(patientFile.kind, 'radiograph'),
				sql`${patientFile.projection} in ('periapical', 'panoramic')`
			)
		)
		.groupBy(patientFile.patientId, patientFile.projection, patientFile.toothId)
		.having(sql`count(*) = 1`)
		.limit(6);

	for (const [i, s] of singles.entries()) {
		const projection = s.projection === 'panoramic' ? 'panoramic' : 'periapical';
		const source = asset(XRAYS[projection][i % XRAYS[projection].length]);
		const { name, size } = store(source);
		await db.insert(patientFile).values({
			patientId: s.patientId,
			kind: 'radiograph',
			storedName: name,
			originalName: source.original,
			mimeType: source.mime,
			sizeBytes: size,
			projection,
			toothId: s.toothId,
			takenOn: dateAt(-400 - i * 30),
			description: 'Earlier film, for comparison (seed)'
		});
	}
	return singles.length;
}

/** The logo copies the patient files used to point at, now pointed at by nothing. */
function removeLogoCopies() {
	for (const name of readdirSync(STORE)) {
		if (/^seedplaceholder\d+\.png$/.test(name)) unlinkSync(join(STORE, name));
	}
}
