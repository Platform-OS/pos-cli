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
  // called once the job was deleted (function)
  onsuccess
} = $props();
// the form with the job id (dom node)
let form = $state();

const remove = async (event) => {

  event.preventDefault();

  if(confirm('Are you sure you want to delete this background job?')){

    const remove = await backgroundJob.delete({ properties: new FormData(form) });

    if(!remove.errors){
      onsuccess?.();
      notificationsState.create('success', `Background job ${remove.admin_background_job_delete.id} deleted`);
    } else {
      notificationsState.create('error', `Background job ${id} could not be deleted`);
    }

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
<form bind:this={form} onsubmit={remove}>
  <input type="hidden" name="id" value={id}>
  <button class="danger">
    <i>
      <Icon icon="x" size="22" />
    </i>
    Delete background job
  </button>
</form>
