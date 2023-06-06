<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { onMount, onDestroy } from 'svelte';
import { page } from '$app/stores';
import { state } from '$lib/state';
import { record } from '$lib/api/record';

import Icon from '$lib/ui/Icon.svelte';
import Filters from '$lib/database/Filters.svelte';
import Table from '$lib/database/Table.svelte';
import RecordCreate from '$lib/database/Create.svelte';


// properties
// ------------------------------------------------------------------------
// if the current view is being refreshed currently (bool)
let refreshing = false;



// purpose:		set current table in the state after entering the page
// ------------------------------------------------------------------------
$: $state.table = $state.tables.filter(table => table.id === $page.params.id)[0];

// purpose:		reload the records each time the table id changes
// ------------------------------------------------------------------------
$: $page.params.id && record.get({ table: $page.params.id }) && state.clearFilters();

// purpose:		clear filters each time the table id changes
// ------------------------------------------------------------------------
$: $page.params.id && state.clearFilters();


// purpose:		refresh current data without reloading the whole page
// returns:		updates the store with freshly downloaded records for current view
// ------------------------------------------------------------------------
const refresh = () => {
  refreshing = true;
  record.get({ table: $page.params.id, filters: $state.filters }).then(() => refreshing = false);
};


// purpose:		global shortcuts
// ------------------------------------------------------------------------
const keyboardShortcuts = event => {
  if(document.activeElement === document.body){
    // R for refresh
    if(!event.target.matches('input, textarea') && event.key === 'r'){
      refresh();
    }
  }
};

</script>


<!-- ================================================================== -->
<style>

section {
  height: calc(100vh - 82px);
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  overflow: auto;
  position: relative;
}

nav {
  padding: 1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  left: 0;

  background-color: var(--color-background);
}

  .refreshing,
  .refreshing:hover {
    background-color: var(--color-interaction-active);

    color: var(--color-text-inverted) !important;
  }

  .refreshing :global(svg) {
    color: var(--color-text-inverted) !important;
  }

.pagination {
  margin-block-start: auto;
  display: flex;
  align-items: center;
  gap: 1rem;
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 20;
}

#viewOptions {
  margin-inline-start: auto;
  display: flex;
  gap: 1rem;
}

</style>



<!-- ================================================================== -->
<svelte:head>
  <title>{$state.table?.name || 'Loading…'} | platformOS</title>
</svelte:head>

<svelte:window on:keypress={keyboardShortcuts} />

<section>

  <nav>

    <Filters />

    <button class="button" title="Refresh current view (R)" class:refreshing on:click={refresh}>
      <span class="label">Refresh current view</span>
      <Icon icon="refresh" />
    </button>

  </nav>

  {#if $state.view.database !== 'tiles'}
    <Table />
  {:else}
    Work in progress :)
  {/if}

  <nav class="pagination">
    Page:
    <input
      type="number"
      name="page"
      min="1"
      max={$state.records?.total_pages || 100}
      step="1"
      bind:value={$state.filters.page}
      on:input={() => { record.get({ table: $page.params.id, filters: $state.filters }); } }
    >
    of {$state.records?.total_pages || ''}

    <div id="viewOptions">

      <button class="button" title="Create new record" on:click|preventDefault={ () => $state.record = {} }>
        <Icon icon="plus" />
        <span class="label">Create new record</span>
      </button>

      {#if $state.view.database !== 'tiles'}
        <button
          class="button"
          title={$state.view.tableStyle === 'expanded' ? 'Collapse values' : 'Expand values'}
          on:click|preventDefault={$state.view.tableStyle === 'collapsed' ? state.setView({ tableStyle: 'expanded' }) : state.setView({ tableStyle: 'collapsed' })}
        >
          {#if $state.view.tableStyle === 'collapsed'}
            <Icon icon="expand" />
          {:else}
            <Icon icon="collapse" />
          {/if}

        </button>
      {/if}

      <div class="combo">

        <button
          class="button"
          class:active={$state.view.database === 'table'}
          title="Table view"
          on:click={() => $state.view.database = 'table'}
          disabled={$state.view.database === 'table'}
        >
          <Icon icon="list" />
          <span class="label">Table view</span>
        </button>

        <button
          class="button"
          class:active={$state.view.database === 'tiles'}
          title="Tiles view"
          on:click={() => $state.view.database = 'tiles'}
          disabled={$state.view.database === 'tiles'}
        >
          <Icon icon="tiles" />
          <span class="label">Tiles view</span>
        </button>

      </div>

    </div>
  </nav>

</section>

{#if $state.record !== null}
  <RecordCreate properties={$state.table.properties} editing={$state.record} />
{/if}
