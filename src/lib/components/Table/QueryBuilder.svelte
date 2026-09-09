<script lang="ts">
	/**
	 * Composable filter builder over the rows a page already loaded.
	 *
	 * Sits alongside `FilterMenu`, which does categorical multi-select and the
	 * charts. This one handles the comparisons that menu cannot express —
	 * numeric ranges, date windows, text matching — and combines them with
	 * AND/OR. Chain them: this runs first, `FilterMenu` narrows what is left.
	 */
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Badge } from '$lib/components/ui/badge/index';
	import * as Card from '$lib/components/ui/card/index.js';
	import SelectComp from '$lib/formComponents/SelectComp.svelte';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Filter, Plus, RotateCcw, Trash2, X, Zap } from '@lucide/svelte';
	import { fly, slide } from 'svelte/transition';
	import {
		applyQuery,
		describe,
		fromPreset,
		newCondition,
		NO_OPERAND,
		operatorsFor,
		optionsFromData,
		defaultOperator,
		type Condition,
		type FieldDef,
		type MatchMode,
		type Preset
	} from '$lib/queryBuilder';

	let {
		data = [],
		fields = [],
		presets = [],
		filteredList = $bindable(data),
		class: className = ''
	}: {
		data: any[];
		fields: FieldDef[];
		presets?: Preset[];
		filteredList?: any[];
		class?: string;
	} = $props();

	let open = $state(false);
	let conditions = $state<Condition[]>([]);
	let match = $state<MatchMode>('all');

	const fieldFor = (key: string) => fields.find((f) => f.key === key) ?? fields[0];

	/** Enum choices come from the field definition, or from the data itself. */
	function choicesFor(key: string) {
		const field = fieldFor(key);
		return field?.options ?? optionsFromData(data, key);
	}

	$effect(() => {
		filteredList = applyQuery(data, conditions, match, fields);
	});

	function addCondition() {
		if (!fields.length) return;
		conditions = [...conditions, newCondition(fields[0])];
		open = true;
	}

	function removeCondition(id: string) {
		conditions = conditions.filter((c) => c.id !== id);
	}

	/** Changing the field resets the operator and operands to that type. */
	function onFieldChange(condition: Condition, key: string) {
		const field = fieldFor(key);
		condition.field = key;
		condition.operator = defaultOperator(field.type);
		condition.value = '';
		condition.value2 = '';
		condition.values = [];
	}

	function toggleMember(condition: Condition, value: string) {
		condition.values = condition.values.includes(value)
			? condition.values.filter((v) => v !== value)
			: [...condition.values, value];
	}

	function applyPreset(preset: Preset) {
		conditions = fromPreset(preset);
		match = preset.match ?? 'all';
		open = true;
	}

	function reset() {
		conditions = [];
		match = 'all';
	}

	const fieldOptions = $derived(fields.map((f) => ({ value: f.key, name: f.label })));
	const removed = $derived(data.length - filteredList.length);
</script>

