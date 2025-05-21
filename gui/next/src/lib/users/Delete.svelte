<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { createEventDispatcher } from 'svelte';
import { user } from '$lib/api/user';
import { state } from '$lib/state';

import Icon from '$lib/ui/Icon.svelte';


export let id;

let form;
let dispatch = createEventDispatcher();

const deleteUser = async (event) => {
  event.preventDefault();
  if(confirm('Are you sure you want to delete this user?')){
    dispatch('close');

    const formData = new FormData(form);
    const id = formData.get('id')
    const remove = await user.delete(id);

    if(!remove.errors){
      state.notification.create('success', `Record ${id} deleted`);
      dispatch('success');
    } else {
      state.notification.create('error', `Record ${id} could not be deleted`);
    }
  }
}

</script>


<!-- ================================================================== -->
<style>

i {
  color: var(--color-danger);
}

</style>



<!-- ================================================================== -->
<form bind:this={form} on:submit={deleteUser}>
  <input type="hidden" name="id" value={id}>
  <button class="danger">
    <i>
      <Icon icon="x" size="22" />
    </i>
    Delete user
  </button>
</form>
