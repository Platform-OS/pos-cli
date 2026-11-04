<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { page } from '$app/state';
import { tryParseJSON } from '#lib/tryParseJSON.js';

import Aside from '#lib/ui/Aside.svelte';
import JSONTree from '#lib/ui/JSONTree.svelte';
import Copy from '#lib/ui/Copy.svelte';


// properties
// ------------------------------------------------------------------------
let {
  // the log, or null when there is no such log, from +page.js (object)
  data
} = $props();
// the log entry (object) or null
let log = $derived(data.log);
// the url the log was written for (URL object) or null
let url = $derived(log?.options_data_url ? URL.parse('https://' + log.options_data_url) : null);

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



<Aside title={log?.type ?? 'No such log'} closeUrl="/logsv2?{page.url.searchParams.toString()}">

  {#if log}

    <dl>
      <dt>Time:</dt> <dd>{new Date(log.options_at / 1000).toLocaleString()}</dd>
      {#if url}
        <dt>URL:</dt> <dd><a href={url.href}>{url.pathname + url.search}</a></dd>
      {/if}
      {#if log.message}
        <dt>Message:</dt> <dd><Copy text={log.message} /></dd>
      {/if}
    </dl>

    {#if log.message}
      {@const message = tryParseJSON(log.message)}
      <div class="code" class:json={message}>
        {#if message}
          <JSONTree value={message} showFullLines={true} />
        {:else}
          {log.message}
        {/if}
      </div>
    {/if}

  {:else}

    There is no such log

  {/if}

</Aside>
