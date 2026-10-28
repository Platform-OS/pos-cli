<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { user } from '#lib/api/user';
import { notificationsState } from '#lib/state/notifications.svelte.js';

import Icon from '#lib/ui/Icon.svelte';


// properties
// ------------------------------------------------------------------------
let {
  // id of the user to delete (string)
  id,
  // called once the user is deleted (function)
  onsuccess,
  // called once the deletion is confirmed, to close the menu (function)
  onclose
} = $props();
// the form with the user's id (dom node)
let form = $state();


// purpose:   deletes the user after asking for confirmation
// arguments: submit event (object)
// ------------------------------------------------------------------------
const deleteUser = async (event) => {
  event.preventDefault();
  if(confirm('Are you sure you want to delete this user?')){
    onclose?.();

    const formData = new FormData(form);
    const id = formData.get('id')
    const remove = await user.delete(id);

    if(!remove.errors){
      notificationsState.create('success', `User ${id} deleted`);
      onsuccess?.();
    } else {
      notificationsState.create('error', `User ${id} could not be deleted`);
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
<form bind:this={form} onsubmit={deleteUser}>
  <input type="hidden" name="id" value={id}>
  <button class="danger">
    <i>
      <Icon icon="x" size="22" />
    </i>
    Delete user
  </button>
</form>
