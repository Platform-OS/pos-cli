<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { page } from '$app/stores';
import { state } from '$lib/state';
import { record } from '$lib/api/record';

import Icon from '$lib/ui/Icon.svelte';
import Filters from '$lib/database/Filters.svelte';
import Sort from '$lib/database/Sort.svelte';
import Table from '$lib/database/Table.svelte';
import RecordCreate from '$lib/database/Create.svelte';
import Number from '$lib/ui/forms/Number.svelte';


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
  record.get({ table: $page.params.id, filters: $state.filters, sort: $state.sort, deleted: $state.filters.deleted }).then(() => refreshing = false);
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
  <title>{$state.table?.name || 'Loading…'} | platformOS</title>
</svelte:head>

<svelte:window on:keypress={keyboardShortcuts} />

<section>

  <nav>

    <Filters />

    <Sort />

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
    <div>
      <label for="page">
        Page:
      </label>
      <Number
        name="page"
        bind:value={$state.filters.page}
        min={1}
        max={$state.records?.total_pages}
        step={1}
        decreaseLabel="Previous page"
        increaseLabel="Next page"
        style="navigation"
        on:input={() => { record.get({ table: $page.params.id, filters: $state.filters, sort: $state.sort, deleted: $state.filters.deleted }); } }
      />
      of {$state.records?.total_pages || 1}
    </div>

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
          bind:group={$state.filters.deleted}
          value="false"
          disabled={$state.filters.deleted === 'false'}
          on:change={() => { record.get({ table: $page.params.id, filters: $state.filters, sort: $state.sort, deleted: $state.filters.deleted }); } }
        >
        <label
          for="deletedTrue"
          class="button"
          class:active={$state.filters.deleted === 'false'}
          class:disabled={$state.filters.deleted === 'false'}
          title="Show{$state.filters.deleted === 'false' ? 'ing' : ''} current database state"
        >
          <Icon icon="leaf" />
          <span class="label">Show{$state.filters.deleted === 'false' ? 'ing' : ''} current database state</span>
        </label>

        <label
          for="deletedFalse"
          class="button"
          class:active={$state.filters.deleted === 'true'}
          class:disabled={$state.filters.deleted === 'true'}
          title="Show{$state.filters.deleted === 'true' ? 'ing' : ''} deleted records"
        >
          <Icon icon="recycle" />
          <span class="label">Show{$state.filters.deleted === 'true' ? 'ing' : ''} deleted records</span>
        </label>
        <input
          type="radio"
          name="deleted"
          id="deletedFalse"
          bind:group={$state.filters.deleted}
          value="true"
          disabled={$state.filters.deleted === 'true'}
          on:change={() => { record.get({ table: $page.params.id, filters: $state.filters, sort: $state.sort, deleted: $state.filters.deleted }); } }
        >

      </div>

    </div>
  </nav>

</section>

{#if $state.record !== null}
  <RecordCreate properties={$state.table.properties} editing={$state.record} />
{/if}
