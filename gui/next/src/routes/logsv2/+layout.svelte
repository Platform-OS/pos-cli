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

onMount(async () => {
  items = await logs.get();
});

$: if($page.params.id){
  $state.logv2 = items?.body.hits.find(log => log.uuid === $page.params.id);
}

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

</style>



<!-- ================================================================== -->
<svelte:head>
  <title>Logs | platformOS</title>
</svelte:head>


<div class="container" bind:this={container}>

  <section class="logs">
    {#await logs.get() then logs}

      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Type</th>
            <th class="message">Message</th>
          </tr>
        </thead>
        <tbody>
          {#each logs.body.hits as log}
            <tr class:error={log.type.match(/error/i)}>
              <td class="time">
                <a href="/logsv2/{log.uuid}">
                  {new Date(log.options_at / 1000).toLocaleString()}
                </a>
              </td>
              <td class="type">
                <a href="/logsv2/{log.uuid}">
                  {log.type}
                </a>
              </td>
              <td class="message">
                <a href="/logsv2/{log.uuid}">
                  <div>
                    {log.message}
                  </div>
                </a>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>

    {/await}
  </section>

  <slot></slot>

</div>
