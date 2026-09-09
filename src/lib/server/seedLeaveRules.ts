// One-off seed script: puts a starting set of annual leave entitlement brackets and an expiry
// policy on file, and flags "Annual Leave" as the type that draws on the accrued balance.
// Purely additive — existing brackets, policies and leave types are left as they are.
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { eq } from 'drizzle-orm';
import * as schema from './db/schema';
import { annualLeaveEntitlement, leaveExpiryPolicy, leaveType } from './db/schema';

// Ethiopian labour law floor: 16 working days for the first year, plus a day for every two
// additional years of service. Adjust these on the admin page to match company policy.
const BRACKETS = [
	{ fromYears: 1, toYears: 2, days: 16, description: 'First two years of service' },
	{ fromYears: 3, toYears: 4, days: 17, description: 'Third and fourth year' },
	{ fromYears: 5, toYears: 6, days: 18, description: 'Fifth and sixth year' },
	{ fromYears: 7, toYears: 9, days: 19, description: 'Seventh to ninth year' },
	{ fromYears: 10, toYears: null, days: 20, description: 'Ten years of service and above' }
];

const POLICY = {
	name: 'Two Year Carry Over',
	expiryYears: 2,
	description: 'Unused annual leave is voided two years after it was granted'
};

async function main() {
	const client = mysql.createPool(process.env.DATABASE_URL!);
	const db = drizzle(client, { schema, mode: 'default' });

	const existingBrackets = await db
		.select({ fromYears: annualLeaveEntitlement.fromYears })
		.from(annualLeaveEntitlement);

	if (existingBrackets.length > 0) {
		console.log(`SKIP  brackets — ${existingBrackets.length} already on file`);
	} else {
		await db.insert(annualLeaveEntitlement).values(BRACKETS);
		console.log(`ADDED ${BRACKETS.length} entitlement brackets`);
	}

	const existingPolicies = await db.select({ id: leaveExpiryPolicy.id }).from(leaveExpiryPolicy);

	if (existingPolicies.length > 0) {
		console.log(`SKIP  expiry policy — ${existingPolicies.length} already on file`);
	} else {
		await db.insert(leaveExpiryPolicy).values(POLICY);
		console.log(`ADDED expiry policy "${POLICY.name}" (${POLICY.expiryYears} years)`);
	}

	// Annual leave is the type that spends the accrued balance; the event-based types don't.
	const [annual] = await db
		.select({ id: leaveType.id, deductsBalance: leaveType.deductsBalance })
		.from(leaveType)
		.where(eq(leaveType.name, 'Annual Leave'));

	if (!annual) {
		console.log('SKIP  "Annual Leave" type not found — add it on the Leave Types page');
	} else if (annual.deductsBalance) {
		console.log('SKIP  "Annual Leave" already draws on the balance');
	} else {
		await db.update(leaveType).set({ deductsBalance: true }).where(eq(leaveType.id, annual.id));
		console.log('FLAGGED "Annual Leave" as drawing on the accrued balance');
	}

	await client.end();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
