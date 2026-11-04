<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { notificationsState } from '#lib/state/notifications.svelte.js';
import { backgroundJob } from '#lib/api/backgroundJob';

import Icon from '#lib/ui/Icon.svelte';


// properties
// ------------------------------------------------------------------------
let {
  // id of the background job (string)
  id,
  // called once the job was planned to run again (function)
  onsuccess
} = $props();
// the form with the job id (dom node)
let form = $state();

const retry = async (event) => {

  event.preventDefault();

  const retry = await backgroundJob.retry({ properties: new FormData(form) });

  if(!retry.errors){
    onsuccess?.();
    notificationsState.create('success', `Background job ${retry.admin_background_job_retry.id} planned to run again`);
  } else {
    notificationsState.create('error', `Background job ${id} could not be run again`);
  }

};

</script>



<!-- ================================================================== -->
<form bind:this={form} onsubmit={retry}>
  <input type="hidden" name="id" value={id}>
  <button class="danger">
    <Icon icon="refresh" size="22" />
    Retry
  </button>
</form>
