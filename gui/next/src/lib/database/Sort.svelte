<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { state } from '$lib/state.js';
import { record } from '$lib/api/record.js';

import Icon from '$lib/ui/Icon.svelte';


// properties
// ------------------------------------------------------------------------
// main sorting form (dom node)
let form;


// purpose:		parses the <form>, saves new sorting to filters in the store and triggers records reload
// ------------------------------------------------------------------------
const filter = () => {
  $state.filters.page = 1;

  record.get({ table: $state.table.id, filters: $state.filters, sort: Object.fromEntries((new FormData(form)).entries()), deleted: $state.filters.deleted });
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
<form bind:this={form} on:submit|preventDefault={filter}>

  {#if $state.table?.properties}

    <select name="by" id="sort_by" bind:value={$state.sort.by} on:change={() => form.requestSubmit()}>
      <option value="created_at">created at</option>
      <option value="updated_at">updated at</option>
      <option value="id">id</option>
      {#each $state.table.properties as property}
        <option value={property.name}>
          {property.name}
        </option>
      {/each}
    </select>

    <select name="order" id="sort_order" bind:value={$state.sort.order} on:change={() => form.requestSubmit()}>
      <option value="DESC">DESC [Z→A]</option>
      <option value="ASC">ASC [A→Z]</option>
    </select>

    <label for="sort_order" class="button">
      {#if $state.sort.order === 'DESC'}
        <Icon icon="sortZA" />
      {:else}
        <Icon icon="sortAZ" />
      {/if}
    </label>

  {/if}

</form>
