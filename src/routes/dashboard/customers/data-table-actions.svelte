<script lang="ts">
 import EllipsisIcon from "@lucide/svelte/icons/ellipsis";
 import { Button } from "$lib/components/ui/button/index.js";
 import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
 	import { Copy, ExternalLink } from "@lucide/svelte";
	import { dropdownClass } from "$lib/global.svelte";

 let { id, phone,  customerName, createdById, createdBy }:
  { id: string, phone: string, customerName: string, createdById: string, createdBy: string} = $props();


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
   <DropdownMenu.Item class={dropdownClass} onclick={() => navigator.clipboard.writeText(phone)} title= 'Copy {phone}'>
      <Copy />  Copy Phone Number
      </DropdownMenu.Item>
  <DropdownMenu.Item><a href="/dashboard/customers/{id}" target="_blank" class={dropdownClass}><ExternalLink /> View {customerName}'s Details</a></DropdownMenu.Item>
  <DropdownMenu.Item><a href="/dashboard/user/{createdById}" target="_blank" class={dropdownClass}><ExternalLink /> View {createdBy}'s Details</a></DropdownMenu.Item>
 </DropdownMenu.Content>
</DropdownMenu.Root>