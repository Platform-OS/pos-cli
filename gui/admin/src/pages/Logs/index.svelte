<script>
  import { onMount } from "svelte";
  import fetchLogs from "./fetchLogs";
  import { logs, cachedLastId } from "./store.js";
  import Item from "./Item.svelte";

  const POLLING_INTERVAL = 3000;
  let filter = '';

  onMount(async () => {
    fetchLogs();
    setInterval(fetchLogs, POLLING_INTERVAL);
  });
</script>

<section class="xl:container">
  <ul>
    {#each $logs as log}
      <Item {log} {cachedLastId} {filter} />
    {/each}
  </ul>

  <p
    class="bg-yellow-100 font-light flex justify-between items-center text-sm border-yellow-600 px-3 py-2 mt-4"
  >
    <label for="" class="flex items-center">
      <p class="mr-2" title="Filter by log type and message text">Filter:</p>
      <input type="text" bind:value={filter} class="border outline-none border-gray-200 p-1">
    </label>
    Polling for new logs every {POLLING_INTERVAL / 1000} seconds.
  </p>

</section>
