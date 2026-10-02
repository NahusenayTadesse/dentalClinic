<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { formatETB, formatEthiopianDate } from '$lib/global.svelte';
	import { clinicClock } from '$lib/clinicTime';
	import {
		PROCEDURE_STATUS_LABEL,
		UNBILLED_STATUSES,
		isProcedureStatus
	} from '$lib/procedureStatus';
	import { CHART_ROWS, toothName } from '$lib/teeth';
	import type { ServiceArea } from '$lib/serviceAreas';
	import SurfacePicker from './SurfacePicker.svelte';

	/**
	 * The fields of the charting form, shared by the add and edit dialogs.
	 *
	 * The form changes shape with the service: a filling asks for a tooth and its surfaces, an
	 * extraction for a tooth, a bridge for a span, an examination for none of them. A fee is asked
	 * for only where one is charged, and says what it defaults to. All of this is guidance; the
	 * server applies the same rules and is what refuses (`$lib/server/procedures.ts`).
	 */
	type Service = {
		value: number;
		name: string;
		area: ServiceArea;
		price: number | null;
		category: string | null;
	};

	/*
	 * Typed as `InputComp` takes them, because every field here is handed straight to it. The add and
	 * edit forms differ in shape (`id`), and superforms types each from its schema's *input*, where
	 * a coerced number is `unknown` — so the output type `AddProcedure` fits neither.
	 */
	type Store = ComponentProps<typeof InputComp>['form'];

	let {
		form,
		errors,
		values,
		services,
		providers,
		visits
	}: {
		form: Store;
		errors: Store;
		values: Record<string, unknown>;
		services: Service[];
		providers: { value: number; name: string }[];
		visits: { value: number; startsAt: Date | string; status: string }[];
	} = $props();

	const service = $derived(services.find((s) => s.value === Number(values.serviceId)));
	const area = $derived(service?.area ?? null);
	const status = $derived(String(values.status ?? ''));
	const charged = $derived(!isProcedureStatus(status) || !UNBILLED_STATUSES.includes(status));

	const serviceItems = $derived(
		services.map((s) => ({
			value: s.value,
			name: s.category ? `${s.name} · ${s.category}` : s.name
		}))
	);

	const statusItems = Object.entries(PROCEDURE_STATUS_LABEL).map(([value, { label, hint }]) => ({
		value,
		name: `${label} — ${hint}`
	}));

	/** Every tooth, permanent then primary, each with its name. */
	const toothItems = [CHART_ROWS.permanent, CHART_ROWS.primary].flatMap((set) =>
		[...set.upper.flat(), ...set.lower.flat()].map((code) => ({
			value: code,
			name: `${code} · ${toothName(code)}`
		}))
	);

	const visitItems = $derived(
		visits.map((v) => ({
			value: v.value,
			name: `${formatEthiopianDate(new Date(v.startsAt))} · ${clinicClock(v.startsAt)} · ${v.status}`
		}))
	);

	const feeHint = $derived(
		service?.price === null || service?.price === undefined
			? 'No standard fee for this service — enter one'
			: `Leave empty for the standard fee, ${formatETB(service.price)}`
	);
</script>

<InputComp
	{form}
	{errors}
	name="serviceId"
	label="What was done or found"
	type="combo"
	items={serviceItems}
/>

<InputComp {form} {errors} name="status" label="Status" type="select" items={statusItems} />

{#if area === 'tooth' || area === 'surface'}
	<InputComp {form} {errors} name="toothId" label="Tooth" type="combo" items={toothItems} />
{/if}

{#if area === 'surface'}
	<SurfacePicker
		{form}
		tooth={values.toothId ? Number(values.toothId) : null}
		error={$errors.surfaces}
	/>
{/if}

{#if area === 'range'}
	<InputComp
		{form}
		{errors}
		name="toothRange"
		label="Teeth spanned"
		placeholder="e.g. 14-16, or 14, 15, 16"
	/>
{/if}

<InputComp
	{form}
	{errors}
	name="providerId"
	label={status === 'completed' ? 'Done by' : 'Dentist'}
	type="combo"
	items={providers}
	required={status === 'completed'}
/>

{#if visitItems.length}
	<InputComp
		{form}
		{errors}
		name="appointmentId"
		label="At visit"
		type="select"
		items={visitItems}
		required={false}
	/>
{/if}

{#if charged}
	<InputComp
		{form}
		{errors}
		name="fee"
		label="Fee (birr)"
		type="number"
		min={0}
		required={false}
		placeholder={feeHint}
	/>
{:else}
	<p class="text-sm text-muted-foreground">
		Not charged: {status === 'condition'
			? 'a finding is not a treatment'
			: 'this work was done elsewhere'}.
	</p>
{/if}

<InputComp {form} {errors} name="note" label="Note" type="textarea" rows={3} required={false} />
