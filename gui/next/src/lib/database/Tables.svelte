<!--
  list of tables and filtering ability for those
-->



<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { onMount } from 'svelte';
import { fade } from 'svelte/transition';
import { page } from '$app/state';
import { databaseState } from '#lib/state/database.svelte.js';
import { table } from '#lib/api/table';

import Icon from '#lib/ui/Icon.svelte';


// properties
// ------------------------------------------------------------------------
// called when the list needs to be shown, from the ctrl+k shortcut (function)
let { onSidebarNeeded = () => {} } = $props();
// container with all of the tables
let container;
// input used for filtering the tables (dom node)
let filterInput;
// input field that filters the tables (string)
let filterText = $state('');

// get tables list
table.get().then(response => { databaseState.tables = response; });

onMount(() => {
  // focus the filter input on load
  filterInput.focus();

  // scroll active table into view
  if(page.data.table){
    container.querySelector(`[href$="${page.data.table.id}"]`).scrollIntoView({behavior: 'smooth', block: 'center'});
  }
});


// purpose:   global hotkeys
// arguments: keyboard event (object)
// ------------------------------------------------------------------------
const globalKeyboardShortcut = (event) => {
  // focus input on ctrl+k
  if(event.ctrlKey && event.key === 'k'){
    event.preventDefault();

    onSidebarNeeded();
    filterInput.focus();
    filterInput.select();
  }
};


// database tables filtered, as shown on the list (array)
// derived rather than recomputed on input, so tables that arrive after the user
// started typing are filtered too instead of replacing the filtered list
const tables = $derived(filterText ? (databaseState.tables ?? []).filter(item => item.name.includes(filterText)) : databaseState.tables);


// purpose:   handles keyboard shortcuts for the filter input
// arguments: keyboard event (object)
// ------------------------------------------------------------------------
const filterInputKeyboardShortcut = (event) => {

  if(event.key === 'Escape'){
    filterText = '';
  }

  if(event.key === 'Enter'){
    container.querySelector('li:first-child a').click();
  }

};


// purpose:   handles keyboard navigation on the tables list
// arguments: keyboard event (object)
// ------------------------------------------------------------------------
const listKeyboardShortcut = (event) => {

  if(event.key === 'ArrowDown'){
    if(container.contains(document.activeElement)){
      event.preventDefault();
      if(document.activeElement.matches('input')){
        container.querySelector('a')?.focus();
      } else {
        document.activeElement?.parentElement?.nextElementSibling?.querySelector('a')?.focus();
      }
    }
  }

  if(event.key === 'ArrowUp'){
    if(container.contains(document.activeElement)){
      event.preventDefault();
      if(document.activeElement?.matches('li:first-child a')){
        filterInput.focus();
      } else {
        document.activeElement?.parentElement?.previousElementSibling?.querySelector('a')?.focus();
      }
    }
  }

  if(event.key === 'Escape'){
    if(container.contains(document.activeElement)){
      filterInput.focus();
      filterText = '';
    }
  }

};

</script>



<!-- ================================================================== -->
<style>

aside {
  width: 350px;
  height: calc(100vh - 83px);
  flex-shrink: 0;
  overflow: auto;

  border-inline-end: 1px solid var(--color-frame);
}

nav {
  padding-bottom: 1rem;
}

a {
  max-width: 100%;
  margin: 0 1rem;
  padding: .5rem 1rem;
  display: block;
  overflow: hidden;

  border-radius: .5rem;

  text-overflow: ellipsis;
}

a:hover,
a:focus-visible {
  background-color: var(--color-background);

  color: var(--color-interaction);
}

a.active {
  background-color: var(--color-middleground);

  font-weight: 500;
}

.filter-container {
  padding: 1rem 1rem 2rem;
  position: sticky;
  top: 0;

  background-image: linear-gradient(to bottom, var(--color-page) 80%, rgba(var(--color-rgb-page), 0));
}

.filter {
  width: 100%;
  padding: .5rem .8rem;
  display: flex;
  align-items: center;
  gap: .5rem;

  background-color: var(--color-background);
  border-radius: .5rem;

  transition: background-color .1s linear;
}

.filter:has(input:focus-visible) {
  background-color: var(--color-middleground);
}

.filter input {
  all: unset;
  max-width: 185px;
}

.filter button {
  all: unset;

  display: flex;
  cursor: pointer;

  line-height: .2em;
}

.filter button,
.filter i {
  margin-inline-end: .2em;
  flex-shrink: 0;
}

.filter i {
  position: relative;
  top: 2px;
  color: var(--color-text-secondary);
}

.filter kbd:first-of-type {
  margin-inline-start: auto;
}

</style>



<!-- ================================================================== -->
<svelte:document onkeydown={globalKeyboardShortcut} />

<!-- the arrow keys move between the links inside, so the list handles them for all of its links -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<aside bind:this={container} onkeydown={listKeyboardShortcut}>

  <div class="filter-container">
    <div class="filter">

      {#if filterText}
        <button onclick={() => { filterText = ''; } }>
          <span class="label">Reset filter</span>
          <Icon icon="x" size="18" />
        </button>
      {:else}
        <i>
          <Icon icon="search" size="18" />
        </i>
      {/if}

      <input
        type="text"
        placeholder="Search tables"
        bind:this={filterInput}
        bind:value={filterText}
        onkeydown={filterInputKeyboardShortcut}
      >

      <kbd>Ctrl</kbd><kbd>K</kbd>
    </div>
  </div>

  <nav>
    <ul>
      {#each tables as table, index}
        <li in:fade={{ duration: 100, delay: 7 * index }}>
          <a href="/database/table/{table.id}" class:active={table.id === page.params.id}>
            {table.name}
          </a>
        </li>
      {/each}
    </ul>
  </nav>

</aside>
