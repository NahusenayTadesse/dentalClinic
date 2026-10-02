<script lang="ts">
	import Eye from '@lucide/svelte/icons/eye';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import SingleTable from '@nahu/admin-kit/components/SingleTable.svelte';
	import SingleView from '@nahu/admin-kit/components/SingleView.svelte';
	import DeleteEntity from '@nahu/admin-kit/components/DeleteEntity.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { editUserSchema } from './schema';
	import { columns } from './columns';

	/** One user account: who they are, their role and permissions, changed in a dialog. */
	let { data } = $props();

	const singleTable = $derived([
		{ name: 'Name', value: data.singleUser.name },
		{ name: 'Email', value: data.singleUser.email },
		{ name: 'Role', value: data.singleUser.role },
		{ name: 'Status', value: data.singleUser.status ? 'Active' : 'Inactive' },
		{ name: 'Created At', value: data.singleUser.createdAt.toLocaleString() },
		{ name: 'Updated At', value: data.singleUser.updatedAt.toLocaleString() }
	]);

	const roles = $derived(data.roleList.map((r) => ({ value: r.value, name: r.name ?? '' })));
</script>

<svelte:head>
	<title>{data.singleUser.name} · User</title>
</svelte:head>

<SingleView title={data.singleUser.name}>
	<div class="mt-4 flex w-full flex-row items-start justify-start gap-2 pl-4">
		<FormDialog
			title="Change this user"
			description="Saving signs them out on every device they are signed in on."
			action="?/editUser"
			data={data.form}
			schema={editUserSchema}
			triggerLabel="Edit"
		>
			{#snippet fields({ form, errors, values })}
				<InputComp {form} {errors} label="Name" name="name" required />
				<InputComp {form} {errors} label="Email" type="email" name="email" required />
				<InputComp {form} {errors} label="Role" type="select" name="role" items={roles} />
				<InputComp
					{form}
					{errors}
					label="Status"
					type="select"
					name="status"
					items={[
						{ value: true, name: 'Active' },
						{ value: false, name: 'Inactive' }
					]}
				/>
				<InputComp
					{form}
					{errors}
					name="editPermission"
					type="checkboxSingle"
					label="Give them their own permissions"
					placeholder="Instead of their role’s"
				/>
				{#if values.editPermission}
					<InputComp
						{form}
						{errors}
						label="Permissions"
						name="permissionsList"
						type="checkbox"
						items={data.allPerms}
					/>
				{/if}
			{/snippet}
		</FormDialog>
		{#if data.singleUser.employeeId}
			<Button variant="outline" href="/dashboard/employees/single/{data.singleUser.employeeId}">
				<Eye class="size-4" /> Their employee record
			</Button>
		{/if}
		<DeleteEntity
			entity="User"
			name={data.singleUser.name}
			consequence="They are signed out everywhere and their extra permissions are revoked. Records they created stay, still showing their name."
			canDelete={data.isSuperAdmin && data.singleUser.id !== data.viewerId}
		/>
	</div>
	<div class="w-full p-4"><SingleTable {singleTable} /></div>
</SingleView>

<section class="mt-6 flex flex-col gap-2">
	<h2 class="text-lg font-semibold">Permissions</h2>
	<DataTable
		data={data.permissionList}
		{columns}
		fileName="{data.singleUser.name} permissions"
		variant="compact"
	/>
</section>
