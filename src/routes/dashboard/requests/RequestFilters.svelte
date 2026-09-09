<script lang="ts">
	/**
	 * The dropdown half of the requests query bar, shared by pending / approved /
	 * cancelled so the three pages offer the same vocabulary. Rendered inside
	 * `QueryBuilder`'s `children` snippet, which supplies `filters` and `update`.
	 *
	 * `approvedBy` only means anything once a request has been decided, so the
	 * pending queue leaves it off.
	 */
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import Label from '$lib/components/ui/label/label.svelte';

	type Options = {
		months: readonly string[];
		years: number[];
		customers: { id: number; name: string | null }[];
		employees: { value: number; name: string }[];
	};

	let {
		filters,
		update,
		filterOptions,
		showApprovedBy = false
	}: {
		filters: Record<string, unknown>;
		update: (key: never, value: never) => void;
		filterOptions: Options;
		showApprovedBy?: boolean;
	} = $props();

	const set = (key: string, value: string) => update(key as never, value as never);

	const employeeName = (id: unknown) =>
		filterOptions.employees.find((e) => String(e.value) === id)?.name;
</script>

<div class="flex flex-col gap-2">
	<Label class="text-sm font-medium">Month</Label>
	<Select type="single" value={filters.month as string} onValueChange={(v) => set('month', v)}>
		<SelectTrigger class="w-full">{(filters.month as string) || 'All months'}</SelectTrigger>
		<SelectContent>
			<SelectItem value="">All months</SelectItem>
			{#each filterOptions.months as m (m)}
				<SelectItem value={m}>{m}</SelectItem>
			{/each}
		</SelectContent>
	</Select>
</div>

<div class="flex flex-col gap-2">
	<Label class="text-sm font-medium">Year</Label>
	<Select type="single" value={filters.year as string} onValueChange={(v) => set('year', v)}>
		<SelectTrigger class="w-full">{(filters.year as string) || 'All years'}</SelectTrigger>
		<SelectContent>
			<SelectItem value="">All years</SelectItem>
			{#each filterOptions.years as y (y)}
				<SelectItem value={String(y)}>{y}</SelectItem>
			{/each}
		</SelectContent>
	</Select>
</div>

<div class="flex flex-col gap-2">
	<Label class="text-sm font-medium">Customer</Label>
	<Select
		type="single"
		value={filters.customerId as string}
		onValueChange={(v) => set('customerId', v)}
	>
		<SelectTrigger class="w-full">
			{filterOptions.customers.find((c) => String(c.id) === filters.customerId)?.name ??
				'All customers'}
		</SelectTrigger>
		<SelectContent>
			<SelectItem value="">All customers</SelectItem>
			{#each filterOptions.customers as c (c.id)}
				<SelectItem value={String(c.id)}>{c.name}</SelectItem>
			{/each}
		</SelectContent>
	</Select>
</div>

<div class="flex flex-col gap-2">
	<Label class="text-sm font-medium">Requested by</Label>
	<Select
		type="single"
		value={filters.requestedBy as string}
		onValueChange={(v) => set('requestedBy', v)}
	>
		<SelectTrigger class="w-full">{employeeName(filters.requestedBy) ?? 'Anyone'}</SelectTrigger>
		<SelectContent>
			<SelectItem value="">Anyone</SelectItem>
			{#each filterOptions.employees as e (e.value)}
				<SelectItem value={String(e.value)}>{e.name}</SelectItem>
			{/each}
		</SelectContent>
	</Select>
</div>

{#if showApprovedBy}
	<div class="flex flex-col gap-2">
		<Label class="text-sm font-medium">Approved by</Label>
		<Select
			type="single"
			value={filters.approvedBy as string}
			onValueChange={(v) => set('approvedBy', v)}
		>
			<SelectTrigger class="w-full">{employeeName(filters.approvedBy) ?? 'Anyone'}</SelectTrigger>
			<SelectContent>
				<SelectItem value="">Anyone</SelectItem>
				{#each filterOptions.employees as e (e.value)}
					<SelectItem value={String(e.value)}>{e.name}</SelectItem>
				{/each}
			</SelectContent>
		</Select>
	</div>
{/if}
