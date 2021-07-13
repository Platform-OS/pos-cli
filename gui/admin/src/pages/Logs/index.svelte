<script>
  import { onMount } from 'svelte';

  const POLLING_INTERVAL = 2000;

  let logs = [];
  let cachedLastId = null;
  let lastId = null;

  const isHighlighted = item => {
    item.isHighlighted = !!item.error_type.match(/error/i);
  }

  const stringify = (msg) => {
    try {
      return JSON.stringify(JSON.parse(msg), null, 4);
    } catch(e) {
      return msg;
    }
  }

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
      }).then(res => {
        res.logs.forEach(isHighlighted);
        logs = logs.concat(res.logs);
      }).then(() => {
        document.querySelector('footer').scrollIntoView();
        setTimeout(fetchLogs, POLLING_INTERVAL);
      })
  }

  onMount(async () => {
    fetchLogs()
  });

</script>

<h1 class="mb-2 text-5xl">platformOS Logs</h1>

<section class="overflow-hidden">
  <div class="container py-8">
    <div class="m-1">
      <ul>
        {#each logs as { id, isHighlighted, message, error_type, updated_at } (id)}
          <li
            class="text-sm
            {isHighlighted ? "text-red-800" : ''} text-sm
            flex flex-wrap justify-between mb-5 shadow border border-gray-200 p-2
            "
          >
            <span class="text-xs">{error_type}</span>
            <span class="text-xs">{updated_at}</span>
            <span class="text-base w-full mt-2 {cachedLastId === id ? "border-red-500 border-b" : ''}">
              <div class="w-full" title="{stringify(message)}">{message}</div>
            </span>
          </li>
        {/each}
      </ul>
    </div>

    <p class="bg-yellow-100 border-yellow-600 px-3 py-2">Polling for new logs every {POLLING_INTERVAL / 1000} seconds.</p>
  </div>
</section>
