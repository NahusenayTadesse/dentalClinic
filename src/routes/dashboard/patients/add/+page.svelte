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
	import { BLOOD_TYPE_OPTIONS, registerPatient } from '../schema';
	import { useI18n } from '$lib/i18n/i18n.svelte';

	let { data } = $props();

	const t = useI18n();
	const r = $derived(t.m.patients.register);
	const pm = $derived(t.m.patients);
	const sexOptions = $derived([
		{ value: 'female', name: pm.sex.female },
		{ value: 'male', name: pm.sex.male }
	]);

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
	<title>{r.title}</title>
</svelte:head>

<FormCard title={r.title} description={r.description} className="lg:w-full!">
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
					<TriangleAlert class="size-4" />
					{r.duplicateTitle}
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
								<span>{match.fileNo ? pm.file(match.fileNo) : pm.noFileNumber}</span>
								{#if match.phone}<span>· {match.phone}</span>{/if}
								<span class="text-xs">({match.reason})</span>
							</li>
						{/each}
					</ul>
					{r.duplicateHelp}
				</div>
			</div>

			<InputComp
				{form}
				{errors}
				name="confirmNotDuplicate"
				type="checkboxSingle"
				label={r.notDuplicate}
				placeholder={r.notDuplicateConfirm}
			/>
		{/if}

		<section class="flex flex-col gap-4">
			<h3 class="text-lg font-semibold">{r.who}</h3>
			<div class={section}>
				<InputComp {form} {errors} name="name" label={r.givenName} required />
				<InputComp {form} {errors} name="fatherName" label={r.fatherName} required />
				<InputComp {form} {errors} name="grandFatherName" label={r.grandFatherName} />
				<InputComp
					{form}
					{errors}
					name="sex"
					label={r.sex}
					type="select"
					items={sexOptions}
					required
				/>
				<InputComp
					{form}
					{errors}
					name="fileNo"
					label={r.fileNo}
					placeholder={r.fileNoPlaceholder}
				/>
				<InputComp
					{form}
					{errors}
					name="bloodType"
					label={r.bloodType}
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
					label={r.birthDate}
					placeholder={r.knowsBirthDate}
				/>
				{#if $form.knowsBirthDate}
					<InputComp {form} {errors} name="birthDate" label={r.dateOfBirth} type="date" year />
				{:else}
					<InputComp
						{form}
						{errors}
						name="ageYears"
						label={r.approxAge}
						type="number"
						min={0}
						max={120}
						description={r.approxAgeHint}
					/>
				{/if}
			</div>
		</section>

		<section class="flex flex-col gap-4">
			<h3 class="text-lg font-semibold">{r.reach}</h3>
			<div class={section}>
				<InputComp
					{form}
					{errors}
					name="phone"
					label={r.phone}
					type="tel"
					placeholder="0911 23 45 67"
				/>
				<InputComp {form} {errors} name="altPhone" label={r.altPhone} type="tel" />
			</div>
		</section>

		<section class="flex flex-col gap-4">
			<h3 class="text-lg font-semibold">{r.health}</h3>
			<div class="flex flex-col gap-2">
				<span class="text-sm font-medium">{r.allergiesReported}</span>
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
					{r.allergiesNote}
				</p>
			</div>
			<InputComp
				{form}
				{errors}
				name="medicalNotes"
				label={r.otherNotes}
				type="textarea"
				rows={3}
				placeholder={r.otherNotesPlaceholder}
			/>
		</section>

		<section class="flex flex-col gap-4">
			<h3 class="text-lg font-semibold">{r.howCame}</h3>
			<div class={section}>
				<InputComp
					{form}
					{errors}
					name="referralSourceId"
					label={r.heardThrough}
					type="combo"
					items={data.referralList}
				/>
				<InputComp
					{form}
					{errors}
					name="referredBy"
					label={r.referredBy}
					placeholder={r.referredByPlaceholder}
				/>
				<InputComp
					{form}
					{errors}
					name="customerId"
					label={r.billedTo}
					type="combo"
					items={data.customers}
					description={r.billedToHint}
				/>
			</div>
		</section>

		<Button type="submit" class="self-start">
			{#if $delayed}
				<LoadingBtn name={r.registering} />
			{:else}
				<UserPlus /> {r.submit}
			{/if}
		</Button>
	</form>
</FormCard>
