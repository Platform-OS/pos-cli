<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { page } from '$app/stores';
import { network } from '$lib/api/network';
import { state } from '$lib/state.js';
import { httpStatusCodes } from '$lib/helpers/httpStatusCodes.js';

import Aside from '$lib/ui/Aside.svelte';



// purpose:   loads log detail from api or from cached logs if available
// effect:    updated $state.network
// ------------------------------------------------------------------------
const load = async () => {

  // try to find the viewed log details in all the logs we have currently loaded on page
  const logFoundInCached = $state.networks.hits?.find(log => log._timestamp == $page.params.id);

  if(logFoundInCached){
    $state.network = logFoundInCached;
  }
  // make the api request only for log that is not currenly loaded on page
  else {
    const filters = {
      size: 1,
      sql: `select * from requests where _timestamp = ${$page.params.id}`
    };

    await network.get(filters).then(response => {
      $state.network = response.hits[0];
    });
  }
};

$: $page.params.id && load();

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

</style>



<!-- ================================================================== -->
<Aside title={$state.network.lb_status_code ? `<span class="log-detail-method">${$state.network.http_request_method}</span> ${$state.network.http_request_path}` : 'Loading…'} closeUrl="/network?{$page.url.searchParams.toString()}">

  {#if $state.network._timestamp}
    <dl class="definitions">

      <dt>Time</dt> <dd>{new Date($state.network._timestamp / 1000).toLocaleString()}</dd>

      <dt>Request path</dt> <dd><a href={$state.network.http_request_url}>{$state.network.http_request_path}</a></dd>

      <dt>Request method</dt> <dd>{$state.network.http_request_method}</dd>

      <dt>Request protocol</dt> <dd>{$state.network.http_request_protocol}</dd>

      <dt>Status</dt> <dd class:success={$state.network.lb_status_code >= 200 && $state.network.lb_status_code < 300} class:error={$state.network.http_request_protocol.lb_status_code >= 400 && $state.network.http_request_protocol.lb_status_code < 600}>{$state.network.lb_status_code} {httpStatusCodes[$state.network.lb_status_code]}</dd>

      <dt>Client IP</dt> <dd>{$state.network.client}</dd>

      <dt>Client user agent</dt> <dd>{$state.network.user_agent}</dd>

      <dt>Execution duration</dt> <dd>{parseFloat($state.network.request_processing_time) + parseFloat($state.network.target_processing_time)}s</dd>

      <dt>Response size</dt> <dd>{parseInt($state.network.sent_bytes)} bytes</dd>

    </dl>
  {/if}

</Aside>
