<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { onMount } from 'svelte';
import { page } from '$app/stores';
import { logs } from '$lib/api/logsv2';
import { state } from '$lib/state';


// properties
// ------------------------------------------------------------------------
// main content container (dom node)
let container;

let items;

let filters = {};
$: filters = Object.fromEntries($page.url.searchParams)

onMount(async () => {
  items = await logs.get(filters);
});

</script>


<!-- ================================================================== -->
<style>

/* shared */
.container {
  width: 100%;
  display: flex;
}

/* logs */
.logs {
  height: calc(100vh - 82px);
  overflow: auto;
  position: sticky;

  flex-grow: 1;
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

  <section class="logs">
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
