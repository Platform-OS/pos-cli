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

  if(confirm('Are you sure you want to delete this record?')){

    const remove = await record.delete({ table: table.name, properties: new FormData(form) });

    if(!remove.errors){
      record.get({ table: $page.params.id, filters: $state.filters, sort: $state.sort });
      state.notification.create('success', `Record ${remove.record_delete.id} deleted`);
    } else {
      state.notification.create('error', `Record ${remove.record_delete.id} could not be deleted`);
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
<form bind:this={form} on:submit={remove}>
  <input type="hidden" name="tableName" value={table.name}>
  <input type="hidden" name="recordId" value={id}>
  <button class="danger">
    <i>
      <Icon icon="x" size="22" />
    </i>
    Delete record
  </button>
</form>
