<script lang="ts">
	import type { Snapshot } from '@sveltejs/kit';
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import ExternalLink from '@lucide/svelte/icons/external-link';

	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { createForm, confirmLeave } from '@nahu/admin-kit/forms/createForm.js';
	import FormCard from '@nahu/admin-kit/formComponents/FormCard.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import CheckboxComp from '@nahu/admin-kit/formComponents/CheckboxComp.svelte';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { BLOOD_TYPE_OPTIONS, SEX_OPTIONS, registerPatient } from '../schema';

	let { data } = $props();

	/*
	 * Long enough that losing it to a stray back button costs real re-typing, with someone waiting
	 * at the window — so this one does get the leave prompt (CLAUDE.md §13).
	 */
	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, capture, restore, allErrors, message } = createForm(
		data.form,
		registerPatient,
		{ taintedMessage: confirmLeave }
	);

	export const snapshot: Snapshot = { capture, restore };

	const duplicates = $derived($message?.duplicates ?? []);

	const section = 'grid grid-cols-1 gap-4 lg:grid-cols-3';
</script>

<svelte:head>
	<title>Register a patient</title>
</svelte:head>

<FormCard
	title="Register a patient"
	description="Only the given name, father’s name and sex are required. Record what the patient can tell you now — the rest can be added on their chart."
	className="lg:w-full!"
>
	<form method="post" use:enhance class="flex flex-col gap-6">
		<Errors allErrors={$allErrors} />

		{#if duplicates.length}
			<!--
				The point of the whole page. A second record for the same person strands their allergy
				list on the first one, so a match stops the save until someone looks.
			-->
			<div
				role="alert"
				class="flex flex-col gap-2 rounded-lg border border-destructive bg-destructive/10 p-4 text-sm"
			>
				<p class="flex items-center gap-2 font-semibold text-destructive">
					<TriangleAlert class="size-4" /> This may be a patient who is already registered
				</p>
				<div>
					<ul class="my-2 flex flex-col gap-1">
						{#each duplicates as match (match.id)}
							<li class="flex flex-wrap items-center gap-2">
								<a
									class="inline-flex items-center gap-1 font-semibold underline"
									href="/dashboard/patients/{match.id}"
									target="_blank"
								>
									{match.name}
									<ExternalLink class="size-3" />
								</a>
								<span>{match.fileNo ? `File ${match.fileNo}` : 'No file number'}</span>
								{#if match.phone}<span>· {match.phone}</span>{/if}
								<span class="text-xs">({match.reason})</span>
							</li>
						{/each}
					</ul>
					If one of these is the person in front of you, open their chart instead. If not, confirm below
					and register again.
				</div>
			</div>

			<InputComp
				{form}
				{errors}
				name="confirmNotDuplicate"
				type="checkboxSingle"
				label="Not a duplicate"
				placeholder="I have checked — this is a different person"
			/>
		{/if}

		<section class="flex flex-col gap-4">
			<h3 class="text-lg font-semibold">Who they are</h3>
			<div class={section}>
				<InputComp {form} {errors} name="name" label="Given name" required />
				<InputComp {form} {errors} name="fatherName" label="Father’s name" required />
				<InputComp {form} {errors} name="grandFatherName" label="Grandfather’s name" />
				<InputComp
					{form}
					{errors}
					name="sex"
					label="Sex"
					type="select"
					items={SEX_OPTIONS}
					required
				/>
				<InputComp
					{form}
					{errors}
					name="fileNo"
					label="File number"
					placeholder="Leave empty if not assigned yet"
				/>
				<InputComp
					{form}
					{errors}
					name="bloodType"
					label="Blood type"
					type="select"
					items={BLOOD_TYPE_OPTIONS}
				/>
			</div>

			<div class={section}>
				<InputComp
					{form}
					{errors}
					name="knowsBirthDate"
					type="checkboxSingle"
					label="Birth date"
					placeholder="The patient knows their date of birth"
				/>
				{#if $form.knowsBirthDate}
					<InputComp {form} {errors} name="birthDate" label="Date of birth" type="date" year />
				{:else}
					<InputComp
						{form}
						{errors}
						name="ageYears"
						label="Approximate age"
						type="number"
						min={0}
						max={120}
						description="Saved as an estimated birth date, and shown with a ~."
					/>
				{/if}
			</div>
		</section>

		<section class="flex flex-col gap-4">
			<h3 class="text-lg font-semibold">How to reach them</h3>
			<div class={section}>
				<InputComp
					{form}
					{errors}
					name="phone"
					label="Phone"
					type="tel"
					placeholder="0911 23 45 67"
				/>
				<InputComp {form} {errors} name="altPhone" label="Second phone" type="tel" />
			</div>
		</section>

		<section class="flex flex-col gap-4">
			<h3 class="text-lg font-semibold">Health</h3>
			<div class="flex flex-col gap-2">
				<span class="text-sm font-medium">Allergies the patient reports</span>
				<!--
					A getter/setter binding: the checkboxes hold ids, the form posts one comma-separated
					string, and neither side needs an effect to keep the other in step.
				-->
				<CheckboxComp
					items={data.allergenList}
					bind:checkedValues={
						() =>
							String($form.allergenIds ?? '')
								.split(',')
								.filter(Boolean)
								.map(Number),
						(values) => ($form.allergenIds = (values ?? []).join(','))
					}
				/>
				<input type="hidden" name="allergenIds" value={$form.allergenIds ?? ''} />
				<p class="text-xs text-muted-foreground">
					Recorded as severity “unknown”. A clinician grades each one on the chart.
				</p>
			</div>
			<InputComp
				{form}
				{errors}
				name="medicalNotes"
				label="Other medical notes"
				type="textarea"
				rows={3}
				placeholder="Anything that is not an allergy, condition or medicine"
			/>
		</section>

		<section class="flex flex-col gap-4">
			<h3 class="text-lg font-semibold">How they came, and who pays</h3>
			<div class={section}>
				<InputComp
					{form}
					{errors}
					name="referralSourceId"
					label="Heard of us through"
					type="combo"
					items={data.referralList}
				/>
				<InputComp
					{form}
					{errors}
					name="referredBy"
					label="Referred by"
					placeholder="Dr Tesfaye at Bethel, her sister Almaz…"
				/>
				<InputComp
					{form}
					{errors}
					name="customerId"
					label="Billed to"
					type="combo"
					items={data.customers}
					description="An employer or insurer. Leave empty when the patient pays at the desk."
				/>
			</div>
		</section>

		<Button type="submit" class="self-start">
			{#if $delayed}
				<LoadingBtn name="Registering" />
			{:else}
				<UserPlus /> Register patient
			{/if}
		</Button>
	</form>
</FormCard>
