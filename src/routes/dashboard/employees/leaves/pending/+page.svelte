<script lang="ts">
	import LeaveStatusList from '../LeaveStatusList.svelte';

	/** Leave requests waiting for a decision. */
	let { data } = $props();
</script>

<LeaveStatusList
	status="pending"
	title="Pending Leaves"
	rows={data.salaryHistory}
	form={data.form}
	editForm={data.editForm}
	leaveTypes={data.leaveTypeList}
	isSuperAdmin={data.isSuperAdmin ?? false}
	choices={[
		{ value: 'approved', name: 'Approve' },
		{ value: 'rejected', name: 'Reject' }
	]}
/>
