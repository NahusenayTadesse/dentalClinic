/**
 * Applies a migration to a scratch database, statement by statement, and reports the first
 * one that fails.
 *
 * Exists because migrations are applied by hand through phpMyAdmin, and MySQL DDL does not
 * roll back: an import that dies on statement 40 of 46 leaves the database half-migrated with
 * no way back except a restore. drizzle-kit has twice generated SQL that could not apply in
 * the order it emitted — `DROP TABLE` before the foreign keys pointing at the table, and a
 * `DEFAULT 1` column added before the row it defaults to existed — and both would have failed
 * mid-import on a live database.
 *
 * Running it against a scratch copy turns that into a local error message instead.
 *
 *   node scripts/check-migration.mjs                 # every migration, on an empty database
 *   node scripts/check-migration.mjs 0011            # just this one, on a copy of the current schema
 *
 * Needs DATABASE_URL. Creates and drops `<dbname>_migcheck`; never touches the real database.
 */
import { readFileSync, readdirSync } from 'node:fs';
import mysql from 'mysql2/promise';

const only = process.argv[2];
const url = new URL(process.env.DATABASE_URL);
const realDb = url.pathname.slice(1);
const scratch = `${realDb}_migcheck`;

const files = readdirSync('drizzle')
	.filter((f) => f.endsWith('.sql') && /^\d{4}_/.test(f))
	.sort()
	.filter((f) => !only || f.startsWith(only));

if (files.length === 0) {
	console.error(`No migration matches "${only ?? ''}"`);
	process.exit(1);
}

const admin = await mysql.createConnection({
	host: url.hostname,
	port: url.port || 3306,
	user: decodeURIComponent(url.username),
	password: decodeURIComponent(url.password),
	multipleStatements: true
});

await admin.query(`DROP DATABASE IF EXISTS \`${scratch}\``);
// Same charset the preflight sets, so the check exercises what production will run.
await admin.query(`CREATE DATABASE \`${scratch}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`);
await admin.end();

url.pathname = `/${scratch}`;
const db = await mysql.createConnection(url.toString());

let applied = 0;
let failed = 0;

for (const file of files) {
	const statements = readFileSync(`drizzle/${file}`, 'utf8')
		.split('--> statement-breakpoint')
		.map((s) => s.trim())
		.filter(Boolean);

	for (const [i, statement] of statements.entries()) {
		try {
			await db.query(statement);
			applied++;
		} catch (err) {
			failed++;
			console.error(`\n✗ ${file} — statement ${i + 1} of ${statements.length}`);
			console.error(`  ${err.code}: ${err.sqlMessage}`);
			console.error(`  ${statement.slice(0, 200).replace(/\s+/g, ' ')}`);
		}
	}
	console.log(`${failed ? '·' : '✓'} ${file} (${statements.length} statements)`);
}

await db.query(`DROP DATABASE \`${scratch}\``);
await db.end();

console.log(`\n${applied} statements applied, ${failed} failed.`);

if (failed) {
	console.error('Do NOT upload this to phpMyAdmin — DDL does not roll back.');
	process.exit(1);
}
