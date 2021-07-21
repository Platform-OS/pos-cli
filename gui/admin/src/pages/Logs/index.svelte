<script>
  import { onMount } from "svelte";
  import { get } from "svelte/store";

  import DefaultTheme from "./Themes/Default.svelte";
  import CompactTheme from "./Themes/Compact.svelte";

  import fetchLogs from "./fetchLogs";

  const POLLING_INTERVAL = 3000;

  let compactView = false;

  onMount(async () => {
    fetchLogs();
    setInterval(fetchLogs, POLLING_INTERVAL);
  });
</script>

<section class="container m-1">
  {#if compactView}
    <CompactTheme />
  {:else}
    <DefaultTheme />
  {/if}

  <p
    class="bg-yellow-100 font-light text-sm border-yellow-600 px-3 py-2 mt-4 flex"
  >
    Polling for new logs every {POLLING_INTERVAL / 1000} seconds.

    <label for="cv" class="ml-auto cursor-pointer">
      <input type="checkbox" name="cv" id="cv" bind:checked={compactView} />
      Pretty print JSON
    </label>
  </p>
</section>
