<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { connectionState } from '#lib/state/connection.svelte.js';
import { localDay } from '#lib/api/timeRange.js';

import Icon from '#lib/ui/Icon.svelte';
import Number from '#lib/ui/forms/Number.svelte';


// properties
// ------------------------------------------------------------------------
let {
  // the logs and the filters they were loaded with, from +layout.js (object)
  data,
  // the log details, shown when a log is opened (snippet)
  children
} = $props();
// filters form (dom node)
let form;
// todays date (Date object)
const today = new Date();
// how far to the past the logs can be requested (Date object)
const dayInterval = 1000 * 60 * 60 * 24;
const minAllowedDate = new Date(today -  dayInterval * 3);
// the date the form shows when the url names none (string, YYYY-MM-DD)
const defaultStartTime = localDay(today);
// the filters in the form, following the url until they are edited
let startTime = $derived(data.filters.start_time || defaultStartTime);
let message = $derived(data.filters.message);
let pageNumber = $derived(data.filters.page);
// number of pages of logs (int)
let totalPages = $derived(Math.ceil(data.logs?.total / data.logs?.size) || 1);


// purpose:   shows the logs for the filters in the form, through the url
//            (the layout's load function runs again for the new query)
// arguments: submit event (object)
// ------------------------------------------------------------------------
const submitForm = function(event) {
  event.preventDefault();
  const params = new URLSearchParams(new FormData(form));
  // a new search starts from the first page, a page change keeps the search
  if (data.filters.message !== params.get('message') || (data.filters.start_time || defaultStartTime) !== params.get('start_time')) {
    params.set('page', 1);
  }
  goto(page.url.pathname + '?' + params.toString(), { keepFocus: true, noScroll: true });
}

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

  /* disable this hover effect on Safari as they refuse to fix their position: relative bug for tables */
  @supports (font: -apple-system-body) and (-webkit-appearance: none) {
    tr:after {
      display: none;
    }
  }

</style>



<!-- ================================================================== -->
<svelte:head>
  <title>Logs{connectionState.online?.MPKIT_URL ? ': ' + connectionState.online.MPKIT_URL.replace('https://', '') : ''}</title>
</svelte:head>


<div class="page">

  <section class="container">

      <nav class="filters">
        <form
          action=""
          bind:this={form}
          id="filters"
          onsubmit={submitForm}
        >
          <label for="start_time" class="label">Time limit</label>
          <input
            type="date"
            name="start_time"
            id="start_time"
            min={localDay(minAllowedDate)}
            max={localDay(today)}
            bind:value={startTime}
            oninput={() => form.requestSubmit()}
          >
          <fieldset class="search">
            <label for="filter_message">
              <Icon icon="search" />
            </label>
            <input
              type="text"
              name="message"
              id="filter_message"
              placeholder="Find logs"
              bind:value={message}
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
          {#if data.logs?.hits}
            <tbody>
              {#each data.logs.hits as log (log._timestamp)}
                <tr
                  class:error={log.type.match(/error/i)}
                  class:highlight={page.url.searchParams.get('key') == log._timestamp}
                  class:active={page.params.id == log._timestamp}
                >
                  <td class="time">
                    <a href="/logsv2/{log._timestamp}?{page.url.searchParams.toString()}">
                      {new Date(log.options_at / 1000).toLocaleString()}
                    </a>
                  </td>
                  <td class="type">
                    <a href="/logsv2/{log._timestamp}?{page.url.searchParams.toString()}">
                      {log.type}
                    </a>
                  </td>
                  <td class="message">
                    <a href="/logsv2/{log._timestamp}?{page.url.searchParams.toString()}">
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

      <nav class="pagination">
        <label for="page">
          Page:
        </label>
        <Number
          form="filters"
          name="page"
          bind:value={pageNumber}
          min={1}
          max={totalPages}
          step={1}
          decreaseLabel="Previous page"
          increaseLabel="Next page"
          style="navigation"
          oninput={({ submitter }) => form.requestSubmit(submitter)}
        />
        of <span class="info" title="{data.logs?.total ?? 0} logs total">{totalPages}</span>
      </nav>

  </section>

  {#if page.params.id}
    {@render children?.()}
  {/if}

</div>
