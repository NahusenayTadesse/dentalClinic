<script lang="ts">
	import LeaveStatusList from '../LeaveStatusList.svelte';

	/** Leave requests that were rejected or cancelled, which can be reopened or approved. */
	let { data } = $props();
</script>

<LeaveStatusList
	status="rejected"
	title="Cancelled Leaves"
	rows={data.salaryHistory}
	form={data.form}
	editForm={data.editForm}
	leaveTypes={data.leaveTypeList}
	isSuperAdmin={data.isSuperAdmin ?? false}
	choices={[
		{ value: 'approved', name: 'Approve' },
		{ value: 'pending', name: 'Back to pending' }
	]}
/>
