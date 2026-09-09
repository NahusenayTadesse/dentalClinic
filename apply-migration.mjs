// Temporary: applies steps 1 and 2 of
// drizzle/manual/payment_request_approval_dates.sql to the local database.
// Step 3 (the unique index) is deliberately NOT here - it needs the 11 duplicate
// groups resolved first. Delete this file once it has run.
import fs from 'node:fs';
import mysql from 'mysql2/promise';

const url = fs.readFileSync('.env', 'utf8').match(/DATABASE_URL\s*=\s*["']?([^"'\n]+)/)[1];
const c = await mysql.createConnection(url);
const q = async (s) => (await c.query(s))[0];

const cols = (await q('SHOW COLUMNS FROM `payment_request`')).map((r) => r.Field);
if (cols.includes('approved_at')) {
	console.log('already applied - approved_at exists, nothing to do');
} else {
	await q(
		'ALTER TABLE `payment_request` ADD COLUMN `approved_at` datetime NULL, ADD COLUMN `rejected_at` datetime NULL'
	);
	console.log('step 1: columns added');

	const a = await q(
		"UPDATE `payment_request` SET `approved_at` = `updated_at` WHERE `status` = 'approved' AND `approved_at` IS NULL"
	);
	const r = await q(
		"UPDATE `payment_request` SET `rejected_at` = `updated_at` WHERE `status` = 'rejected' AND `rejected_at` IS NULL"
	);
	console.log(`step 2: backfilled ${a.affectedRows} approved, ${r.affectedRows} rejected`);
}

console.log(
	'verify:',
	JSON.stringify(
		await q(
			"SELECT SUM(`status`='approved' AND `approved_at` IS NULL) approved_without_date, SUM(`status`='rejected' AND `rejected_at` IS NULL) rejected_without_date FROM `payment_request`"
		)
	)
);
await c.end();
