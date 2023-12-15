<!--
  list of tables and filtering ability for those
-->



<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { onMount, createEventDispatcher } from 'svelte';
import { fade } from 'svelte/transition';
import { page } from '$app/stores';
import { state } from '$lib/state';
import { table } from '$lib/api/table';

import Icon from '$lib/ui/Icon.svelte';


// properties
// ------------------------------------------------------------------------
// tables list (array)
let data = $state.tables;
// database tables filtered, as shown on the list (array)
let tables = data;
// container with all of the tables
let container;
// input used for filtering the tables (dom node)
let filterInput;
// input field that filters the tables (string)
let filterText;

// get tables list
(async () => await table.get())().then(response => { data = response; tables = response; $state.tables = response; });

const dispatch = createEventDispatcher();

onMount(async () => {
  // focus the filter input on load
  filterInput.focus();

  // global hotkeys
  document.addEventListener('keydown', (event) => {
    // focus input on ctrl+k
    if(event.ctrlKey && event.key === 'k'){
      event.preventDefault();

      dispatch('sidebarNeeded');
      filterInput.focus();
      filterInput.select();
    }
  });

  // scroll active table into view
  if($page.data.table){
    container.querySelector(`[href$="${$page.data.table.id}"]`).scrollIntoView({behavior: 'smooth', block: 'center'});
  }
});


// purpose:   filters the tables array by given phrase
// argumens:  uses the filterText property as a phrase to filter items with
// returns:   modifies the filterText property and leaves only items that matches the filter phrase
// ------------------------------------------------------------------------
const filter = () => {

  if(filterText){
    tables = data.filter(item => item.name.includes(filterText))
  } else {
    tables = data;
  }

};


// purpose:   handles keyboard shortcuts for the filter input
// arguments: keyboard event (object)
// ------------------------------------------------------------------------
const filterInputKeyboardShortcut = (event) => {

  if(event.key === 'Escape'){
    filterText = '';
    filter();
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
      filter();
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
<aside bind:this={container} on:keydown={listKeyboardShortcut}>

  <div class="filter-container">
    <div class="filter">

      {#if filterText}
        <button on:click={() => { filterText = null; filter(); } }>
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
        on:input={filter}
        on:keydown={filterInputKeyboardShortcut}
      >

      <kbd>Ctrl</kbd><kbd>K</kbd>
    </div>
  </div>

  <nav>
    <ul>
      {#each tables as table, index}
        <li in:fade={{ duration: 100, delay: 7 * index }}>
          <a href="/database/table/{table.id}" class:active={table.id === $page.params.id}>
            {table.name}
          </a>
        </li>
      {/each}
    </ul>
  </nav>

</aside>
