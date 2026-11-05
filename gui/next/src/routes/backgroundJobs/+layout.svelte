<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { goto, invalidate } from '$app/navigation';
import { page } from '$app/state';
import { relativeTime } from '#lib/relativeTime.js';
import { connectionState } from '#lib/state/connection.svelte.js';

import Icon from '#lib/ui/Icon.svelte';
import Number from '#lib/ui/forms/Number.svelte';
import Retry from '#lib/backgroundJob/Retry.svelte';
import Delete from '#lib/backgroundJob/Delete.svelte';
import Stop from '#lib/backgroundJob/Stop.svelte';


// properties
// ------------------------------------------------------------------------
let {
  // the jobs list and the filters it was loaded with, from +layout.js (object)
  data,
  // the job details, shown when a job is opened (snippet)
  children
} = $props();
// list of jobs (array)
let items = $derived(data.jobs?.results ?? []);
// the type and page in the form, following the url until they are edited
let type = $derived(data.filters.type);
let pageNumber = $derived(data.filters.page);
// the current time, so the relative run times move on while the list is open (int)
let now = $state(Date.now());
// the extended menu for the background job
let contextMenu = $state({
  // job id for which the context menu is opened for
  id: null
});
// main form with the filters (dom node)
let form;
// ids of the running jobs asked to stop that are still on the list (object)
let stopping = $state({});
// the last page of the list, 1 for an empty one (int)
let lastPage = $derived(Math.max(data.jobs?.total_pages || 1, 1));


// purpose:   update the relative run times every second
// ------------------------------------------------------------------------
$effect(() => {
  const interval = setInterval(() => now = Date.now(), 1000);

  return () => clearInterval(interval);
});


// purpose:   load the jobs again after a retry or a delete
// ------------------------------------------------------------------------
const reloadJobs = () => invalidate('app:backgroundJobs');


// purpose:   keeps the list of running jobs current: jobs start and end all the time
// ------------------------------------------------------------------------
$effect(() => {
  if(data.filters.type !== 'RUNNING'){
    return;
  }

  const interval = setInterval(reloadJobs, 5000);

  return () => clearInterval(interval);
});


// purpose:   shows the list for the type and page in the form, through the url
//            (the layout's load function runs again for the new query)
//            The form is not validated by the browser: a page number out of range would
//            block every submit, switching the type included, so it is brought in range here.
// arguments: submit event (object)
// ------------------------------------------------------------------------
const submitForm = function(event) {
  event.preventDefault();
  const params = new URLSearchParams(new FormData(form));
  const typeChanged = data.filters.type !== params.get('type');
  const requested = parseInt(params.get('page'));
  const target = typeChanged || !(requested >= 1) ? 1 : Math.min(requested, lastPage);

  params.set('page', target);
  // shows the page actually loaded even when it is the one already on screen
  pageNumber = target;
  // a job open in the details belongs to the previous type, so the details are closed
  const path = typeChanged ? '/backgroundJobs' : page.url.pathname;

  goto(path + '?' + params.toString(), { reset: false });
}

</script>


<!-- ================================================================== -->
<style>

.container {
  height: 100%;
  overflow: hidden;
  display: grid;
  grid-template-columns: 1fr min-content;
}


.container > div {
  height: calc(100vh - 83px);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  flex-grow: 1;
  position: relative;
}



nav {
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: .5em;

  background-color: rgba(var(--color-rgb-background), .8);
  backdrop-filter: blur(17px);
  -webkit-backdrop-filter: blur(17px);
}

.filters {
  border-bottom: 1px solid var(--color-frame);
}

  .filters form {
    display: flex;
    gap: 2rem;
  }

  .filters fieldset {
    display: flex;
    align-items: center;
    gap: .5em;
  }


table {
  width: 100%;
}

thead {
  position: sticky;
  top: 0;
  z-index: 50;
}

th {
  background-color: var(--color-background);

  white-space: nowrap;
  font-weight: 500;
}

td, th {
  padding: .6rem;
  vertical-align: middle;

  border: 1px solid var(--color-frame);
  border-block-start: 0;

  transition: background-color .2s linear;
}

  td:first-child,
  th:first-child {
    border-inline-start: 0;
  }

  td:last-child,
  th:last-child {
    border-inline-end: 0;
  }

  th.id {
    padding-inline-start: 2.6rem;
  }

  td.id div {
    position: relative;
    display: flex;
    align-items: center;
    gap: .7em;
  }

table a {
  color: var(--color-interaction);
}

.stopping {
  color: var(--color-text-secondary);
}

