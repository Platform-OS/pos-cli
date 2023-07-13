<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { createEventDispatcher } from 'svelte';
import { state } from '$lib/state.js';
import { backgroundJob } from '$lib/api/backgroundJob';

import Icon from '$lib/ui/Icon.svelte';


export let id;

let form;

const dispatch = createEventDispatcher();

const remove = async (event) => {

  event.preventDefault();

  if(confirm('Are you sure you want to delete this background job?')){

    const remove = await backgroundJob.delete({ properties: new FormData(form) });

    if(!remove.errors){
      dispatch('itemsChanged');
      state.notification.create('success', `Background job ${remove.admin_background_job_delete.id} deleted`);
    } else {
      state.notification.create('error', `Background job ${remove.admin_background_job_delete.id} could not be deleted`);
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
<form bind:this={form} on:submit={remove}>
  <input type="hidden" name="id" value={id}>
  <button class="danger">
    <i>
      <Icon icon="x" size="22" />
    </i>
    Delete background job
  </button>
</form>
