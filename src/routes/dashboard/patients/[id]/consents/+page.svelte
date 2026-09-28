<script lang="ts">
	import FileSignature from '@lucide/svelte/icons/file-signature';
	import Section from '$lib/components/Section.svelte';
	import LookupSection from '$lib/components/lookup/LookupSection.svelte';
	import { childActionPaths } from '$lib/components/lookup/actions';
	import { consentConfig } from './config';
	import { addConsent, editConsent } from './schema';

	/**
	 * The consents tab: each consent the patient gave, how it was given, who witnessed it, and — if
	 * it was withdrawn — when and why. A consent is withdrawn by giving the reason, never deleted.
	 */
	let { data } = $props();

	const standing = $derived(data.consents.rows.length - data.withdrawn);
</script>

<svelte:head>
	<title>{data.patient.fullName} — Consents</title>
</svelte:head>

<Section title="Consents" IconComp={FileSignature} style="identityIcon">
	<p class="mb-3 text-sm text-muted-foreground">
		{standing} standing{data.withdrawn ? `, ${data.withdrawn} withdrawn` : ''}. A verbal consent
		names the clinician who witnessed it; a signed form is attached on the
		<strong>Files</strong> tab first, then chosen here.
	</p>
	<LookupSection
		config={consentConfig}
		rows={data.consents.rows}
		addForm={data.consents.addForm}
		editForm={data.consents.editForm}
		options={data.options}
		actions={childActionPaths('Consent')}
		schemas={{ add: addConsent, edit: editConsent }}
		readonly={!data.canWrite}
		canDelete={data.canDelete}
	/>
</Section>
