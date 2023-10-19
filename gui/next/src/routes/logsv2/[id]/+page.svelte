<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { page } from '$app/stores';
import { state } from '$lib/state';
import { tryParseJSON } from '$lib/tryParseJSON.js';

import Aside from '$lib/ui/Aside.svelte';
import Code from '$lib/ui/Code.svelte';
import JSONTree from '$lib/ui/JSONTree.svelte';
import Icon from '$lib/ui/Icon.svelte';

let log;

$: item = $state.logv2;

let messageIsJSON;

$: try {
  messageIsJSON = JSON.parse(item.message.replaceAll('\\n', '').replaceAll('\\t', ''));
} catch(e) {
  messageIsJSON = false;
}

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

button {
  display: flex;
  align-items: center;
  gap: .2em;
}

  button :global(svg) {
    position: relative;
    top: .05em;
  }

  button:hover {
    color: var(--color-interaction-hover);
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
      <button on:click={navigator.clipboard.writeText(item.message)}>
        <Icon icon="copy" size="16" />
        Copy
      </button>
    </h2>
    <div class="code" class:json={messageIsJSON}>
      {#if messageIsJSON}
        <JSONTree value={JSON.parse(messageIsJSON)} showFullLines={true} />
      {:else}
        {item.message.replaceAll('\\n', '').replaceAll('\\t', '')}
      {/if}
    </div>
  {/if}

</Aside>
