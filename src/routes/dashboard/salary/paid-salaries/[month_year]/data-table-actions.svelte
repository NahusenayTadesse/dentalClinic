<script lang="ts">
 import EllipsisIcon from "@lucide/svelte/icons/ellipsis";
 import { Button } from "$lib/components/ui/button/index.js";
 import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
 	import {  ExternalLink } from "@lucide/svelte";
	import { dropdownClass } from "$lib/global.svelte";

 let { id,   name}:
  { id: string, name: string} = $props();


</script>
 
<DropdownMenu.Root>
 <DropdownMenu.Trigger>
  {#snippet child({ props })}
   <Button
    {...props}
    variant="ghost"
    size="icon"
    class="relative size-8 p-0"
   >
    <span class="sr-only">Open menu</span>
    <EllipsisIcon />
   </Button>
  {/snippet}
 </DropdownMenu.Trigger>
 <DropdownMenu.Content>
  <DropdownMenu.Group>
   <DropdownMenu.Label>Actions</DropdownMenu.Label>
  
  </DropdownMenu.Group>
  <DropdownMenu.Separator />
 
  <DropdownMenu.Item><a href="/dashboard/salary/single/{id}" target="_blank" class={dropdownClass}><ExternalLink /> View {name}'s Details</a></DropdownMenu.Item>
 </DropdownMenu.Content>
</DropdownMenu.Root>