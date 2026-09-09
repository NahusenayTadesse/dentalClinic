import { formatEthiopianDate } from '$lib/global.svelte';

export type ApprovalTrail = {
	approvalStatus?: 'pending' | 'approved' | 'rejected' | null;
	/** Who entered the record — the requester half of maker-checker. */
	requestedBy?: string | null;
	/** Falls back to the creator's name for rows entered before approvals existed. */
	addedBy?: string | null;
	approvedBy?: string | null;
	approvedAt?: Date | string | null;
	updatedBy?: string | null;
};

/**
 * The rows every single page ends with: who entered the record, who released it, and who
 * touched it last.
 *
 * Records backfilled when the approval columns arrived carry `approved` with nobody named, so
 * an empty approver is spelled out rather than left blank — "—" would read as "nobody checked
 * this", which is the opposite of what it means.
 */
export function systemInfoRows(trail: ApprovalTrail): { name: string; value: string }[] {
	const status = trail.approvalStatus ?? 'approved';

	const approvedBy = () => {
		if (status === 'pending') return 'Not approved yet';
		if (status === 'rejected') return 'Rejected — see the notice above';
		return trail.approvedBy ?? 'Approved before this system was in place';
	};

	const rows = [
		{ name: 'Entered By', value: trail.requestedBy ?? trail.addedBy ?? 'Unknown' },
		{ name: 'Approved By', value: approvedBy() }
	];

	if (status === 'approved' && trail.approvedAt) {
		rows.push({
			name: 'Approved On',
			value: formatEthiopianDate(new Date(trail.approvedAt))
		});
	}

	rows.push({ name: 'Last Updated By', value: trail.updatedBy ?? 'Never updated' });

	return rows;
}
