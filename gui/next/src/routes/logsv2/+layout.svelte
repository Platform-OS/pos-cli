<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { page } from '$app/stores';
import { logs } from '$lib/api/logsv2.js';
import { state } from '$lib/state.js';

import Icon from '$lib/ui/Icon.svelte';


// properties
// ------------------------------------------------------------------------
// main content container (dom node)
let container;
// filters form (dom node)
let form;
// request results with 'hits' containing array with logs (object)
let items;
// todays date (Date object)
const today = new Date();
// how far to the past the logs can be requested (Date object)
const dayInterval = 1000 * 60 * 60 * 24;
const minAllowedDate = new Date(today -  dayInterval * 3);
// currently active filters (object)
let filters = Object.fromEntries($page.url.searchParams);
  filters.start_time = filters.start_time || today.toISOString().split('T')[0];



// purpose:   load new logs each time query params change
// ------------------------------------------------------------------------
$: logs.get(Object.fromEntries($page.url.searchParams)).then(data => $state.logsv2 = data);

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

  .filters form {
    display: flex;
    gap: var(--space-navigation);
  }

  .filters input:focus-visible {
    position: relative;
    z-index: 1;
  }

  .filters .search {
    display: flex;
    align-items: center;
  }

  .filters .search label :global(svg) {
    width: 16px;
    height: 16px;
    margin-inline-end: -16px;
    position: relative;
    inset-inline-start: .8em;
    inset-block-start: 2px;
    z-index: 2;

    color: var(--color-text-secondary);
  }

  .filters .search input {
    padding-inline-start: 2.5em;
    border-start-end-radius: 0;
    border-end-end-radius: 0;
  }

  .filters .search .button {
    margin-inline-start: 1px;
    padding-block: .63rem;
    padding-inline: .7em .8em;
    border-start-start-radius: 0;
    border-end-start-radius: 0;
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

  .time,
  .type {
    font-family: monospace;
    font-size: 1rem;
  }

  .time {
    white-space: nowrap;
  }

    @media (max-width: 750px){
      .time {
        white-space: normal;
      }
    }

  .message {
    width: 100%;
    position: relative;
  }

  .message > a {
    padding: 1rem;
    position: absolute;
    inset: 0;
  }

  .message > a > div {
    max-width: 100%;
    overflow: hidden;

    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .error .type {
    color: var(--color-danger);
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


</style>



<!-- ================================================================== -->
<svelte:head>
  <title>Logs{$state.online?.MPKIT_URL ? ': ' + $state.online.MPKIT_URL.replace('https://', '') : ''}</title>
</svelte:head>


<div class="page" bind:this={container}>

  <section class="container">

      <nav class="filters">
        <form action="" bind:this={form}>
          <input
            type="date"
            name="start_time"
            min={minAllowedDate.toISOString().split('T')[0]}
            max={today.toISOString().split('T')[0]}
            bind:value={filters.start_time}
            on:input={form.requestSubmit()}
          >
          <fieldset class="search">
            <label for="filter_message">
              <Icon icon="search" />
            </label>
            <input
              type="text"
              name="message"
              id=filter_message
              placeholder="Find logs"
              bind:value={filters.message}
            >
            <button type="submit" class="button">
              <span class="label">Filter logs</span>
              <Icon icon="arrowRight" />
            </button>
          </fieldset>
        </form>
      </nav>

      <article class="content">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Type</th>
              <th class="message">Message</th>
            </tr>
          </thead>
          {#if $state.logsv2.hits}
            <tbody>
              {#each $state.logsv2.hits as log}
                <tr
                  class:error={log.type.match(/error/i)}
                  class:highlight={filters.key == log._timestamp}
                  class:active={$page.params.id == log._timestamp}
                >
                  <td class="time">
                    <a href="/logsv2/{log._timestamp}?{$page.url.searchParams.toString()}">
                      {new Date(log.options_at / 1000).toLocaleString()}
                    </a>
                  </td>
                  <td class="type">
                    <a href="/logsv2/{log._timestamp}?{$page.url.searchParams.toString()}">
                      {log.type}
                    </a>
                  </td>
                  <td class="message">
                    <a href="/logsv2/{log._timestamp}?{$page.url.searchParams.toString()}">
                      <div>
                        {log.message}
                      </div>
                    </a>
                  </td>
                </tr>
              {/each}
            </tbody>
          {/if}
        </table>
      </article>

  </section>

  {#if $page.params.id}
    <slot></slot>
  {/if}

</div>
