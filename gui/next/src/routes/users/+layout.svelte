<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { tick } from 'svelte';
import { goto } from '$app/navigation';
import { state } from '$lib/state.js';
import { quintOut } from 'svelte/easing';
import { page } from '$app/stores';
import { user } from '$lib/api/user.js';

import Icon from '$lib/ui/Icon.svelte';
import Number from '$lib/ui/forms/Number.svelte';


// properties
// ------------------------------------------------------------------------
// filters form (dom node)
let form;
// list of users (array)
let items = [];
// default filters (object)
let defaultFilters = {
  page: 1,
  attribute: 'email',
  value: ''
};
// currently active filters (object)
let filters = {
  page: 1,
  totalPages: 1,
  attribute: 'email',
  value: '',

  ...Object.fromEntries($page.url.searchParams)
};



// purpose:   load data each time query params change
// ------------------------------------------------------------------------
$: user.get(Object.fromEntries($page.url.searchParams)).then(data => {
  items = data.results;
  filters.totalPages = data.total_pages;
});


// transition:    zooms from nothing to full size
// options: 	delay (int), duration (int)
// ------------------------------------------------------------------------
const appear = function(node, {
  delay = 0,
  duration = 150
}){
  return {
    delay,
    duration,
    css: (t) => {
      const eased = quintOut(t);

      return `scale: ${eased};` }
  }
};

</script>


<!-- ================================================================== -->
<style>

  /* layout */
  .page {
    max-width: 100vw;
    height: 100%;
    overflow: hidden;
    display: grid;
    grid-template-columns: 1fr min-content;
    position: relative;
  }
  
  .container {
    min-height: 0;
    max-width: 100vw;
    display: grid;
    grid-template-rows: min-content 1fr;
  }
  
  .content {
    height: 100%;
    min-height: 0;
    overflow: auto;
  }
  
  
  /* filters */
  .filters {
    padding: var(--space-navigation);
  
    background-color: var(--color-background);
    border-block-end: 1px solid var(--color-frame);
  }
  
    .filters .label {
      position: absolute;
      left: -100vw;
    }
  
    .filters form {
      display: flex;
      gap: var(--space-navigation);
      align-items: center;
    }
  
    .filters input:focus,
    .filters select:focus {
      position: relative;
      z-index: 1;
    }

    .filters #filters_attribute {
      margin-inline-end: 1px;

      border-start-end-radius: 0;
      border-end-end-radius: 0;
    }
  
    .filters .search {
      display: flex;
      align-items: center;
    }
  
    .filters .search input {
      padding-inline-end: 1.8rem;
      border-radius: 0;
    }

    .filters .clear {
      margin-inline-start: -.9rem;
      position: relative;
      inset-inline-start: -.4rem;
      z-index: 1;
    }
  
    .filters .search .button[type="submit"] {
      margin-inline-start: 1px;
      padding-block: .63rem;
      padding-inline: .7em .8em;
      border-start-start-radius: 0;
      border-end-start-radius: 0;
    }
  
  .pagination {
    padding: 1rem;
    display: flex;
    align-items: center;
    gap: .5em;
  
    border-block-start: 1px solid var(--color-frame);
    background-color: rgba(var(--color-rgb-background), .8);
    backdrop-filter: blur(17px);
    -webkit-backdrop-filter: blur(17px);
  }
  
    .pagination .info {
      cursor: help;
    }
  
  
  /* content table */
  table {
    min-width: 100%;
  
    line-height: 1.27em;
  }
  
    thead {
      background-color: var(--color-background);
    }
  
    th,
    td {
      border-block-end: 1px solid var(--color-frame);
    }
  
    th,
    td > a {
      padding: var(--space-table) calc(var(--space-navigation) * 1.5);
    }
  
    th:first-child,
    td:first-child > a {
      padding-inline-start: var(--space-navigation);
    }
  
    th:last-child,
    td:last-child > a {
      padding-inline-end: var(--space-navigation);
    }
  
    td > a {
      display: block;
    }
  
    tr:last-child td {
      border: 0;
    }
  
    .highlight td {
      background-color: var(--color-highlight);
    }
  
    tr {
      position: relative;
    }
  
    tr:after {
      position: absolute;
      inset: calc(var(--space-table) / 3);
      z-index: -1;
  
      border-radius: calc(1rem - var(--space-table) / 1.5);
      background: transparent;
  
      content: '';
  
      transition: background-color .1s linear;
    }
  
    tr:hover:after {
      background-color: var(--color-background);
    }
  
    tr.active:after {
      background-color: var(--color-middleground);
    }
  
    /* disable this hover effect on Safari as they refuse to fix their position: relative bug for tables */
    @supports (font: -apple-system-body) and (-webkit-appearance: none) {
      tr:after {
        display: none;
      }
    }

    .table-id {
      width: 1%;

      text-align: end;
      font-variant-numeric: tabular-nums;
    }
  
  </style>


<!-- ================================================================== -->
<svelte:head>
  <title>Users{$state.online?.MPKIT_URL ? ': ' + $state.online.MPKIT_URL.replace('https://', '') : ''}</title>
</svelte:head>


<div class="page">

<section class="container">

  <nav class="filters">
    <form
      action=""
      bind:this={form}
      id="filters"
      on:submit={
        // reset page number when changing filters except when directly changing a page
        async event => { if(event.submitter?.dataset.action !== 'numberIncrease'){ event.preventDefault(); filters.page = 1; await tick(); goto(document.location.pathname + '?' + (new URLSearchParams(new FormData(event.target)).toString())); } }
      }
    >
      <label for="filters_attribute">Filter by</label>
      <fieldset class="search">
        <select id="filters_attribute" name="attribute" bind:value={filters.attribute} on:change={() => filters.value = ''}>
          <option value="email">email</option>
          <option value="id">id</option>
        </select>
        <input type="text" name="value" bind:value={filters.value}>
        {#if filters.value}
          <button type="button" class="clear" transition:appear on:click={() => { filters = {...defaultFilters}; form.requestSubmit(); }}>
            <span class="label">Clear filters</span>
            <Icon icon="x" size=14 />
          </button>
        {/if}
        <button type="submit" class="button">
          <span class="label">Filter logs</span>
          <Icon icon="arrowRight" />
        </button>
      </fieldset>
    </form>
  </nav>

  <article class="contetnt">
    <table>
      <thead>
        <tr>
          <th class="table-id">ID</th>
          <th>Email</th>
        </tr>
      </thead>
      {#if items}
        <tbody>
          {#each items as user}
            <tr
              class:active={$page.params.id == user.id}
            >
              <td class="table-id">
                <a href="/users/{user.id}?{$page.url.searchParams.toString()}">
                  {user.id}
                </a>
              </td>
              <td>
                <a href="/users/{user.id}?{$page.url.searchParams.toString()}">
                  {user.email}
                </a>
              </td>
            </tr>
          {/each}
        </tbody>
      {/if}
    </table>
  </article>

  <nav class="pagination">
    <label for="page">
      Page:
    </label>
    <Number
      form="filters"
      name="page"
      bind:value={filters.page}
      min={1}
      max={filters.totalPages}
      step={1}
      decreaseLabel="Previous page"
      increaseLabel="Next page"
      style="navigation"
      on:input={event => { form.requestSubmit(event.detail.submitter); }}
    />
    of {filters.totalPages}
  </nav>

</section>

{#if $page.params.id}
  <slot></slot>
{/if}

</div>
