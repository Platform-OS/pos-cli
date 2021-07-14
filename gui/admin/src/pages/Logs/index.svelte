<script>
  import { onMount } from "svelte";

  const POLLING_INTERVAL = 3000;
  const SUMMARY_LENGTH = 250;

  let logs = [];
  let cachedLastId = null;
  let lastId = null;

  const showDetails = document.location.href.indexOf('?2') > 0;

  const isHighlighted = (item) => {
    item.isHighlighted = !!item.error_type.match(/error/i);
  };

  const stringify = (msg) => {
    try {
      return JSON.stringify(JSON.parse(msg), null, 4);
    } catch (e) {
      return msg;
    }
  };

  const isBrowserTabFocused = () => !document.hidden;

  const fetchLogs = () => {
    // Make sure first load is always done (middle button click) by checking for cachedLastId
    if (!isBrowserTabFocused() && cachedLastId) return;

    return fetch(`/api/logs?lastId=${lastId}`)
      .then((res) => res.json())
      .then((res) => {
        if (!res.logs.length) return res;

        cachedLastId = lastId;

        lastId = res.logs.slice(-1)[0].id;
        return res;
      })
      .then((res) => {
        res.logs.forEach(isHighlighted);
        logs = logs.concat(res.logs);

        if (res.logs.length > 0) {
          setTimeout(() => {
            document.querySelector("footer").scrollIntoView();
          }, 200);
        }
      });
  };

  onMount(async () => {
    setInterval(fetchLogs, POLLING_INTERVAL);
  });
</script>

<section class="overflow-hidden">
  <div class="container py-8">
    <div class="m-1">
      <ul>
        {#each logs as { id, isHighlighted, message, error_type, updated_at } (id)}
          <li
            class="text-sm
            {isHighlighted ? 'text-red-800' : ''} text-sm
            flex flex-wrap justify-between shadow border border-gray-200 p-2
            "
          >
            <span class="text-xs">{error_type}</span>
            <span class="text-xs">{updated_at}</span>
            {#if showDetails}
              <details class="w-full">
                <summary class="mb-2">{message.substr(0, SUMMARY_LENGTH)}</summary>
                <pre class="px-2 py-3 bg-gray-200 break-all">{stringify(message)}</pre>
              </details>
            {:else}
              <div title={stringify(message)}>{message}</div>
            {/if}
          </li>

          <hr class="border-b my-2 {cachedLastId === id ? 'border-red-500' : 'border-white'}">
        {/each}
      </ul>
    </div>

    <p class="bg-yellow-100 border-yellow-600 px-3 py-2">
      Polling for new logs every {POLLING_INTERVAL / 1000} seconds.
    </p>
  </div>
</section>
