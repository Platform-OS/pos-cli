<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { onMount } from 'svelte';
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


// purpose:   get the fresh list of background jobs from database and start counter on when they run
// ------------------------------------------------------------------------
let runsAtUpdateInterval;
const getItems = async () => {

  clearInterval(runsAtUpdateInterval);

  items = await backgroundJob.get();

  runsAtUpdateInterval = setInterval(() => {
    items.forEach(item => {
      item.run_at_parsed = relativeTime(new Date(item.run_at));
    });
  }, 1000);

};

onMount(() => {
  getItems();
});

</script>


<!-- ================================================================== -->
<style>

.container {
  width: 100%;

  display: flex;
  align-items: flex-start;
}


table {
  flex-grow: 1;
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
  vertical-align: top;

  border: 1px solid var(--color-frame);

  transition: background-color .2s linear;
}

  th.id {
    padding-inline-start: 2.6rem;
  }

  td.id {
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

  <table>

    <thead>
      <tr>
        <th class="id">Name / id</th>
        <th>Priority</th>
        <th>URL</th>
        <th>
          Runs
        </th>
        <th></th>
      </tr>
    </thead>

  {#each items as item}

    <tr>
      <td class="id" on:mouseleave={() => contextMenu.id = null}>

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

        <a href="/backgroundJobs/{item.id}">
          {item.source_name || item.id}
        </a>

      </td>
      <td>{item.arguments.priority}</td>
      <td>{item.arguments.context.location.href}</td>
      <td>{ item.run_at_parsed || relativeTime(new Date(item.run_at)) }</td>
      <td>{#if item.error}Failed{/if}</td>
    </tr>

  {/each}

  </table>


  <slot />

</div>
