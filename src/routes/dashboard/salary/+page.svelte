<script lang="ts">
	import MonthYear from '@nahu/admin-kit/formComponents/MonthYear.svelte';
	import { CalendarDate, getLocalTimeZone, today } from '@internationalized/date';

	let selectedMonth: CalendarDate = $state(today(getLocalTimeZone()));
</script>

<MonthYear bind:value={selectedMonth} mode="month" />
<input type="text" bind:value={selectedMonth} />
