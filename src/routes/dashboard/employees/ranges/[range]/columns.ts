 
    import { renderComponent } from '$lib/components/ui/data-table/index.js';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
    import DataTableActions from './data-table-actions.svelte';
import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
import Copy from '$lib/Copy.svelte';



  

 export const commissionProduct = [
  {
      accessorKey: 'index',
      header: '#',
      cell: info => info.row.index+1,
      sortable: false
    },


 
     { accessorKey: 'product',
      header: ({ column }) =>
      renderComponent(DataTableSort, {
        name: 'Product',
        onclick: column.getToggleSortingHandler(), 
      }),        
         sortable: true, 
       },
      {
        // Corresponds to staffId from the query
        accessorKey: 'amount', 
        header: 'Amount',
        sortable: true,
    },
    {
        // Corresponds to date
        accessorKey: 'date',
        header: ({ column }) =>
            renderComponent(DataTableSort, {
                name: 'Date',
                onclick: column.getToggleSortingHandler(), 
            }), 
        sortable: true,
        // Optional: Custom cell rendering for date formatting
        cell: info => {
            // Assuming the date comes in a format that can be parsed by Date
            const date = new Date(info.getValue());
            return date.toLocaleDateString(); // Customize date format as needed
        },
    },
    // You could add an 'actions' column if needed for this table as well.
];

export const commissionService = [
  {
      accessorKey: 'index',
      header: '#',
      cell: info => info.row.index+1,
      sortable: false
    },


 
     { accessorKey: 'service',
      header: ({ column }) =>
      renderComponent(DataTableSort, {
        name: 'Service',
        onclick: column.getToggleSortingHandler(), 
      }),        
         sortable: true, 
       },
      {
        // Corresponds to staffId from the query
        accessorKey: 'amount', 
        header: 'Amount',
        sortable: true,
    },
    {
        // Corresponds to date
        accessorKey: 'date',
        header: ({ column }) =>
            renderComponent(DataTableSort, {
                name: 'Date',
                onclick: column.getToggleSortingHandler(), 
            }), 
        sortable: true,
        // Optional: Custom cell rendering for date formatting
        cell: info => {
            // Assuming the date comes in a format that can be parsed by Date
            const date = new Date(info.getValue());
            return date.toLocaleDateString(); // Customize date format as needed
        },
    },
    // You could add an 'actions' column if needed for this table as well.
];

export const overtime = [
  {
      accessorKey: 'index',
      header: '#',
      cell: info => info.row.index+1,
      sortable: false
    },


 
     { accessorKey: 'description',
      header: 'Reason',      
        sortable: false, 
       },
      {
        // Corresponds to staffId from the query
        accessorKey: 'amount', 
        header: 'Amount',
        sortable: true,
    },
    {
        // Corresponds to date
        accessorKey: 'date',
        header: ({ column }) =>
            renderComponent(DataTableSort, {
                name: 'Date',
                onclick: column.getToggleSortingHandler(), 
            }), 
        sortable: true,
        // Optional: Custom cell rendering for date formatting
        cell: info => {
            // Assuming the date comes in a format that can be parsed by Date
            const date = new Date(info.getValue());
            return date.toLocaleDateString(); // Customize date format as needed
        },
    },
    // You could add an 'actions' column if needed for this table as well.
];


export const deductions = [
  {
      accessorKey: 'index',
      header: '#',
      cell: info => info.row.index+1,
      sortable: false
    },


    { accessorKey: 'description',
      header: 'Description',      
        sortable: false, 
       },      
      
      {
        // Corresponds to staffId from the query
        accessorKey: 'amount', 
        header: 'Amount',
        sortable: true,
    },
    {
        // Corresponds to date
        accessorKey: 'date',
        header: ({ column }) =>
            renderComponent(DataTableSort, {
                name: 'Date',
                onclick: column.getToggleSortingHandler(), 
            }), 
        sortable: true,
        // Optional: Custom cell rendering for date formatting
        cell: info => {
            // Assuming the date comes in a format that can be parsed by Date
            const date = new Date(info.getValue());
            return date.toLocaleDateString(); // Customize date format as needed
        },
    },
    // You could add an 'actions' column if needed for this table as well.
];