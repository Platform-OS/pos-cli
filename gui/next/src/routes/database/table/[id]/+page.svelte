<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { goto, invalidate } from '$app/navigation';
import { page } from '$app/state';
import { connectionState } from '#lib/state/connection.svelte.js';
import { databaseState } from '#lib/state/database.svelte.js';
import { preferencesState, setView } from '#lib/state/preferences.svelte.js';
import { queryHref } from '#lib/database/query.js';

import Icon from '#lib/ui/Icon.svelte';
import Filters from '#lib/database/Filters.svelte';
import Sort from '#lib/database/Sort.svelte';
import Table from '#lib/database/Table.svelte';
import RecordCreate from '#lib/database/Create.svelte';
import Number from '#lib/ui/forms/Number.svelte';


// properties
// ------------------------------------------------------------------------
// records, and the filters and sort they were loaded with, from +page.js (object)
let { data } = $props();
// if the current view is being refreshed currently (bool)
let refreshing = $state(false);
// page number in the pagination field, following the url until it is edited (int)
let pageNumber = $derived(data.filters.page);


// purpose:		set current table in the state
//				(databaseState.table is derived from the id, so it also follows the tables loading later)
// ------------------------------------------------------------------------
$effect.pre(() => {
  databaseState.tableId = page.params.id;
});


// purpose:		shows the records with part of the view changed, through the url
// arguments:	what to change, see queryHref in #lib/database/query.js (object)
// ------------------------------------------------------------------------
const show = (changes) => goto(queryHref(page.url, changes), { reset: false });


// purpose:		refresh current data without reloading the whole page
// ------------------------------------------------------------------------
const refresh = () => {
  refreshing = true;
  invalidate('app:records').then(() => refreshing = false);
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

    <Filters filters={data.filters} onfilter={filter => show({ filter, page: 1 })} />

    <Sort sort={data.sort} onsort={sort => show({ sort, page: 1 })} />

    <button class="button" title="Refresh current view (R)" class:refreshing onclick={refresh}>
      <span class="label">Refresh current view</span>
      <Icon icon="refresh" />
    </button>

  </nav>

  {#if preferencesState.view.database !== 'tiles'}
    <Table records={data.records} deleted={data.filters.deleted === 'true'} />
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
        bind:value={pageNumber}
        min={1}
        max={data.records?.total_pages}
        step={1}
        decreaseLabel="Previous page"
        increaseLabel="Next page"
        style="navigation"
        oninput={() => show({ page: pageNumber })}
      />
      of {data.records?.total_pages || 1}
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
          checked={data.filters.deleted === 'false'}
          value="false"
          disabled={data.filters.deleted === 'false'}
          onchange={event => show({ deleted: event.target.value })}
        >
        <label
          for="deletedTrue"
          class="button"
          class:active={data.filters.deleted === 'false'}
          class:disabled={data.filters.deleted === 'false'}
          title="Show{data.filters.deleted === 'false' ? 'ing' : ''} current database state"
        >
          <Icon icon="leaf" />
          <span class="label">Show{data.filters.deleted === 'false' ? 'ing' : ''} current database state</span>
        </label>

        <label
          for="deletedFalse"
          class="button"
          class:active={data.filters.deleted === 'true'}
          class:disabled={data.filters.deleted === 'true'}
          title="Show{data.filters.deleted === 'true' ? 'ing' : ''} deleted records"
        >
          <Icon icon="recycle" />
          <span class="label">Show{data.filters.deleted === 'true' ? 'ing' : ''} deleted records</span>
        </label>
        <input
          type="radio"
          name="deleted"
          id="deletedFalse"
          checked={data.filters.deleted === 'true'}
          value="true"
          disabled={data.filters.deleted === 'true'}
          onchange={event => show({ deleted: event.target.value })}
        >

      </div>

    </div>
  </nav>

</section>

{#if databaseState.record !== null}
  <RecordCreate properties={databaseState.table.properties} editing={databaseState.record} />
{/if}
