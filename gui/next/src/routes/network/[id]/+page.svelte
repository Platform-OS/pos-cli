<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { page } from '$app/stores';
import { network } from '$lib/api/network';
import { state } from '$lib/state.js';

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

dl {
  margin-block-start: 1rem;
  display: grid;
  grid-template-columns: auto auto;
  gap: .5em;
  column-gap: .5em;
}

  dd {
    text-align: end;
  }

a:hover {
  color: var(--color-interaction-hover);
}

</style>



<!-- ================================================================== -->
<Aside title={$state.network.lb_status_code ? `${$state.network.http_request_method} ${$state.network.http_request_path}` : 'Loading…'} closeUrl="/network?{$page.url.searchParams.toString()}">

  <dl>
    <dt>Time:</dt> <dd>{new Date($state.network._timestamp / 1000).toLocaleString()}</dd>
    <dt>Request path:</dt> <dd><a href="{$state.network.http_request_url}">{$state.network.http_request_path}</a></dd>
    <dt>Request method:</dt> <dd>{$state.network.http_request_method}</dd>
    <dt>Request protocol:</dt> <dd>{$state.network.http_request_protocol}</dd>
    <dt>Status:</dt> <dd>{$state.network.lb_status_code}</dd>
    <dt>Client IP:</dt> <dd>{$state.network.client}</dd>
    <dt>Client user agent:</dt> <dd>{$state.network.user_agent}</dd>
  </dl>

</Aside>
