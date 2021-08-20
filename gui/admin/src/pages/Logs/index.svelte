<script>
  import { onMount } from "svelte";
  import fetchLogs from "./fetchLogs";
  import { logs, clearLogs, cachedLastId } from "./store.js";
  import Item from "./Item.svelte";

  const POLLING_INTERVAL = 3000;
  let filter = '';

  onMount(async () => {
    fetchLogs();
    setInterval(fetchLogs, POLLING_INTERVAL);
  });
</script>


<p
  class="bg-gray-700 font-light flex justify-between items-center text-sm border-yellow-600 px-3 py-2 mb-4 sticky top-0"
>
  <label for="" class="flex items-center">
    <p class="mr-2 text-lg text-white" title="Filter by log type and message text">Filter:</p>
    <input type="text" bind:value={filter} class="border text-lg outline-none border-gray-200 px-2 py-1 w-96">
  </label>

  <button class="ml-auto bg-white text-gray-700 px-2 py-1" on:click="{clearLogs}">Clear screen</button>
</p>

<section class="xl:container">
  <ul>
    {#each $logs as log}
      <Item {log} {cachedLastId} {filter} />
    {/each}
  </ul>

  <p>
    Polling for new logs every {POLLING_INTERVAL / 1000} seconds.
  </p>
</section>
