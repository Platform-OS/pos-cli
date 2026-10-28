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
  // id of the deleted record to restore (string)
  id,
  // called when the restoring starts (function)
  onsuccess
} = $props();
// the form with the record's identifiers (dom node)
let form = $state();


// purpose:   restores a deleted record
// arguments: submit event (object)
// ------------------------------------------------------------------------
const restore = async (event) => {

  event.preventDefault();

  onsuccess?.();

  const restore = await record.restore({ table: table.name, properties: new FormData(form) });

  if(!restore.errors){
    invalidate('app:records');
    notificationsState.create('success', `Record ${restore.record_update.id} restored`);
  } else {
    // there is no record_update in a failed answer, so the id is the one that was asked for
    notificationsState.create('error', `Record ${id} could not be restored`);
  }

}

</script>



<!-- ================================================================== -->
<form bind:this={form} onsubmit={restore}>
  <input type="hidden" name="tableName" value={table.name}>
  <input type="hidden" name="recordId" value={id}>
  <button>
    <i>
      <Icon icon="recycleRefresh" />
    </i>
    Restore record
  </button>
</form>
