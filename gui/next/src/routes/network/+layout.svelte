<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { page } from '$app/stores';
import { network } from '$lib/api/network.js';
import { state } from '$lib/state.js';


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
$: network.get(Object.fromEntries($page.url.searchParams)).then(data => items = data);

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

  .time {
    font-family: monospace;
    font-size: 1rem;
    white-space: nowrap;
  }

    @media (max-width: 750px){
      .time {
        white-space: normal;
      }
    }

  .request {
    width: 100%;
    position: relative;
  }

  .request > a {
    padding: 0;
    position: absolute;
    inset: 0;
  }

  .request > a > div {
    max-width: 100%;
    padding: var(--space-table) calc(var(--space-navigation) * 1.5);
    overflow: hidden;

    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .request .method {
    padding: .2rem;

    border-radius: 4px;
    border: 1px solid var(--color-frame);

    font-family: monospace;
  }

  .status > a {
    font-family: monospace;
    font-size: 1rem;
  }

  .status.success {
    color: var(--color-confirmation);
  }

  .status.error {
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
        </form>
      </nav>

      <article class="content">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Status</th>
              <th>Request</th>
            </tr>
          </thead>
          {#if items}
            <tbody>
              {#each items.hits as log}
                <tr
                  class:highlight={filters.key == log._timestamp}
                  class:active={$page.params.id == log._timestamp}
                >
                  <td class="time">
                    <a href="/network/{log._timestamp}?{$page.url.searchParams.toString()}">
                      {new Date(log._timestamp / 1000).toLocaleString()}
                    </a>
                  </td>
                  <td
                    class="status"
                    class:success={log.lb_status_code >= 200 && log.lb_status_code < 300}
                    class:error={log.lb_status_code >= 400 && log.lb_status_code < 600}
                  >
                    <a href="/network/{log._timestamp}?{$page.url.searchParams.toString()}">
                      {log.lb_status_code}
                    </a>
                  </td>
                  <td class="request">
                    <a href="/network/{log._timestamp}?{$page.url.searchParams.toString()}">
                      <div>
                        <span class="method">{log.http_request_method}</span> {log.http_request_path}
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
