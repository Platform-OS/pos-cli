<script>
  import { onMount } from "svelte";
  import fetchLogs from "./fetchLogs";
  import { logs } from "./store.js";
  import Item from "./Themes/Item.svelte";

  const POLLING_INTERVAL = 3000;

  onMount(async () => {
    fetchLogs();
    setInterval(fetchLogs, POLLING_INTERVAL);
  });
</script>

<section class="xl:container">
  <ul>
    {#each $logs as log}
      <Item {log} />
    {/each}
  </ul>

  <p
    class="bg-yellow-100 font-light text-sm border-yellow-600 px-3 py-2 mt-4 flex"
  >
    Polling for new logs every {POLLING_INTERVAL / 1000} seconds.
  </p>
</section>
