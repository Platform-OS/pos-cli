<script>
	import { onMount } from 'svelte';

  const MAX_PREVIEW = 250;

  let logs = [];
  let cachedLastId = null;
  let lastId = null;

  // const isHighlighted = item => {
  //   item.highlighted = !!item.error_type.match(/error/i);
  //   return item;
  // }

  const fetchLogs = () => {
    return fetch(`/api/logs?lastId=${lastId}`)
      .then((res) => res.json())
      .then((res) => {
        if (!res.logs.length) return res;

        cachedLastId = lastId;
        lastId = res.logs.slice(-1)[0].id;
        return res;
      }).then(res => {
        // res.logs.forEach(isHighlighted);
        logs = res.logs;
      });
  }

  const getMsg = (msg) => {
    try {
      return JSON.stringify(JSON.parse(msg), null, 2);
    } catch(e) {
      return msg;
    }
  }

  onMount(async () => {
		logs = await fetchLogs()
	});
</script>

<h1 class="mb-2 text-5xl">Logs</h1>

<section class="overflow-hidden">
  <div class="container py-8">
    <div class="">
      <ul>
        {#each logs as { id, error_type, message, updated_at } (id)}
        <li
            class="
              {cachedLastId === id ? "border-red-500 border-b" : ''} text-sm
              flex flex-wrap justify-between mb-5 shadow border border-gray-200 p-2
            "
          >
            <span class="text-xs">{error_type}</span>
            <span class="text-xs">{updated_at}</span>
            <span class="text-base w-full">

              {#if message.length > MAX_PREVIEW}
                <details class="mt-1">
                  <summary><span class="break-all">{message.substr(1, MAX_PREVIEW)}</span></summary>

                  <pre class="text-sm overflow-y-auto max-h-64 ml-4 mt-4 border border-gray-200">
                    {getMsg(message)}
                  </pre>
                </details>
              {:else}
                <span class="break-all">{message.substr(1, MAX_PREVIEW)}</span>
              {/if}

            </span>
          </li>
          {id}
        {/each}
      </ul>
    </div>

    <button on:click={fetchLogs} class="border-px rounded-sm bg-gray-200 px-3">Load more</button>
  </div>
</section>
