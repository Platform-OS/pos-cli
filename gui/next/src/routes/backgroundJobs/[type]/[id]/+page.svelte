<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { page } from '$app/stores';
import { backgroundJob } from '$lib/api/backgroundJob.js';

import Code from '$lib/ui/Code.svelte';


// properties
// ------------------------------------------------------------------------
// background jobs (object)
let item = {};

// get background job details
const load = async () => {
  await backgroundJob.get({ id: $page.params.id, type: $page.params.type.toUpperCase() }).then(response => { response.length ? item = response[0] : item = null; });
};

$: load($page.params.id);

</script>


<!-- ================================================================== -->
<style>

aside {
  width: 50%;
  min-width: 400px;
  overflow: hidden;

  border-inline-start: 1px solid var(--color-frame);
}

.container {
  width: 100%;
  height: calc(100vh - 83px);
  padding: 1rem;
  overflow: auto;
}

h2 {
  margin-block-end: .2em;

  font-weight: 500;
  font-size: 1.2rem;
}

.info {
  margin-block-end: 4rem;
  margin-trim: block;
}

.info div {
  margin-block-end: .2em;
  display: flex;
  gap: .5em;
}

dt {
  color: var(--color-text-secondary);
}

code {
  margin-block-end: 2rem;
  padding: 1rem;
  display: block;

  border-radius: 1rem;
  border-start-start-radius: 0;
  background-color: var(--color-middleground);

  font-family: monospace;
  font-size: 1rem;
}

</style>



<!-- ================================================================== -->
<svelte:head>
  <script src="/prism.js" data-manual></script>
</svelte:head>

<aside>
  <div class="container">

    {#if item === null}
      There is no such background job
    {:else}

      <h2>{item.source_name || item.id || 'Loading…'}</h2>
      <dl class="info">
        {#if item.source_name}
          <div>
            <dt>ID:</dt>
            <dd>{item.id}</dd>
          </div>
        {/if}
        {#if item.id}
          <div>
            <dt>Created at:</dt>
            <dd>{(new Date(item.created_at)).toLocaleString()}</dd>
          </div>
          <div>
            <dt>Run at:</dt>
            <dd>{(new Date(item.created_at)).toLocaleString()}</dd>
          </div>
          {#if item.dead_at}
            <div>
              <dt>Dead at:</dt>
              <dd>{(new Date(item.created_at)).toLocaleString()}</dd>
            </div>
          {/if}
          <div>
            <dt>URL:</dt>
            <dd>{item.arguments.context.location.href}</dd>
          </div>
        {/if}
      </dl>

      {#if item.error_message}
        <h2>Error message</h2>
        <code>
          {item.error_message}
        </code>
      {/if}

      {#if item.id}
        <h2>Background job code:</h2>
        <Code language="liquid">
          {item.liquid_body}
        </Code>
      {/if}

    {/if}

  </div>
</aside>
