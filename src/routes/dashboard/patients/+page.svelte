<script lang="ts">
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import Search from '@lucide/svelte/icons/search';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import DataTable from '$lib/components/Table/data-table.svelte';
	import { columns, owesColumn } from './columns';

	let { data } = $props();

	const q = $derived(data.currentQuery);

	/*
	 * Nothing narrowed the list — which is what separates "no patients registered yet" from "your
	 * filters matched none". The add-your-first screen must never answer a search.
	 */
	const isFiltered = $derived(
		Boolean(
			q.search ||
			q.dateStart ||
			q.sex ||
			q.ageBand ||
			q.bloodType ||
			q.referralId ||
			q.payer ||
			q.allergenId ||
			q.conditionId ||
			q.alert ||
			q.history
		)
	);
</script>

<svelte:head>
	<title>Patients</title>
</svelte:head>

{#if data.pagination.total === 0 && !isFiltered}
	<div class="flex h-96 w-full flex-col items-center justify-center gap-4 text-center">
		<p class="text-3xl">
			{data.elsewhere > 0 ? 'No patients registered at this branch' : 'No patients registered yet'}
		</p>

		{#if data.elsewhere > 0}
			<p class="text-muted-foreground">
				{data.elsewhere.toLocaleString()} registered at other branches. Search by name or phone to find
				one — searches cover every branch.
			</p>
		{/if}

		{#if data.canRegister}
			<Button href="/dashboard/patients/add"><UserPlus /> Register a patient</Button>
		{/if}
	</div>
{:else}
	<div class="my-4 flex flex-wrap items-center justify-between gap-2">
		<h2 class="text-2xl">Patients</h2>
		{#if data.canRegister}
			<Button href="/dashboard/patients/add"><UserPlus /> Register a patient</Button>
		{/if}
	</div>

	{#if data.scopedToBranch}
		<!-- The two rules of §15, said where they apply: browsing is this branch, searching is all. -->
		<p class="flex items-center gap-2 text-sm text-muted-foreground">
			<Search class="size-4" />
			{q.search
				? 'Searching every branch. Patients from elsewhere are marked, and can be treated here.'
				: 'Showing patients registered at this branch. Search by name, file number or phone to look across every branch.'}
		</p>
	{/if}

	<DataTable
		data={data.patients}
		columns={data.showBalance ? [...columns, owesColumn] : columns}
		fileName="Patients"
		charts
		dateFilter="Registered"
		facetKeys={[
			'sex',
			'age',
			'bloodType',
			'alerts',
			'allergies',
			'conditions',
			'history',
			'referral',
			'payer'
		]}
		facetLabels={{
			sex: 'Sex',
			age: 'Age',
			bloodType: 'Blood type',
			alerts: 'Alerts',
			allergies: 'Allergy',
			conditions: 'Condition',
			history: 'Medical history',
			referral: 'Heard of us',
			payer: 'Who pays'
		}}
		facetParams={{
			age: 'ageBand',
			alerts: 'alert',
			allergies: 'allergenId',
			conditions: 'conditionId',
			referral: 'referralId'
		}}
		server={{
			pagination: data.pagination,
			facets: data.facets,
			filters: {
				search: q.search,
				sort: q.sort,
				dir: q.dir,
				dateStart: q.dateStart,
				dateEnd: q.dateEnd,
				sex: q.sex,
				age: q.ageBand,
				bloodType: q.bloodType,
				alerts: q.alert,
				allergies: q.allergenId,
				conditions: q.conditionId,
				history: q.history,
				referral: q.referralId,
				payer: q.payer
			}
		}}
	/>
{/if}
