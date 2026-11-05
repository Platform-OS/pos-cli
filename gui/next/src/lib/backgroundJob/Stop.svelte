<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { onDestroy } from 'svelte';
import { notificationsState } from '#lib/state/notifications.svelte.js';
import { backgroundJob } from '#lib/api/backgroundJob';

import Icon from '#lib/ui/Icon.svelte';


// properties
// ------------------------------------------------------------------------
let {
  // id of the running background job (string)
  id,
  // called when the list of jobs should be read again (function)
  onsuccess,
  // the stop was asked for and the job is still on the list, for the row to show it (bool)
  requested = $bindable(false)
} = $props();
// the form with the job id (dom node)
let form = $state();
// a stopped job stays on the list of running jobs until the workers next report what they run,
// which can take ten seconds or so, so the list is read again this often (ms) until the job has
// left it - which removes this button along with its row
const reloadEvery = 3000;
// a job still listed after this long (ms) did not stop, and can be asked to stop again
const reloadFor = 30000;
// the pending reloads (interval id)
let reloadTimer;

onDestroy(() => clearInterval(reloadTimer));


// purpose:		reads the list again and lets the job be stopped again if it is still there
// ------------------------------------------------------------------------
const reload = () => {
  clearInterval(reloadTimer);
  requested = false;
  onsuccess?.();
};


// purpose:		reads the list again every reloadEvery ms until the job has left it,
//				or until reloadFor ms have passed
// ------------------------------------------------------------------------
const reloadUntilGone = () => {
  const until = Date.now() + reloadFor;
  clearInterval(reloadTimer);
  reloadTimer = setInterval(() => {
    if(Date.now() >= until){
      reload();
    } else {
      onsuccess?.();
    }
  }, reloadEvery);
};


// purpose:		asks the job to stop
// ------------------------------------------------------------------------
const stop = async (event) => {

  event.preventDefault();

  if(!confirm('Are you sure you want to stop this background job?')){
    return;
  }

  requested = true;

  let response;
  try {
    response = await backgroundJob.stop({ properties: new FormData(form) });
  } catch(error) {
    notificationsState.create('error', `Background job ${id} could not be stopped: ${error.message}`);
    reload();
    return;
  }

  const stopped = response?.admin_background_job_stop;

  if(!response?.errors && stopped){
    notificationsState.create('success', `Background job ${stopped.id} is stopping`);
    reloadUntilGone();
  } else {
    // most often the job has finished in the meantime, which the reloaded list shows
    notificationsState.create('error', `Background job ${id} could not be stopped${response?.errors?.[0]?.message ? `: ${response.errors[0].message}` : ''}`);
    reload();
  }

};

</script>


<!-- ================================================================== -->
<style>

i {
  color: var(--color-danger);
}

</style>



<!-- ================================================================== -->
<form bind:this={form} onsubmit={stop}>
  <input type="hidden" name="id" value={id}>
  <button class="danger" disabled={requested}>
    <i>
      <Icon icon="disable" size="22" />
    </i>
    {requested ? 'Stopping…' : 'Stop background job'}
  </button>
</form>
