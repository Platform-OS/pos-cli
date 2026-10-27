<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { untrack } from 'svelte';
import { page } from '$app/state';
import { network } from '#lib/api/network';
import { networkState } from '#lib/state/network.svelte.js';
import { httpStatusCodes } from '#lib/helpers/httpStatusCodes.js';

import Aside from '#lib/ui/Aside.svelte';



// purpose:   loads log detail from api or from cached logs if available
// effect:    updated networkState.network
// ------------------------------------------------------------------------
const load = async () => {

  // try to find the viewed log details in all the logs we have currently loaded on page
  const logFoundInCached = networkState.networks.hits?.find(log => log._timestamp == page.params.id);

  if(logFoundInCached){
    networkState.network = logFoundInCached;
  }
  // make the api request only for log that is not currenly loaded on page
  else {
    await network.getOne(page.params.id).then(response => {
      networkState.network = response.hits[0];
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

:global(.log-detail-method) {
  margin-inline-end: .2em;
  padding: .1em .2em;
  display: inline-block;
  position: relative;
  top: -1px;

  border-radius: .2rem;
  border: 1px solid var(--color-frame);

  font-family: monospace;
  font-size: .75em;
}

.success {
  color: var(--color-confirmation);
}

.error {
  color: var(--color-danger);
}

a:hover {
  color: var(--color-interaction-hover);
}

dl {
  margin-block-start: var(--space-page);
}

dd {
  text-align: end;
}

</style>



<!-- ================================================================== -->
<Aside closeUrl="/network?{page.url.searchParams.toString()}">

  <!-- the method and path come from requests anyone can send to the instance, so they are text, never markup -->
  {#snippet title()}
    {#if networkState.network.lb_status_code}
      <span class="log-detail-method">{networkState.network.http_request_method}</span> {networkState.network.http_request_path}
    {:else}
      Loading…
    {/if}
  {/snippet}


  {#if networkState.network._timestamp}
    <dl class="definitions">

      <dt>Time</dt> <dd>{new Date(networkState.network._timestamp / 1000).toLocaleString()}</dd>

      <dt>Request path</dt> <dd><a href={networkState.network.http_request_url}>{networkState.network.http_request_path}</a></dd>

      <dt>Request method</dt> <dd>{networkState.network.http_request_method}</dd>

      <dt>Status</dt> <dd class:success={networkState.network.lb_status_code >= 200 && networkState.network.lb_status_code < 300} class:error={networkState.network.http_request_protocol.lb_status_code >= 400 && networkState.network.http_request_protocol.lb_status_code < 600}>{networkState.network.lb_status_code} {httpStatusCodes[networkState.network.lb_status_code]}</dd>

      <dt>Client IP</dt> <dd>{networkState.network.client}</dd>

      <dt>Client user agent</dt> <dd>{networkState.network.user_agent}</dd>

      <dt>Processing time</dt> <dd>{parseFloat(networkState.network.request_processing_time) + parseFloat(networkState.network.target_processing_time)}s</dd>

      <dt>Response size</dt> <dd>{parseInt(networkState.network.sent_bytes)} bytes</dd>

    </dl>
  {/if}

</Aside>
