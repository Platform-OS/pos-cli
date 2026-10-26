<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { untrack } from 'svelte';
import { page } from '$app/state';
import { connectionState } from '#lib/state/connection.svelte.js';
import { databaseState } from '#lib/state/database.svelte.js';
import { preferencesState, setView } from '#lib/state/preferences.svelte.js';
import { record } from '#lib/api/record';

import Icon from '#lib/ui/Icon.svelte';
import Filters from '#lib/database/Filters.svelte';
import Sort from '#lib/database/Sort.svelte';
import Table from '#lib/database/Table.svelte';
import RecordCreate from '#lib/database/Create.svelte';
import Number from '#lib/ui/forms/Number.svelte';


// properties
// ------------------------------------------------------------------------
// if the current view is being refreshed currently (bool)
let refreshing = $state(false);



// purpose:		set current table in the state and reload the records each time the table id changes
//				(databaseState.table is derived from the id, so it also follows the tables loading later)
// ------------------------------------------------------------------------
$effect.pre(() => {
  const id = page.params.id;

  // only the id decides when this runs, not the state it reads and writes
  untrack(() => {
    databaseState.tableId = id;

    if(id){
      record.get({ table: id });
      databaseState.clearFilters();
    }
  });
});


// purpose:		refresh current data without reloading the whole page
// returns:		updates the store with freshly downloaded records for current view
// ------------------------------------------------------------------------
const refresh = () => {
  refreshing = true;
  record.get({ table: page.params.id, filters: databaseState.filters, sort: databaseState.sort, deleted: databaseState.filters.deleted }).then(() => refreshing = false);
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
  height: calc(100vh - 83px);
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
  position: sticky;
  left: 0;

  background-color: var(--color-background);
}

  nav > :global(*:first-child) {
    margin-inline-end: auto;
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
  z-index: 30;
}

#viewOptions {
  margin-inline-start: auto;
  display: flex;
  gap: 1rem;
}

.combo input {
  position: absolute;
  inset-inline-start: -100vw;
}

</style>



<!-- ================================================================== -->
<svelte:head>
  <title>{databaseState.table?.name || 'Loading…'}{connectionState.online?.MPKIT_URL ? ': ' + connectionState.online.MPKIT_URL.replace('https://', '') : ''}</title>
</svelte:head>

<svelte:window onkeypress={keyboardShortcuts} />

<section>

  <nav>

    <Filters />

    <Sort />

    <button class="button" title="Refresh current view (R)" class:refreshing onclick={refresh}>
      <span class="label">Refresh current view</span>
      <Icon icon="refresh" />
    </button>

  </nav>

  {#if preferencesState.view.database !== 'tiles'}
    <Table />
  {:else}
    Work in progress :)
  {/if}

  <nav class="pagination">
    <div>
      <label for="page">
        Page:
      </label>
      <Number
        name="page"
        bind:value={databaseState.filters.page}
        min={1}
        max={databaseState.records?.total_pages}
        step={1}
        decreaseLabel="Previous page"
        increaseLabel="Next page"
        style="navigation"
        on:input={() => { record.get({ table: page.params.id, filters: databaseState.filters, sort: databaseState.sort, deleted: databaseState.filters.deleted }); } }
      />
      of {databaseState.records?.total_pages || 1}
    </div>

    <div id="viewOptions">

      <button class="button" title="Create new record" onclick={event => { event.preventDefault(); databaseState.record = {}; }}>
        <Icon icon="plus" />
        <span class="label">Create new record</span>
      </button>

      {#if preferencesState.view.database !== 'tiles'}
        <button
          class="button"
          title={preferencesState.view.tableStyle === 'expanded' ? 'Collapse values' : 'Expand values'}
          onclick={event => { event.preventDefault(); setView({ tableStyle: preferencesState.view.tableStyle === 'collapsed' ? 'expanded' : 'collapsed' }); }}
        >
          {#if preferencesState.view.tableStyle === 'collapsed'}
            <span class="label">Expand values</span>
            <Icon icon="expand" />
          {:else}
            <span class="label">Collapse values</span>
            <Icon icon="collapse" />
          {/if}

        </button>
      {/if}

      <div class="combo">

        <input
          type="radio"
          name="deleted"
          id="deletedTrue"
          bind:group={databaseState.filters.deleted}
          value="false"
          disabled={databaseState.filters.deleted === 'false'}
          onchange={() => { record.get({ table: page.params.id, filters: databaseState.filters, sort: databaseState.sort, deleted: databaseState.filters.deleted }); } }
        >
        <label
          for="deletedTrue"
          class="button"
          class:active={databaseState.filters.deleted === 'false'}
          class:disabled={databaseState.filters.deleted === 'false'}
          title="Show{databaseState.filters.deleted === 'false' ? 'ing' : ''} current database state"
        >
          <Icon icon="leaf" />
          <span class="label">Show{databaseState.filters.deleted === 'false' ? 'ing' : ''} current database state</span>
        </label>

        <label
          for="deletedFalse"
          class="button"
          class:active={databaseState.filters.deleted === 'true'}
          class:disabled={databaseState.filters.deleted === 'true'}
          title="Show{databaseState.filters.deleted === 'true' ? 'ing' : ''} deleted records"
        >
          <Icon icon="recycle" />
          <span class="label">Show{databaseState.filters.deleted === 'true' ? 'ing' : ''} deleted records</span>
        </label>
        <input
          type="radio"
          name="deleted"
          id="deletedFalse"
          bind:group={databaseState.filters.deleted}
          value="true"
          disabled={databaseState.filters.deleted === 'true'}
          onchange={() => { record.get({ table: page.params.id, filters: databaseState.filters, sort: databaseState.sort, deleted: databaseState.filters.deleted }); } }
        >

      </div>

    </div>
  </nav>

</section>

{#if databaseState.record !== null}
  <RecordCreate properties={databaseState.table.properties} editing={databaseState.record} />
{/if}
