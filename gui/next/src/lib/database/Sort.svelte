<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { databaseState } from '#lib/state/database.svelte.js';

import Icon from '#lib/ui/Icon.svelte';


// properties
// ------------------------------------------------------------------------
let {
  // sorting the records are shown with, from the url (object)
  sort,
  // called with the sorting to apply, { by, order } (function)
  onsort
} = $props();
// main sorting form (dom node)
let form;


// purpose:		parses the <form> and applies it as the sorting
// arguments:	submit event (object)
// ------------------------------------------------------------------------
const filter = (event) => {
  event.preventDefault();

  onsort(Object.fromEntries((new FormData(form)).entries()));
}

</script>


<!-- ================================================================== -->
<style>

form {
  display: flex;
  gap: 2px;
  position: relative;
}

select[name="by"] {
  max-width: 14ch;

  border-start-end-radius: 0;
  border-end-end-radius: 0;

  white-space: nowrap;
  text-overflow: ellipsis;
}

select[name="order"] {
  width: 50px;
  position: absolute;
  inset-inline-end: 0;
  opacity: 0;
  cursor: pointer;
  z-index: 1;

  overflow: hidden;
  white-space: nowrap;
}

label {
  position: relative;

  border-start-start-radius: 0;
  border-end-start-radius: 0;
}

select:hover + label {
  background-color: rgba(var(--color-rgb-interaction-hover), .2);
}

select:focus-visible + label {
  box-shadow: 0 0 1px 2px var(--color-interaction-hover);
}

</style>



<!-- ================================================================== -->
<form bind:this={form} onsubmit={filter}>

  {#if databaseState.table?.properties}

    <select name="by" id="sort_by" value={sort.by} onchange={() => form.requestSubmit()}>
      <option value="created_at">created at</option>
      <option value="updated_at">updated at</option>
      <option value="id">id</option>
      {#each databaseState.table.properties as property (property.name)}
        <option value={property.name}>
          {property.name}
        </option>
      {/each}
    </select>

    <select name="order" id="sort_order" value={sort.order} onchange={() => form.requestSubmit()}>
      <option value="DESC">DESC [Z→A]</option>
      <option value="ASC">ASC [A→Z]</option>
    </select>

    <label for="sort_order" class="button">
      {#if sort.order === 'DESC'}
        <Icon icon="sortZA" />
      {:else}
        <Icon icon="sortAZ" />
      {/if}
    </label>

  {/if}

</form>
