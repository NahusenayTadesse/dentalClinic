// One-off seed script: inserts the three leave types that were previously hard-coded in the
// "Add Leave" form into the new `leave_type` table, then backfills `leave.leave_type_id` for
// existing rows whose `reason` still holds one of those names. Purely additive — nothing is
// truncated, existing types are left alone, and leaves that already point at a type are skipped.
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { eq, and, isNull } from 'drizzle-orm';
import * as schema from './db/schema';
import { leaveType, leave } from './db/schema';

const LEAVE_TYPES = [
	{ name: 'Marriage Leave', maxDays: 5, description: 'Leave up to 5 days' },
	{ name: 'Sadness Leave', maxDays: 3, description: 'Leave up to 3 days' },
	{ name: 'Maternity Leave', maxDays: 90, description: 'Leave up to 3 months' }
];

async function main() {
	const client = mysql.createPool(process.env.DATABASE_URL!);
	const db = drizzle(client, { schema, mode: 'default' });

	for (const type of LEAVE_TYPES) {
		const [existing] = await db
			.select({ id: leaveType.id })
			.from(leaveType)
			.where(eq(leaveType.name, type.name));

		if (existing) {
			console.log(`SKIP  ${type.name} — already exists (id ${existing.id})`);
			continue;
		}

		const [inserted] = await db.insert(leaveType).values(type).$returningId();
		console.log(`ADDED ${type.name} (id ${inserted.id})`);
	}

	// Backfill: link old leaves to their type by the reason text they were stored with.
	const allTypes = await db.select({ id: leaveType.id, name: leaveType.name }).from(leaveType);

	for (const type of allTypes) {
		const result = await db
			.update(leave)
			.set({ leaveTypeId: type.id })
			.where(and(eq(leave.reason, type.name), isNull(leave.leaveTypeId)));

		console.log(
			`LINKED ${type.name}: ${(result as unknown as { affectedRows: number }).affectedRows ?? 0} leave(s)`
		);
	}

	await client.end();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
