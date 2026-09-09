<script lang="ts">
  import { Loader, OctagonMinus } from "@lucide/svelte";
	import Copy from "./Copy.svelte";
	import { searchableFields } from "./global.svelte";
	import { ScrollArea } from "./components/ui/scroll-area";
  import { Input } from "$lib/components/ui/input/index.js";

	
  

     let { mainlist,  tableHeaders = [{name:'Id', key: 'id'}, 
   {name:'Name', key: 'name'},
   {name:'Description', key: 'description'},
], link = 'students', search = false} = $props();
   let hover = $state(false);
   let table = $state()
   
   
  function removeColumn(colIndex: number) {
    for (let row of table.rows) {
      if (row.cells.length > colIndex) {
        row.deleteCell(colIndex);
      }
    }
  }
  let searchQuery= $state('');
  

function filterEmployees(persons, query) {
  if (!query) return persons;
  const queryTerms = query.trim().toLowerCase().split(/\s+/).filter(term => term.length > 0);
  if (queryTerms.length === 0) return persons;

  return persons.filter(person => {
    const fullName = `${person.firstName ?? ''} ${person.lastName ?? ''}`.toLowerCase();
    return queryTerms.every(term =>
      searchableFields.some(field =>
        String(person[field] ?? '').toLowerCase().includes(term)
      ) || fullName.includes(term)
    );
  });
}


</script>

{#if  search}
  <Input type="search"  bind:value={searchQuery} class="max-w-sm mb-4" placeholder="Search..." />

{/if}

  {#await mainlist}
    <!-- <Skeleton {tableHeaders} /> -->
     		  <Loader class="animate-spin w-16 h-16"/><h1 class="animate-pulse">Loading...		 </h1>


{:then rawList}
  <!-- normalise to a clean array -->
  {@const mainlist = Array.isArray(rawList)
        ? rawList.filter(Boolean)      // drop null / undefined rows
        : []}
        <ScrollArea class="w-full rounded-md border" orientation='horizontal'>

 <table id='table' class="divide-y divide-gray-200 dark:divide-gray-200"  bind:this = {table}>
    <thead class="bg-gray-100 dark:bg-black">
      <tr>
        {#each tableHeaders as head, index }
          <th
            scope="col"
            class="px-6 py-3 text-left text-xs font-semibold text-gray-700
             dark:text-gray-300 uppercase tracking-wider relative"
             onmouseenter={()=> hover=true}
             onmouseleave={()=>hover=false}
            >
            <div class="flex flex-row">
              {head.name}
            </div>

            {#if hover}

            <div class="flex flex-row">

             <button onclick={() => removeColumn(index)} 
              class="rounded-[50%] absolute right-1 top-2" title='Cut {head} from table'>
              <OctagonMinus size=16 color='red' /></button>


              </div>
              {/if}
              
          </th>
        {/each}
      </tr>
    </thead>
    <tbody class="bg-white dark:bg-black divide-y divide-gray-200 dark:divide-gray-200"  >
        {#if filterEmployees(mainlist, searchQuery).length === 0}
  <tr>
    <td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500">
      No data found.
    </td>
  </tr>
      
       {:else}
      {#each Object.values(filterEmployees(mainlist, searchQuery)) as person, index} 
    
 
        <tr class="hover:bg-gray-50 dark:hover:bg-dark transition-colors duration-150"> 
          
      
        {#each Object.entries(person) as [key, value]}
          {#if key === 'isActive' }
          <td class="px-6 py-4 whitespace-nowrap text-sm  {value ? 'bg-green-400' : 'bg-red-400'} text-white">{value ? 'Active' : 'InActive'}</td>
          {:else if key === 'id'}
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200 capitalize">{index + 1}</td>
          {:else if key === 'firstName' || key === 'lastName' || key === 'userName' || key === 'name' || key === 'categoryName' || key === 'positionName' || key === 'serviceName' || key === 'productName' || key === 'brandName' || key === 'supplierName' || key === 'customerName' || key === 'appointmentName' || key === 'staffName' }

          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200 capitalize
          hover:scale-110 transition-discrete duration-300 ease-in-out" >
          <a href='/dashboard/{link}/{person.id}'>{value}</a></td>
           {:else if key === 'studentFirstName' || key === 'studentLastName' || key==='userName'}

          
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200 capitalize
          hover:scale-110 transition-discrete duration-300 ease-in-out" ><a href='/dashboard/students/{person.id}'>{value}</a></td>
           

          {:else if key === 'phone' || key === 'parentPhone' || key === 'studentPhone' || key === 'bankAccount' || key ==='email'}
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200 capitalize">
               <Copy data={value} />
            </td>
          <!-- {:else if key === 'bankAccount'}
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200 capitalize">
               <Copy data={value} />
            </td> -->
          {:else }
          
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200 capitalize" >{value}</td>
                
         {/if}
          
          
          {/each}
        </tr>
      {/each}
      {/if}
    </tbody>
  </table>
        </ScrollArea>

   {:catch error}
  <div>
    <div  class="px-6 py-4 text-center text-sm text-red-500 te">
      Error loading data: {mainlist.error}
    </div>
  </div>

 
  {/await}
