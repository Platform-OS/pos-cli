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
  // id of the running background job (string)
  id,
  // called once the job was asked to stop (function)
  onsuccess
} = $props();
// the form with the job id (dom node)
let form = $state();
// the stop was asked for: the job stops within about a second, and leaves
// the list of running jobs within a few seconds more (bool)
let requested = $state(false);

const stop = async (event) => {

  event.preventDefault();

  if(confirm('Are you sure you want to stop this background job?')){

    const stop = await backgroundJob.stop({ properties: new FormData(form) });

    if(!stop.errors){
      requested = true;
      notificationsState.create('success', `Background job ${stop.admin_background_job_stop.id} is stopping`);
      // the list of running jobs is refreshed by the workers every few seconds
      setTimeout(() => onsuccess?.(), 5000);
    } else {
      notificationsState.create('error', `Background job ${id} could not be stopped: ${stop.errors[0]?.message ?? ''}`);
      onsuccess?.();
    }

  }

};

</script>


<!-- ================================================================== -->
<style>

button {
  color: var(--color-danger);
}

</style>



<!-- ================================================================== -->
<form bind:this={form} onsubmit={stop}>
  <input type="hidden" name="id" value={id}>
  <button class="button compact" title={requested ? 'Stopping…' : 'Stop background job'} disabled={requested}>
    <span class="label">{requested ? 'Stopping…' : 'Stop background job'}</span>
    <Icon icon="disable" size="16" />
  </button>
</form>
