<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { page } from '$app/state';

import Aside from '#lib/ui/Aside.svelte';
import Code from '#lib/ui/Code.svelte';
import JSONTree from '#lib/ui/JSONTree.svelte';


// properties
// ------------------------------------------------------------------------
let {
  // the background job, or null when there is no such job, from +page.js (object)
  data
} = $props();
// background job (object) or null
let item = $derived(data.item);

</script>


<!-- ================================================================== -->
<style>

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



<Aside title={item?.source_name || item?.id || 'No such background job'} closeUrl="/backgroundJobs?{page.url.searchParams.toString()}">

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
      <Code language="liquid" code={item.liquid_body} />
    {/if}

    {#if item.partial_name}
      <h2>Background function name:</h2>
      <code>
        {item.partial_name}
      </code>
    {/if}

    {#if item.arguments}
      <h2>Arguments</h2>
      <code>
        <JSONTree value={item.arguments} expandedLines={1} showFullLines={true} />
      </code>
    {/if}

  {/if}

</Aside>
