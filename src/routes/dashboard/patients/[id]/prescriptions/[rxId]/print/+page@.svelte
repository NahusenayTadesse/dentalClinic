<script lang="ts">
	import PrintSheet from '$lib/components/PrintSheet.svelte';
	import { formatEthiopianDate } from '$lib/global.svelte';

	/**
	 * A prescription on paper. Age is left blank when the birth date is unknown rather than
	 * guessed — the schema note on `prescription` says why that is the honest answer.
	 */
	let { data } = $props();

	const sheet = $derived(data.sheet);
	const p = $derived(data.patient);
	const age = $derived(p.age === null ? '' : `${p.birthDateEstimated ? 'about ' : ''}${p.age}`);
	const FORM: Record<string, string> = {
		tablet: 'tab',
		capsule: 'cap',
		syrup: 'syrup',
		suspension: 'susp',
		injection: 'inj',
		mouthwash: 'mouthwash',
		gel: 'gel',
		cream: 'cream',
		other: ''
	};
</script>

<svelte:head>
	<title>Prescription — {p.fullName}</title>
</svelte:head>

<PrintSheet branch={data.branch}>
	<section class="flex flex-col gap-1">
		<p class="text-xl font-semibold">Prescription</p>
		<dl class="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
			<dt class="text-muted-foreground">Patient</dt>
			<dd class="sm:col-span-3">{p.fullName}</dd>
			<dt class="text-muted-foreground">Sex</dt>
			<dd>{p.sex === 'female' ? 'Female' : 'Male'}</dd>
			<dt class="text-muted-foreground">Age</dt>
			<dd>{age}</dd>
			<dt class="text-muted-foreground">Weight</dt>
			<dd>{sheet.weightKg ? `${sheet.weightKg} kg` : ''}</dd>
			<dt class="text-muted-foreground">Card no.</dt>
			<dd>{p.fileNo ?? ''}</dd>
			<dt class="text-muted-foreground">Date</dt>
			<dd class="sm:col-span-3">{formatEthiopianDate(new Date(sheet.prescribedOn))}</dd>
			<dt class="text-muted-foreground">Diagnosis</dt>
			<dd class="sm:col-span-3">{sheet.indication ?? ''}</dd>
		</dl>
	</section>

	<ol class="flex list-decimal flex-col gap-3 pl-6 text-sm">
		{#each sheet.items as item (item.id)}
			<li>
				<p class="font-semibold">
					{item.medicine}
					{item.strength ?? ''}
					{FORM[item.form] ?? ''}
				</p>
				<p>
					{[
						item.dose,
						item.frequency,
						item.durationDays ? `for ${item.durationDays} days` : null,
						item.quantity ? `(${item.quantity})` : null
					]
						.filter(Boolean)
						.join(' · ')}
				</p>
				{#if item.instructions}<p class="text-muted-foreground">{item.instructions}</p>{/if}
			</li>
		{/each}
	</ol>

	{#if sheet.notes}<p class="text-sm">{sheet.notes}</p>{/if}

	<section class="mt-8 grid grid-cols-2 gap-6 text-sm">
		<div>
			<p class="text-muted-foreground">Prescriber</p>
			<p class="font-medium">{sheet.provider ?? ''}</p>
			{#if sheet.licenceNumber}<p>Licence {sheet.licenceNumber}</p>{/if}
		</div>
		<div>
			<p class="text-muted-foreground">Signature</p>
			<div class="mt-8 border-b"></div>
		</div>
	</section>
</PrintSheet>
