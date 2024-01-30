<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { page } from '$app/stores';
import { backgroundJob } from '$lib/api/backgroundJob.js';

import Aside from '$lib/ui/Aside.svelte';
import Code from '$lib/ui/Code.svelte';
import JSONTree from '$lib/ui/JSONTree.svelte';


// properties
// ------------------------------------------------------------------------
// background jobs (object)
let item = {};

// get background job details
const load = async () => {
  await backgroundJob.get({ id: $page.params.id, type: $page.params.type.toUpperCase() }).then(response => { response.results.length ? item = response.results[0] : item = null; });
};

$: $page.params.id && load($page.params.id);

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
  margin-block-start: 2rem;
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

.error {
  color: var(--color-danger);
}

code {
  padding: 1rem 1.5rem;
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

<Aside title={item.source_name || item.id || 'Loading…'} closeUrl="/backgroundJobs?{$page.url.searchParams.toString()}">

  {#if item === null}

    There is no such background job

  {:else}

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
          <dd>{(new Date(item.run_at)).toLocaleString()}</dd>
        </div>
        {#if item.dead_at}
          <div>
            <dt>Dead at:</dt>
            <dd class="error">{(new Date(item.dead_at)).toLocaleString()}</dd>
          </div>
        {/if}
        {#if item.arguments.url}
          <div>
            <dt>URL:</dt>
            <dd>{item.arguments.context.location.href || '/'}</dd>
          </div>
        {/if}
      {/if}
    </dl>

    {#if item.error_message}
      <h2>Error message</h2>
      <code>
        {item.error_message}
      </code>
    {/if}

    {#if item.liquid_body}
      <h2>Background job code:</h2>
      <Code language="liquid">
        {item.liquid_body}
      </Code>
    {/if}

    {#if item.partial_name}
      <h2>Background function name:</h2>
      <Code>
        {item.partial_name}
      </Code>
    {/if}

    {#if item.arguments}
      <h2>Arguments</h2>
      <code>
        <JSONTree value={item.arguments} expandedLines={1} showFullLines={true} />
      </code>
    {/if}

  {/if}

</Aside>
