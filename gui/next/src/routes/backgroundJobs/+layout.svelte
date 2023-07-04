<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { onMount, onDestroy } from 'svelte';
import { goto } from '$app/navigation';
import { page } from '$app/stores';
import { backgroundJob } from '$lib/api/backgroundJob.js';
import { relativeTime } from '$lib/relativeTime.js';

import Icon from '$lib/ui/Icon.svelte';
import Delete from '$lib/backgroundJob/Delete.svelte';


// properties
// ------------------------------------------------------------------------
// list of background jobs (array)
let items = [];
// the extended menu for the background job
let contextMenu = {
  // job id for which the context menu is opened for
  id: null
};
// stores currently applied filters (object)
let filters = {
  type: 'SCHEDULED',
  ...Object.fromEntries($page.url.searchParams)
}
// main form with the filters (dom node)
let form;

// purpose:   get the fresh list of background jobs from database and start counter on when they run
// arguments: filters to use for the query (FormData)
// ------------------------------------------------------------------------
let runsAtUpdateInterval;
const getItems = async () => {

  clearInterval(runsAtUpdateInterval);

  items = await backgroundJob.get(filters);

  runsAtUpdateInterval = setInterval(() => {
    items.forEach(item => {
      if(filters.type === 'DEAD'){
        item.dead_at_parsed = relativeTime(new Date(item.dead_at));
      } else {
        item.run_at_parsed = relativeTime(new Date(item.run_at));
      }
    });
  }, 1000);

};

$: filters && getItems();

onDestroy(() => {
  clearInterval(runsAtUpdateInterval);
});


// purpose:		parses the <form> and triggers background jobs reload
// ------------------------------------------------------------------------
const filter = () => {
  const formData = new FormData(form);
  const asString = new URLSearchParams(formData).toString();
  goto('?' + asString);

  getItems();
}

</script>


<!-- ================================================================== -->
<style>

.container {
  width: 100%;
  height: calc(100vh - 83px);
  overflow-y: auto;

  display: flex;
  align-items: flex-start;
}


.container > div {
  flex-grow: 1;
}



nav {
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;

  border-bottom: 1px solid var(--color-frame);
  background-color: rgba(var(--color-rgb-background), .8);
  backdrop-filter: blur(17px);
  -webkit-backdrop-filter: blur(17px);
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

  .unnamed {
    font-style: italic;
    color: var(--color-text-secondary);
  }

table a {
  color: var(--color-interaction);
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

</style>



<!-- ================================================================== -->
<svelte:head>
  <title>Background Jobs | platformOS</title>
</svelte:head>


<div class="container">

  <div>

    <nav>
      <form bind:this={form}>
        <label for="filter-type">Type:</label>
        <select name="type" id="filter-type" bind:value={filters.type} on:change={form.requestSubmit()}>
          <option value="SCHEDULED">Scheduled</option>
          <option value="DEAD">Failed</option>
        </select>
      </form>
    </nav>


    <table>

      <thead>
        <tr>
          <th class="id">Name / id</th>
          <th>Priority</th>
          <th>URL</th>
          <th>
            {#if filters.type === 'DEAD'}
              Failed
            {:else}
              Runs
            {/if}
          </th>
        </tr>
      </thead>

    {#each items as item}

      <tr>
        <td class="id" on:mouseleave={() => contextMenu.id = null}>
          <div>

            <button class="button compact more" on:click={() => contextMenu.id = item.id}>
              <span class="label">More options</span>
              <Icon icon="navigationMenuVertical" size="16" />
            </button>

            <menu class="content-context" class:active={contextMenu.id === item.id}>
              <ul>
                <li>
                  <Delete id={item.id} on:itemsChanged={getItems} />
                </li>
              </ul>
            </menu>

            <a href="/backgroundJobs/{filters.type.toLowerCase()}/{item.id}?{$page.url.searchParams.toString()}">
              {item.source_name || item.id}
            </a>

          </div>
        </td>
        <td>{item.arguments.priority}</td>
        <td>{item.arguments.context.location.href}</td>
        <td>
          {#if filters.type === 'DEAD'}
            { item.dead_at_parsed || relativeTime(new Date(item.de)) }
          {:else}
            { item.run_at_parsed || relativeTime(new Date(item.run_at)) }
          {/if}
        </td>
      </tr>

    {/each}

    </table>

  </div>

  <slot />

</div>
