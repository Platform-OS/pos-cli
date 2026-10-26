<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { untrack } from 'svelte';
import { page } from '$app/state';
import { logs } from '#lib/api/logsv2.js';
import { logsState } from '#lib/state/logs.svelte.js';
import { tryParseJSON } from '#lib/tryParseJSON.js';

import Aside from '#lib/ui/Aside.svelte';
import JSONTree from '#lib/ui/JSONTree.svelte';
import Copy from '#lib/ui/Copy.svelte';



// purpose:   loads log detail from api or from cached logs if available
// effect:    updated logsState.logv2
// ------------------------------------------------------------------------
const load = async () => {

  // try to find the viewed log details in all the logs we have currently loaded on page
  const logFoundInCached = logsState.logsv2.hits?.find(log => log._timestamp == page.params.id);

  if(logFoundInCached){
    logsState.logv2 = logFoundInCached;
  }
  // make the api request only for log that is not currenly loaded on page
  else {
    const filters = {
      size: 1,
      sql: `select * from logs where _timestamp = ${page.params.id}`
    };

    await logs.get(filters).then(response => {
      logsState.logv2 = response.hits[0];
    });
  }

};

// load again whenever the route id changes, but not when the data load() reads changes
$effect(() => {
  const id = page.params.id;
  untrack(() => id && load());
});

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

a:hover {
  color: var(--color-interaction-hover);
}

.code {
  margin-block-start: .2rem;
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

<Aside title={logsState.logv2?.type ?? 'Loading…'} closeUrl="/logsv2?{page.url.searchParams.toString()}">

  <dl>
    <dt>Time:</dt> <dd>{new Date(logsState.logv2?.options_at / 1000).toLocaleString()}</dd>
    <dt>URL:</dt> <dd><a href="https://{logsState.logv2?.options_data_url}">{new URL('https://' + logsState.logv2?.options_data_url).pathname + new URL('https://' + logsState.logv2?.options_data_url).search}</a></dd>
    {#if logsState.logv2.message}
      <dt>Message:</dt> <dd><Copy text={logsState.logv2.message} /></dd>
    {/if}
  </dl>

  {#if logsState.logv2.message}
    {@const message = tryParseJSON(logsState.logv2.message)}
    <div class="code" class:json={message}>
      {#if message}
        <JSONTree value={message} showFullLines={true} />
      {:else}
        {logsState.logv2.message}
      {/if}
    </div>
  {/if}

</Aside>
