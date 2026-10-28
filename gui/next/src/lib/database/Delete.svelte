<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { invalidate } from '$app/navigation';
import { record } from '#lib/api/record';
import { notificationsState } from '#lib/state/notifications.svelte.js';

import Icon from '#lib/ui/Icon.svelte';


// properties
// ------------------------------------------------------------------------
let {
  // table the record belongs to (object)
  table,
  // id of the record to delete (string)
  id,
  // called once the deletion is confirmed, before it is sent (function)
  onsuccess
} = $props();
// the form with the record's identifiers (dom node)
let form = $state();


// purpose:   deletes the record after asking for confirmation
// arguments: submit event (object)
// ------------------------------------------------------------------------
const remove = async (event) => {

  event.preventDefault();


  if(confirm('Are you sure you want to delete this record?')){

    onsuccess?.();

    const remove = await record.delete({ table: table.name, properties: new FormData(form) });

    if(!remove.errors){
      invalidate('app:records');
      notificationsState.create('success', `Record ${remove.record_delete.id} deleted`);
    } else {
      // there is no record_delete in a failed answer, so the id is the one that was asked for
      notificationsState.create('error', `Record ${id} could not be deleted`);
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
<form bind:this={form} onsubmit={remove}>
  <input type="hidden" name="tableName" value={table.name}>
  <input type="hidden" name="recordId" value={id}>
  <button class="danger">
    <i>
      <Icon icon="x" size="22" />
    </i>
    Delete record
  </button>
</form>
