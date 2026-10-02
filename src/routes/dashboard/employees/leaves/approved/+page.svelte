<script lang="ts">
	import LeaveStatusList from '../LeaveStatusList.svelte';

	/**
	 * Approved leave, filtered and paged on the server — long enough over the years to need it. It
	 * had a filter bar of its own; the table's column filters and date window replace it.
	 */
	let { data } = $props();
</script>

<LeaveStatusList
	status="approved"
	title="Approved Leaves"
	rows={data.salaryHistory}
	form={data.form}
	editForm={data.editForm}
	leaveTypes={data.leaveTypeList}
	isSuperAdmin={data.isSuperAdmin ?? false}
	choices={[
		{ value: 'pending', name: 'Back to pending' },
		{ value: 'rejected', name: 'Cancel' }
	]}
	server={{ pagination: data.pagination, facets: data.facets, query: data.currentQuery }}
/>
