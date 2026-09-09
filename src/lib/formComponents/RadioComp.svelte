<script>
          import * as RadioGroup from "$lib/components/ui/radio-group/index.js";
	import { label } from "$lib/global.svelte";

    let { name, value=$bindable(), items, required=true, btnName} = $props();

</script>

<RadioGroup.Root bind:value {name} required={required}> 
        <label for="" class={label}> {btnName}</label>

        {#each items as item}

  <div class="flex items-center  space-x-2">
    <RadioGroup.Item value={item.value} id="option-one" />
    <label class={label} for="true">{item.name}</label>
  </div>
  {/each}

</RadioGroup.Root>