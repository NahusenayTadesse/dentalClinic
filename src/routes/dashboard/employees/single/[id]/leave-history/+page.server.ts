import { db } from '$lib/server/db';
import { leave, leaveType } from '$lib/server/db/schema';

import { and, eq, desc, sql } from 'drizzle-orm';
import { notDeleted } from '$lib/server/softDelete';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const { id } = params;

	const salaryHistory = await db
		.select({
			id: leave.id,
			requestDate: leave.requestDate,
			startDate: leave.startDate,
			endDate: leave.endDate,
			leaveTypeName: leaveType.name,
			reason: leave.reason,
			leaveLetter: leave.leaveLetter,
			numberOfDays: sql<number>`DATEDIFF(${leave.endDate}, ${leave.startDate}) + 1`
		})
		.from(leave)
		.leftJoin(leaveType, and(eq(leave.leaveTypeId, leaveType.id), notDeleted(leaveType)))
		.where(and(eq(leave.staffId, Number(id)), notDeleted(leave)))
		.orderBy(desc(leave.requestDate));

	return {
		salaryHistory
	};
};
