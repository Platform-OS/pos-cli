<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { onMount } from 'svelte';
import { logs } from '$lib/api/logsv2';


// properties
// ------------------------------------------------------------------------
// main content container (dom node)
let container;

onMount(async () => {
  console.log(await logs.get());
});

</script>


<!-- ================================================================== -->
<style>

</style>



<!-- ================================================================== -->
<svelte:head>
  <title>Logs | platformOS</title>
</svelte:head>


<div class="container" bind:this={container}>

  <section class="logs">
    {#await logs.get()}
      Loading...
    {:then logs}

      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Type</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
          {#each logs.body.hits as log}
            <tr>
              <td>{log.options_at}</td>
              <td>{log.type}</td>
              <td>{log.message}</td>
            </tr>
          {/each}
        </tbody>
      </table>

    {/await}
  </section>

</div>
