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
    <h2>Message:</h2>
    {#if messageIsJSON}
      <JSONTree value={JSON.parse(messageIsJSON)} showFullLines={true} />
    {:else}
      {item.message.replaceAll('\\n', '').replaceAll('\\t', '')}
    {/if}
  {/if}

</Aside>
