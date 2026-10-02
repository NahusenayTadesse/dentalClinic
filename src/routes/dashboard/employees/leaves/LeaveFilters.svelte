<script lang="ts">
	/**
	 * The dropdown half of the leaves query bar. Rendered inside `QueryBuilder`'s
	 * `children` snippet, which supplies `filters` and `update`.
	 *
	 * Every option list is built from leaves that actually exist on the page's own
	 * status, so picking one can never return an empty table. `approvedBy` is off
	 * for the pending desk, where nothing has been decided yet.
	 */
	import {
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger
	} from '@nahu/admin-kit/components/ui/select/index.js';
	import Label from '@nahu/admin-kit/components/ui/label/label.svelte';

	type Option = { id: string | number; name: string | null };

	type Options = {
		leaveTypes: Option[];
		departments: Option[];
		branches: Option[];
		approvers: Option[];
	};

	let {
		filters,
		update,
		filterOptions,
		showApprovedBy = true
	}: {
		filters: Record<string, unknown>;
		update: (key: never, value: never) => void;
		filterOptions: Options;
		showApprovedBy?: boolean;
	} = $props();

	const set = (key: string, value: string) => update(key as never, value as never);

	const nameOf = (options: Option[], id: unknown) => options.find((o) => String(o.id) === id)?.name;
</script>

<div class="flex flex-col gap-2">
	<Label class="text-sm font-medium">Leave type</Label>
	<Select
		type="single"
		value={filters.leaveTypeId as string}
		onValueChange={(v) => set('leaveTypeId', v)}
	>
		<SelectTrigger class="w-full">
			{nameOf(filterOptions.leaveTypes, filters.leaveTypeId) ?? 'All leave types'}
		</SelectTrigger>
		<SelectContent>
			<SelectItem value="">All leave types</SelectItem>
			{#each filterOptions.leaveTypes as type (type.id)}
				<SelectItem value={String(type.id)}>{type.name}</SelectItem>
			{/each}
		</SelectContent>
	</Select>
</div>

<div class="flex flex-col gap-2">
	<Label class="text-sm font-medium">Department</Label>
	<Select
		type="single"
		value={filters.departmentId as string}
		onValueChange={(v) => set('departmentId', v)}
	>
		<SelectTrigger class="w-full">
			{nameOf(filterOptions.departments, filters.departmentId) ?? 'All departments'}
		</SelectTrigger>
		<SelectContent>
			<SelectItem value="">All departments</SelectItem>
			{#each filterOptions.departments as dept (dept.id)}
				<SelectItem value={String(dept.id)}>{dept.name}</SelectItem>
			{/each}
		</SelectContent>
	</Select>
</div>

<div class="flex flex-col gap-2">
	<Label class="text-sm font-medium">Branch</Label>
	<Select
		type="single"
		value={filters.branchId as string}
		onValueChange={(v) => set('branchId', v)}
	>
		<SelectTrigger class="w-full">
			{nameOf(filterOptions.branches, filters.branchId) ?? 'All branches'}
		</SelectTrigger>
		<SelectContent>
			<SelectItem value="">All branches</SelectItem>
			{#each filterOptions.branches as branch (branch.id)}
				<SelectItem value={String(branch.id)}>{branch.name}</SelectItem>
			{/each}
		</SelectContent>
	</Select>
</div>

{#if showApprovedBy}
	<div class="flex flex-col gap-2">
		<Label class="text-sm font-medium">Approved by</Label>
		<Select
			type="single"
			value={filters.approvedById as string}
			onValueChange={(v) => set('approvedById', v)}
		>
			<SelectTrigger class="w-full">
				{nameOf(filterOptions.approvers, filters.approvedById) ?? 'Anyone'}
			</SelectTrigger>
			<SelectContent>
				<SelectItem value="">Anyone</SelectItem>
				{#each filterOptions.approvers as approver (approver.id)}
					<SelectItem value={String(approver.id)}>{approver.name}</SelectItem>
				{/each}
			</SelectContent>
		</Select>
	</div>
{/if}

<div class="flex flex-col gap-2">
	<Label class="text-sm font-medium">Duration</Label>
	<Select
		type="single"
		value={filters.duration as string}
		onValueChange={(v) => set('duration', v)}
	>
		<SelectTrigger class="w-full">
			{{ short: '3 days or fewer', medium: '4 to 10 days', long: 'More than 10 days' }[
				filters.duration as string
			] ?? 'Any length'}
		</SelectTrigger>
		<SelectContent>
			<SelectItem value="">Any length</SelectItem>
			<SelectItem value="short">3 days or fewer</SelectItem>
			<SelectItem value="medium">4 to 10 days</SelectItem>
			<SelectItem value="long">More than 10 days</SelectItem>
		</SelectContent>
	</Select>
</div>
