<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { page } from '$app/state';
import { httpStatusCodes } from '#lib/helpers/httpStatusCodes.js';

import Aside from '#lib/ui/Aside.svelte';


// properties
// ------------------------------------------------------------------------
let {
  // the request, or null when there is no such request, from +page.js (object)
  data
} = $props();
// the request log entry (object) or null
let request = $derived(data.request);

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
    {#if request}
      <span class="log-detail-method">{request.http_request_method}</span> {request.http_request_path}
    {:else}
      No such request
    {/if}
  {/snippet}


  {#if request}
    <dl class="definitions">

      <dt>Time</dt> <dd>{new Date(request._timestamp / 1000).toLocaleString()}</dd>

      <dt>Request path</dt> <dd><a href={request.http_request_url}>{request.http_request_path}</a></dd>

      <dt>Request method</dt> <dd>{request.http_request_method}</dd>

      <dt>Status</dt> <dd class:success={request.lb_status_code >= 200 && request.lb_status_code < 300} class:error={request.lb_status_code >= 400 && request.lb_status_code < 600}>{request.lb_status_code} {httpStatusCodes[request.lb_status_code]}</dd>

      <dt>Client IP</dt> <dd>{request.client}</dd>

      <dt>Client user agent</dt> <dd>{request.user_agent}</dd>

      <dt>Processing time</dt> <dd>{parseFloat(request.request_processing_time) + parseFloat(request.target_processing_time)}s</dd>

      <dt>Response size</dt> <dd>{parseInt(request.sent_bytes)} bytes</dd>

    </dl>
  {/if}

</Aside>
