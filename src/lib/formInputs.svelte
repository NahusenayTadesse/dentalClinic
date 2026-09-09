<script lang="ts" context="module">
	type T = Record<string, unknown>;
</script>

<script lang="ts" generics="T extends Record<string, unknown>">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { formFieldProxy, type SuperForm, type FormPathLeaves } from 'sveltekit-superforms';
	import { Input } from './components/ui/input/index';
	import { Label } from './components/ui/label/index';

	type Props = HTMLInputAttributes & {
		superform: SuperForm<T>;
		field: FormPathLeaves<T>;
	};

	let { superform, field, ...rest }: Props = $props();

	const { value, errors, constraints } = formFieldProxy(superform, field);
</script>

<Label>
	{field}<br />
	<Input
		name={field}
		type="text"
		aria-invalid={$errors ? 'true' : undefined}
		bind:value={$value}
		{...$constraints}
		{...rest}
	/>
</Label>
{#if $errors}<span class="invalid">{$errors}</span>{/if}
