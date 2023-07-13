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

const retry = async (event) => {

  event.preventDefault();

  const retry = await backgroundJob.retry({ properties: new FormData(form) });

  if(!retry.errors){
    dispatch('itemsChanged');
    state.notification.create('success', `Background job ${retry.admin_background_job_retry.id} planned to run again`);
  } else {
    state.notification.create('error', `Background job ${retry.admin_background_job_retry.id} could not be run again`);
  }

};

</script>



<!-- ================================================================== -->
<form bind:this={form} on:submit={retry}>
  <input type="hidden" name="id" value={id}>
  <button class="danger">
    <Icon icon="refresh" size="22" />
    Retry
  </button>
</form>