.more {
  padding-inline: .1rem;
  background-color: transparent;
  opacity: 0;

  transition: opacity .1s linear;
}

  tr:hover .more {
    opacity: .5;
  }

  tr:hover .more:hover {
    opacity: 1;
  }

  tr:hover .more:hover {
    background-color: var(--color-background);
  }

/* extended menu */
menu {
  display: none;
  position: absolute;
  left: .5rem;
  top: 100%;
  z-index: 20;
  overflow: hidden;

  border-radius: 1rem;
  white-space: nowrap;
}

menu.active {
  display: block;
}

  td:first-child:hover {
    z-index: 30;
  }

menu li + li {
  border-block-start: 1px solid var(--color-context-input-background);
}

menu :global(button) {
  width: 100%;
  padding: .5rem 1rem;
  display: flex;
  align-items: center;
  gap: .5em;
  line-height: 0;
}

menu :global(button:hover) {
  background-color: var(--color-context-button-background-hover);
}


.pagination {
  margin-block-start: auto;
  position: sticky;
  inset-inline: 0;
  inset-block-end: 0;
}

</style>



<!-- ================================================================== -->
<svelte:head>
  <title>Jobs{connectionState.online?.MPKIT_URL ? ': ' + connectionState.online.MPKIT_URL.replace('https://', '') : ''}</title>
</svelte:head>


<div class="container">

  <div>

    <nav class="filters">
      <form id="filters" bind:this={form} onsubmit={submitForm} novalidate>
        <fieldset>
          <label for="filter-type">Type:</label>
          <select name="type" id="filter-type" bind:value={type} onchange={() => form.requestSubmit()}>
            <option value="SCHEDULED">Scheduled</option>
            <option value="DEAD">Failed</option>
            <option value="RUNNING">Running</option>
          </select>
        </fieldset>
        <!--
        <fieldset>
          <label for="filter-name">Name:</label>
          <input type="text" id="filter-name" name="source_name" bind:value={filters.source_name}>
          <button type="submit" class="button">
            <span class="label">Filter jobs</span>
            <Icon icon="arrowRight" />
          </button>
        </fieldset>
        -->
      </form>
    </nav>

    <table>

      <thead>
        <tr>
          <th class="id">Name / id</th>
          <th>Priority</th>
          <th>
            {#if data.filters.type === 'DEAD'}
              Failed
            {:else}
              Runs
            {/if}
          </th>
        </tr>
      </thead>

      <tbody>
        {#each items as item (item.id)}

          <tr>
            <td class="id" onmouseleave={() => contextMenu.id = null}>
              <div>

                <button class="button compact more" onclick={() => contextMenu.id = item.id}>
                  <span class="label">More options</span>
                  <Icon icon="navigationMenuVertical" size="16" />
                </button>

                <menu class="content-context" class:active={contextMenu.id === item.id}>
                  <ul>
                    {#if data.filters.type === 'RUNNING'}
                      <!-- a running job cannot be deleted, only stopped -->
                      <li>
                        <Stop id={item.id} onsuccess={reloadJobs} bind:requested={() => stopping[item.id] ?? false, (requested) => stopping[item.id] = requested} />
                      </li>
                    {:else}
                      {#if item.dead_at}
                        <li>
                          <Retry id={item.id} onsuccess={reloadJobs} />
                        </li>
                      {/if}
                      <li>
                        <Delete id={item.id} onsuccess={reloadJobs} />
                      </li>
                    {/if}
                  </ul>
                </menu>

                <a href="/backgroundJobs/{data.filters.type.toLowerCase()}/{item.id}?{page.url.searchParams.toString()}">
                  {item.source_name || item.id}
                </a>

                {#if stopping[item.id]}
                  <span class="stopping">stopping…</span>
                {/if}

              </div>
            </td>
            <td>{item.queue}</td>
            <td>
              {#if data.filters.type === 'DEAD'}
                {relativeTime(new Date(item.dead_at), now) || ''}
              {:else}
                {relativeTime(new Date(item.run_at), now)}
              {/if}
            </td>
          </tr>

        {/each}
      </tbody>

    </table>

    <nav class="pagination">
      <label for="page">
        Page:
      </label>
      <Number
        form="filters"
        name="page"
        bind:value={pageNumber}
        min={1}
        max={lastPage}
        step={1}
        decreaseLabel="Previous page"
        increaseLabel="Next page"
        style="navigation"
        oninput={({ submitter }) => form.requestSubmit(submitter)}
      />
      of {lastPage}
    </nav>

  </div>

  {@render children?.()}

</div>
