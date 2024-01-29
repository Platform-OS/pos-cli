<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { page } from '$app/stores';
import { network } from '$lib/api/network';
import { tryParseJSON } from '$lib/tryParseJSON.js';

import Aside from '$lib/ui/Aside.svelte';


// properties
// ------------------------------------------------------------------------
// log details (object)
let item = {};
// message parsed to JSON if available (string or object)
$: message = item && tryParseJSON(item.message);

const load = async () => {
  const filters = {
    size: 1,
    sql: `select * from requests where _timestamp = ${$page.params.id}`
  };

  await network.get(filters).then(response => {
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
<Aside title={item?.lb_status_code ? `${item?.http_request_method} ${item?.http_request_path}` : 'Loading…'} closeUrl="/network?{$page.url.searchParams.toString()}">

  <dl>
    <dt>Time:</dt> <dd>{new Date(item?._timestamp / 1000).toLocaleString()}</dd>
    <dt>Request path:</dt> <dd><a href="{item?.http_request_url}">{item?.http_request_path}</a></dd>
    <dt>Request method:</dt> <dd>{item?.http_request_method}</dd>
    <dt>Request protocol:</dt> <dd>{item?.http_request_protocol}</dd>
    <dt>Status:</dt> <dd>{item?.lb_status_code}</dd>
    <dt>Client IP:</dt> <dd>{item?.client}</dd>
    <dt>Client user agent:</dt> <dd>{item?.user_agent}</dd>
  </dl>

</Aside>
