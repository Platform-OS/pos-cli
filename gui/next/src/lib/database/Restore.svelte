<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { page } from '$app/stores';
import { record } from '$lib/api/record';
import { state } from '$lib/state';

import Icon from '$lib/ui/Icon.svelte';


export let table;
export let id;

let form;

const remove = async (event) => {

  event.preventDefault();

  const restore = await record.restore({ table: table.name, properties: new FormData(form) });

  if(!restore.errors){
    record.get({ table: $page.params.id, filters: $state.filters, sort: $state.sort, deleted: $state.filters.deleted });
    state.notification.create('success', `Record ${restore.record_update.id} restored`);
  } else {
    state.notification.create('error', `Record ${restore.record_update.id} could not be restored`);
  }

}

</script>



<!-- ================================================================== -->
<form bind:this={form} on:submit={remove}>
  <input type="hidden" name="tableName" value={table.name}>
  <input type="hidden" name="recordId" value={id}>
  <button>
    <i>
      <Icon icon="recycleRefresh" />
    </i>
    Restore record
  </button>
</form>
