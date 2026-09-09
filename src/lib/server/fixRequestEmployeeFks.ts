// One-off data fix: payment_request.requested_by / approved_by must only point to
// employees who can actually "access or affect requests" - i.e. employees in a
// commission-enabled department (department.commission = true), matching the app's own
// officeEmployees() pool in fastData.ts, which additionally excludes inactive/terminated
// staff. Employee 1 is in the commission department (Head Office) but is terminated and
// inactive, so any request referencing them gets reassigned to a valid office employee.
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './db/schema';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import {
	department,
	employee,
	employmentStatuses,
	employeeTermination,
	paymentRequest
} from './db/schema';

function pick<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
	const client = mysql.createPool(process.env.DATABASE_URL!);
	const db = drizzle(client, { schema, mode: 'default' });

	const commissionDepts = await db
		.select({ id: department.id })
		.from(department)
		.where(eq(department.commission, true));
	const commissionDeptIds = commissionDepts.map((d) => d.id);

	const validOfficeEmployees = await db
		.select({ id: employee.id })
		.from(employee)
		.leftJoin(employmentStatuses, eq(employmentStatuses.id, employee.employmentStatus))
		.leftJoin(employeeTermination, eq(employeeTermination.staffId, employee.id))
		.where(
			and(
				eq(employee.isActive, true),
				eq(employmentStatuses.removeFromLists, false),
				isNull(employeeTermination.staffId),
				inArray(employee.departmentId, commissionDeptIds)
			)
		);
	const validIds = validOfficeEmployees.map((e) => e.id);

	if (validIds.length === 0) {
		throw new Error('No valid office employees found - refusing to reassign FKs to nothing.');
	}

	console.log('Valid office employee ids:', validIds);

	// Fetch everything and filter in JS - simplest given the small table size.
	const all = await db.select().from(paymentRequest);
	const validSet = new Set(validIds);

	let requesterFixed = 0;
	let approverFixed = 0;

	for (const r of all) {
		const patch: Partial<typeof paymentRequest.$inferInsert> = {};

		if (r.requestedBy !== null && !validSet.has(r.requestedBy)) {
			patch.requestedBy = pick(validIds);
			requesterFixed++;
		}
		if (r.approvedBy !== null && !validSet.has(r.approvedBy)) {
			patch.approvedBy = pick(validIds);
			approverFixed++;
		}

		if (Object.keys(patch).length > 0) {
			await db.update(paymentRequest).set(patch).where(eq(paymentRequest.id, r.id));
		}
	}

	console.log(`✅ Reassigned requested_by on ${requesterFixed} rows.`);
	console.log(`✅ Reassigned approved_by on ${approverFixed} rows.`);

	await client.end();
}

main().catch((err) => {
	console.error('❌ Fix failed:', err);
	process.exit(1);
});
