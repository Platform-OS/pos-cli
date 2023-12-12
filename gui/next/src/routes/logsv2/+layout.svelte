<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { onMount } from 'svelte';
import { page } from '$app/stores';
import { logs } from '$lib/api/logsv2';


// properties
// ------------------------------------------------------------------------
// main content container (dom node)
let container;

let form;

let items;

let filters = {};
$: filters = Object.fromEntries($page.url.searchParams);
$: logs.get(filters).then(data => items = data);

const today = new Date();
const minAllowedDate = new Date(today - 1000 * 60 * 60 * 24 * 3);

</script>


<!-- ================================================================== -->
<style>

/* shared */
.container {
  height: 100%;
  overflow: hidden;
  display: grid;
  grid-template-columns: 1fr min-content;
}

/* logs */
.content {
  overflow: auto;
}

.filters {
  padding: var(--space-navigation);

  background-color: var(--color-background);
  border-block-end: 1px solid var(--color-frame);
}

table {
  width: 100%;
  max-width: 100vw;
}

  thead {
    background-color: var(--color-background);
  }

  th, td {
    padding: 1rem;

    border-block-end: 1px solid var(--color-frame);
  }

  .time,
  .type {
    font-family: monospace;
    font-size: 1rem;
  }

  .time {
    white-space: nowrap;
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

  .error {
    color: var(--color-danger);
  }

  .highlight td {
    background-color: var(--color-highlight);
  }

  .active .time {
    font-weight: 800;
  }

</style>



<!-- ================================================================== -->
<svelte:head>
  <title>Logs | platformOS</title>
</svelte:head>


<div class="container" bind:this={container}>

  <section class="content">

      <nav class="filters">
        <form action="" bind:this={form}>
          <input
            type="date"
            name="start_time"
            min={minAllowedDate.toISOString().split('T')[0]}
            max={today.toISOString().split('T')[0]}
            value={new Date(filters.start_time).toISOString().split('T')[0]}
            on:change={form.requestSubmit()}
          >
          <button>Submit</button>
        </form>
      </nav>

      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Type</th>
            <th class="message">Message</th>
          </tr>
        </thead>
        {#if items}
          <tbody>
            {#each items.hits as log}
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

  </section>

  {#if $page.params.id}
    <slot></slot>
  {/if}

</div>
