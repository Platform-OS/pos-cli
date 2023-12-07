<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { page } from '$app/stores';
import { logs } from '$lib/api/logsv2';
import { tryParseJSON } from '$lib/tryParseJSON.js';

import Aside from '$lib/ui/Aside.svelte';
import JSONTree from '$lib/ui/JSONTree.svelte';
import Copy from '$lib/ui/Copy.svelte';


// properties
// ------------------------------------------------------------------------
// log details (object)
let item = {};
// message parsed to JSON if available (string or object)
$: message = item && tryParseJSON(item.message);

const load = async () => {
  const filters = {
    size: 1,
    sql: `select * from logs where _timestamp = ${$page.params.id}`
  };

  await logs.get(filters).then(response => {
    item = response.hits[0];
  });
}

$: $page.params.id && load();

</script>


<!-- ================================================================== -->
<style>

dl {
  margin-block-start: 1rem;
  display: grid;
  grid-template-columns: min-content auto;
  gap: .5em;
  column-gap: .5em;
}

  dd {
    text-align: end;
  }

h2 {
  margin-block: .5em;
  display: flex;
  justify-content: space-between;
}

a:hover {
  color: var(--color-interaction-hover);
}

.code {
  padding: .6em .8em .6em .8em;

  border-radius: 0 1rem 1rem;
  background-color: var(--color-background);

  word-wrap: break-word;
}

  .json {
    padding-inline-start: 2rem;
  }

</style>



<!-- ================================================================== -->
<svelte:head>
  <script src="/prism.js" data-manual></script>
</svelte:head>

<Aside title={item?.type ?? 'Loading…'} closeUrl="/logsv2?{$page.url.searchParams.toString()}">

  <dl>
    <dt>Time:</dt> <dd>{new Date(item?.options_at / 1000).toLocaleString()}</dd>
    <dt>Host:</dt> <dd><a href="{item?.options_data_url}">{item?.options_data_url}</a></dd>
  </dl>

  {#if item?.message}
    <h2>
      Message:
      <Copy text={item.message} />
    </h2>
    <div class="code" class:json={message}>
      {#if message}
        <JSONTree value={message} showFullLines={true} />
      {:else}
        {item.message}
      {/if}
    </div>
  {/if}

</Aside>