<div class="flex w-full flex-col gap-3 {className}">
	<div class="flex flex-row flex-wrap items-center gap-2">
		<Button
			variant={conditions.length ? 'default' : 'outline'}
			size="sm"
			onclick={() => (open = !open)}
		>
			<Filter class="size-4" />
			Query Builder
			{#if conditions.length}
				<Badge variant="secondary" class="ml-1">{conditions.length}</Badge>
			{/if}
		</Button>

		{#each presets as preset (preset.label)}
			<Button
				variant="outline"
				size="sm"
				title={preset.description}
				onclick={() => applyPreset(preset)}
			>
				<Zap class="size-4" />
				{preset.label}
			</Button>
		{/each}

		{#if conditions.length}
			<Button variant="ghost" size="sm" onclick={reset}>
				<RotateCcw class="size-4" /> Clear
			</Button>
			<span class="text-sm text-muted-foreground">
				{filteredList.length} of {data.length}
				{#if removed > 0}· {removed} hidden{/if}
			</span>
		{/if}
	</div>

	<!-- Active conditions stay visible when the panel is closed, so a filtered
	     table never looks like an empty one. -->
	{#if conditions.length && !open}
		<div class="flex flex-row flex-wrap items-center gap-2" transition:slide>
			<span class="text-xs text-muted-foreground uppercase">
				Match {match === 'all' ? 'all' : 'any'}
			</span>
			{#each conditions as condition (condition.id)}
				<Badge variant="secondary" class="gap-1">
					{describe(condition, fields)}
					<button
						type="button"
						aria-label="Remove filter"
						onclick={() => removeCondition(condition.id)}
					>
						<X class="size-3" />
					</button>
				</Badge>
			{/each}
		</div>
	{/if}

	{#if open}
		<div transition:fly={{ y: -8, duration: 200 }}>
			<Card.Root>
				<Card.Header class="pb-3">
					<Card.Title class="flex flex-row items-center justify-between text-base">
						<span>Filter rows where…</span>
						<div class="flex flex-row items-center gap-2">
							<Label class="text-xs font-normal text-muted-foreground">match</Label>
							<div class="w-32">
								<SelectComp
									name="match"
									bind:value={match}
									items={[
										{ value: 'all', name: 'all conditions' },
										{ value: 'any', name: 'any condition' }
									]}
								/>
							</div>
						</div>
					</Card.Title>
				</Card.Header>

				<Card.Content class="flex flex-col gap-3">
					{#if !conditions.length}
						<p class="py-2 text-sm text-muted-foreground">
							No conditions yet — add one, or start from a shortcut above.
						</p>
					{/if}

					{#each conditions as condition, index (condition.id)}
						{@const field = fieldFor(condition.field)}
						<div class="flex flex-col gap-2 rounded-md border p-3" transition:slide>
							<div class="flex flex-row flex-wrap items-end gap-2">
								<span class="pb-2 text-xs text-muted-foreground uppercase">
									{index === 0 ? 'where' : match === 'all' ? 'and' : 'or'}
								</span>

								<div class="min-w-44 flex-1">
									<Label class="mb-1 block text-xs">Field</Label>
									<SelectComp
										name="field"
										value={condition.field}
										items={fieldOptions}
										onValueChange={(v: string) => onFieldChange(condition, v)}
									/>
								</div>

								<div class="min-w-44 flex-1">
									<Label class="mb-1 block text-xs">Condition</Label>
									<SelectComp
										name="operator"
										bind:value={condition.operator}
										items={operatorsFor(field.type)}
									/>
								</div>

								{#if !NO_OPERAND.includes(condition.operator) && field.type !== 'enum'}
									<div class="min-w-32 flex-1">
										<Label class="mb-1 block text-xs">
											{condition.operator === 'between' ? 'From' : 'Value'}
											{#if field.unit}<span class="text-muted-foreground">({field.unit})</span>{/if}
										</Label>
										<Input
											type={field.type === 'date' &&
											condition.operator !== 'lastDays' &&
											condition.operator !== 'nextDays'
												? 'date'
												: field.type === 'number' ||
													  condition.operator === 'lastDays' ||
													  condition.operator === 'nextDays'
													? 'number'
													: 'text'}
											bind:value={condition.value}
											placeholder={condition.operator === 'lastDays' ||
											condition.operator === 'nextDays'
												? 'days'
												: 'Value'}
										/>
									</div>

									{#if condition.operator === 'between'}
										<div class="min-w-32 flex-1">
											<Label class="mb-1 block text-xs">To</Label>
											<Input
												type={field.type === 'date' ? 'date' : 'number'}
												bind:value={condition.value2}
											/>
										</div>
									{/if}
								{/if}

								<Button
									variant="ghost"
									size="icon"
									title="Remove this condition"
									aria-label="Remove condition {index + 1}"
									onclick={() => removeCondition(condition.id)}
								>
									<Trash2 class="size-4 text-destructive" />
								</Button>
							</div>

							{#if field.type === 'enum' && !NO_OPERAND.includes(condition.operator)}
								<div class="flex flex-row flex-wrap gap-3 pt-1">
									{#each choicesFor(field.key) as choice (choice.value)}
										<label class="flex cursor-pointer flex-row items-center gap-2 text-sm">
											<Checkbox
												checked={condition.values.includes(choice.value)}
												onCheckedChange={() => toggleMember(condition, choice.value)}
											/>
											{choice.label}
										</label>
									{/each}
									{#if !choicesFor(field.key).length}
										<span class="text-sm text-muted-foreground">Nothing to choose from.</span>
									{/if}
								</div>
							{/if}

							{#if field.hint}
								<p class="text-xs text-muted-foreground">{field.hint}</p>
							{/if}
						</div>
					{/each}

					<div class="flex flex-row flex-wrap items-center gap-2 pt-1">
						<Button variant="outline" size="sm" onclick={addCondition}>
							<Plus class="size-4" /> Add Condition
						</Button>
						{#if conditions.length}
							<Button variant="ghost" size="sm" onclick={reset}>
								<RotateCcw class="size-4" /> Clear All
							</Button>
						{/if}
						<span class="ml-auto text-sm text-muted-foreground">
							{filteredList.length} of {data.length} rows match
						</span>
					</div>
				</Card.Content>
			</Card.Root>
		</div>
	{/if}
</div>
