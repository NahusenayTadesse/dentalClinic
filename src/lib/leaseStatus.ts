/**
 * The lease status enum, shared by server actions and client tables.
 *
 * Lives outside `$lib/server` on purpose: `columns.ts` renders the badge in the
 * browser, and importing server-only code there would break the build.
 */

export type LeaseStatus =
	| 'pending'
	| 'approved'
	| 'rejected'
	| 'cancelled'
	| 'issued'
	| 'partially_returned'
	| 'returned'
	| 'closed';

export const LEASE_STATUS_LABELS: Record<LeaseStatus, string> = {
	pending: 'Pending',
	approved: 'Approved',
	rejected: 'Rejected',
	cancelled: 'Cancelled',
	issued: 'Issued',
	partially_returned: 'Partially Returned',
	returned: 'Returned',
	closed: 'Closed'
};

/**
 * Badge colour keys understood by `Table/statuses.svelte`. Statuses it has no
 * entry for are mapped onto ones it does, so a lease never renders grey.
 */
export const LEASE_STATUS_BADGE: Record<LeaseStatus, string> = {
	pending: 'Pending',
	approved: 'Approved',
	rejected: 'Rejected',
	cancelled: 'Cancelled',
	issued: 'Contracted',
	partially_returned: 'Incomplete',
	returned: 'Complete',
	closed: 'Complete'
};

export const leaseStatusLabel = (status: string) =>
	LEASE_STATUS_LABELS[status as LeaseStatus] ?? status;

export const leaseStatusBadge = (status: string) =>
	LEASE_STATUS_BADGE[status as LeaseStatus] ?? 'unknown';
