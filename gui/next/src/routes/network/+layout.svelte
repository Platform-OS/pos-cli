<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { onMount, tick } from 'svelte';
import { beforeNavigate, afterNavigate } from '$app/navigation';
import { page } from '$app/stores';
import { network } from '$lib/api/network.js';
import { state } from '$lib/state.js';
import { clickOutside } from '$lib/helpers/clickOutside.js';

import Icon from '$lib/ui/Icon.svelte';
import Toggle from '$lib/ui/forms/Toggle.svelte';
import Presets from '$lib/network/Presets.svelte';


// properties
// ------------------------------------------------------------------------
// main content container (dom node)
let container;
// filters form (dom node)
let form;
// todays date (Date object)
const today = new Date();
// how far to the past the logs can be requested (Date object)
const dayInterval = 1000 * 60 * 60 * 24;
const minAllowedDate = new Date(today -  dayInterval * 3);
// input that sets the what field to use to order the results (dom node)
let order_by;
// input that sets the order (dom node)
let order;
// if the results are currently aggregated (bool)
let aggregated = $page.url.searchParams.get('aggregated') ? true : false;
// currently selected status codes (array)
let lb_status_codes = $page.url.searchParams.get('lb_status_codes')?.split(',') || [];
// popup window with the prests list (dom node)
let presetsDialog = false;
// if the presetrs dialog is currently visible (bool)
let presetsDialogActive = false;
// button that toggles the presets popup (dom node)
let presetsToggleButton;


// purpose:   load new logs each time query params change
// arguments: filters to use on the query (object)
// effect:    updates $state.networks
// ------------------------------------------------------------------------
function load(filters){
  if($state.networks.aggs){
    $state.networks.aggs.results = [];
  }
  network.get(filters).then(data => { $state.networks = data; });
}


// purpose:   load data on initial page render
// ------------------------------------------------------------------------
onMount(() => {
  load(Object.fromEntries($page.url.searchParams));
});


// purpose:   reload data when the search params change due to form submit or browser navigation
// ------------------------------------------------------------------------
let previousFilters = $page.url.searchParams.toString();
beforeNavigate(() => {
  previousFilters = $page.url.searchParams.toString();
});

afterNavigate(() => {
  if(previousFilters !== $page.url.searchParams.toString()){
    load(Object.fromEntries($page.url.searchParams));
    previousFilters = $page.url.searchParams.toString();
    lb_status_codes = $page.url.searchParams.get('lb_status_codes')?.split(',') || [];
  }
});


function togglePresetsDialog(event){
  if(!presetsDialog.open){
    presetsDialog.show();
    presetsDialogActive = true;
  } else {
    presetsDialog.close();
    presetsDialogActive = false;
  }
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
  grid-template-columns: min-content 1fr min-content;
  position: relative;
}

.container {
  min-height: 0;
  max-width: 100vw;
  display: grid;
  grid-template-rows: 1fr;
}

.content {
  height: 100%;
  min-height: 0;
  overflow: auto;
}


/* filters */
.filters {
  min-width: 260px;
  padding: var(--space-navigation);
  position: relative;

  border-inline-end: 1px solid var(--color-frame);
}

  .filters header {
    height: 53px;
    margin: calc(var(--space-navigation) * -1);
    margin-block-end: 1rem;
    padding: 0 var(--space-navigation);
    display: flex;
    justify-content: space-between;
    align-items: center;

    border-block-end: 1px solid var(--color-frame);
  }

    .filters header h2 {
      font-weight: 600;
      font-size: 1rem;
    }

  .filters nav > button,
  .filters nav > a {
    padding: .2rem;

    line-height: 0;
    color: var(--color-text-secondary);
  }

    .filters nav > button:hover,
    .filters nav > a:hover {
      background: transparent;

      color: var(--color-interaction-hover);
    }

    .filters nav > .active {
      color: var(--color-context);
    }

    .filters nav > button :global(svg),
    .filters nav > a :global(svg) {
      width: 16px;
      height: 16px;

      pointer-events: none;
    }

    .filters nav .label {
      position: absolute;
      left: -100vw;
    }

  .filters h3 {
    margin-block-end: .2em;
    display: flex;
    align-items: center;
    justify-content: space-between;

    font-weight: 500;
    font-size: .875rem;
  }

    .filters h3 button {
      width: 15px;
      height: 15px;
      padding: 2px;

      border-radius: .5em;

      display: flex;
      align-items: center;
    }

    .filters h3 button :global(svg) {
      width: 100%;
      height: 100%;

      pointer-events: none;
    }

    .filters h3 button:hover {
      color: var(--color-interaction-hover);
    }

  .filters #filters {
    display: flex;
    flex-direction: column;
    gap: var(--space-navigation);
  }

  .filters ul.separated {
    border-radius: .5rem;
    border: 1px solid var(--color-frame);
  }

  .filters ul.separated li {
    padding: calc(var(--space-navigation) / 2);
    padding-inline-start: calc(var(--space-navigation) / 1.5);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .filters ul.separated li:not(:last-child) {
    border-block-end: 1px solid var(--color-frame);
  }

  .filters li label {
    display: flex;
    align-items: center;
    gap: .2em;
    cursor: pointer;
  }

  .filters li small {
    padding: 2px 5px;
    background-color: var(--color-background);
    border-radius: .5em;

    font-family: monospace;
    font-variant-numeric: tabular-nums;
  }

  .filters .presets {
    padding: calc(var(--space-navigation) / 2);
    position: absolute;
    inset-block-start: 3rem;
    inset-inline: calc(var(--space-navigation) / 2);
    z-index: 2;

    border-radius: .5rem;
  }

  .filters .presets:before {
    width: 12px;
    height: 8px;
    position: absolute;
    inset-inline-end: 2.45rem;
    inset-block-start: -7px;

    background-color: var(--color-context);
    clip-path: polygon(50% 0%, 0% 100%, 100% 100%);

    content: '';
  }

  .filters input[type="date"] {
    width: 100%;
  }

  .filters input[name="lb_status_codes"] {
    display: none;
  }

  .filters .toggle {
    padding: calc(var(--space-navigation) / 2);
    padding-inline-start: calc(var(--space-navigation) / 1.5);

    border-radius: .5rem;
    border: 1px solid var(--color-frame);

    line-height: 0;
  }

  .sort > div {
    position: relative;
    display: flex;
    gap: 1px;
  }

  .sort select[name="order_by"] {
    flex-grow: 1;

    border-start-end-radius: 0;
    border-end-end-radius: 0;

    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .sort select[name="order"] {
    width: 50px;
    position: absolute;
    inset-inline-end: 0;
    opacity: 0;
    cursor: pointer;
    z-index: 1;

    overflow: hidden;
    white-space: nowrap;
  }

  .sort label {
    position: relative;

    border-start-start-radius: 0;
    border-end-start-radius: 0;
  }

  .sort select:hover + label {
    background-color: rgba(var(--color-rgb-interaction-hover), .2);
  }

  .sort select:focus-visible + label {
    box-shadow: 0 0 1px 2px var(--color-interaction-hover);
  }


/* content table */
table {
  min-width: 100%;

  line-height: 1.27em;
}

  thead {
    background-color: var(--color-background);
  }

  th {
    white-space: nowrap;
  }

  th,
  td {
    border-block-end: 1px solid var(--color-frame);
  }

  th,
  td > a,
  td > div {
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

  .count {
    text-align: end;
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

  .method {
    padding: .2rem;

    border-radius: 4px;
    border: 1px solid var(--color-frame);

    font-family: monospace;
  }

  .status > a {
    text-align: center;
    font-family: monospace;
    font-size: 1rem;
  }

  .status.success {
    color: var(--color-confirmation);
  }

  .status.error {
    color: var(--color-danger);
  }

  .status.info {
    color: var(--color-interaction);
  }

  .duration {
    text-align: end;
    font-variant-numeric: tabular-nums;
  }

  .highlight td {
    background-color: var(--color-highlight);
  }

  tr {
    position: relative;
  }

  tr:has(a):after {
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
  <title>Logs{$state.online?.MPKIT_URL ? ': ' + $state.online.MPKIT_URL.replace('https://', '') : ''}</title>
</svelte:head>


<div class="page" bind:this={container}>

  <nav class="filters">
    <header>
      <h2>Filters</h2>
      <nav>
        <button type="button" title="Saved filters presets" bind:this={presetsToggleButton} class:active={presetsDialogActive} on:click={togglePresetsDialog}>
          <span class="label">Choose filters preset</span>
          <Icon icon="controlls" />
        </button>
        <a href="/network" title="Reset filters" class="reset">
          <span class="label">Reset</span>
          <Icon icon="disable" />
        </a>
      </nav>
    </header>

    <dialog use:clickOutside={event => presetsDialogActive && event.target !== presetsToggleButton && togglePresetsDialog()} bind:this={presetsDialog} class="presets content-context">
      {#if presetsDialogActive}
        <Presets on:close={togglePresetsDialog} />
      {/if}
    </dialog>

    <form action="" id="filters" bind:this={form}>

      <fieldset class="toggle">
        <Toggle
          name="aggregate"
          options={[{value: 'http_request_path', label: 'Aggregate requests'}]}
          checked={$page.url.searchParams.get('aggregate')}
          on:change={async event => { aggregated = event.target.checked ? true : false; await tick(); order_by.value = event.target.checked ? 'count' : '_timestamp'; console.log(order_by.value); order.value = 'DESC'; await tick(); form.requestSubmit(); }}
        />
      </fieldset>

      <fieldset class="sort">
        <h3>
          <label for="order_by">Sorting</label>
        </h3>
        <div>
          <select name="order_by" id="order_by" bind:this={order_by} on:change={() => form.requestSubmit()}>
              <option selected={$page.url.searchParams.get('order_by') === 'count'} value="count" hidden={!$page.url.searchParams.get('aggregate') && !aggregated}>Count</option>
              <option selected={$page.url.searchParams.get('order_by') === 'http_request_path'} value="http_request_path" hidden={!$page.url.searchParams.get('aggregate') && !aggregated}>Request path</option>
              <option selected={$page.url.searchParams.get('order_by') === 'median_target_processing_time'} value="median_target_processing_time" hidden={!$page.url.searchParams.get('aggregate') && !aggregated}>Processing time</option>

              <option selected={$page.url.searchParams.get('order_by') === '_timestamp' || !$page.url.searchParams.get('order_by') && !$page.url.searchParams.get('aggregate')} value="_timestamp" hidden={$page.url.searchParams.get('aggregate') || aggregated}>Time</option>
              <option selected={$page.url.searchParams.get('order_by') === 'http_request_path'} value="http_request_path" hidden={$page.url.searchParams.get('aggregate') || aggregated}>Request path</option>
              <option selected={$page.url.searchParams.get('order_by') === 'target_processing_time'} value="target_processing_time" hidden={$page.url.searchParams.get('aggregate') || aggregated}>Processing Time</option>
          </select>

          <select name="order" id="order" bind:this={order} on:change={() => form.requestSubmit()}>
            <option value="DESC" selected={$page.url.searchParams.get('order') === 'DESC'}>DESC [Z→A]</option>
            <option value="ASC" selected={$page.url.searchParams.get('order') === 'ASC'}>ASC [A→Z]</option>
          </select>

          <label for="order" class="button">
            {#if $page.url.searchParams.get('order') === 'DESC' || !$page.url.searchParams.get('order')}
              <Icon icon="sortZA" />
            {:else}
              <Icon icon="sortAZ" />
            {/if}
          </label>
        </div>
      </fieldset>

      <fieldset>
        <h3>
          <label for="start_time">Time limit</label>
        </h3>
        <input
          type="date"
          name="start_time"
          id="start_time"
          min={minAllowedDate.toISOString().split('T')[0]}
          max={today.toISOString().split('T')[0]}
          value={$page.url.searchParams.get('start_time') || today.toISOString().split('T')[0]}
          on:input={form.requestSubmit()}
        >
      </fieldset>

      <fieldset>
        <h3>Status Code</h3>
        <input
          type="text"
          name="lb_status_codes"
          bind:value={lb_status_codes}
        >

        {#if $state.networks?.aggs?.filters}
          <ul class="separated">
            {#each $state.networks.aggs.filters as status}
              <li>
                <label>
                  <input
                    form="none"
                    type="checkbox"
                    value={status.lb_status_code.toString()}
                    bind:group={lb_status_codes}
                    on:change={() => { form.requestSubmit(); }}
                  >
                  {status.lb_status_code}
                </label>
                <small>{status.count}</small>
              </li>
            {/each}
          </ul>
        {/if}
      </fieldset>

    </form>
  </nav>


  <section class="container">

      <article class="content">
        <table>
          <thead>
            <tr>
              {#if $page.url.searchParams.get('aggregate')}
                <th>
                  Count
                </th>
              {:else}
                <th>Time</th>
                <th>Status</th>
              {/if}
              <th>
                {$page.url.searchParams.get('aggregate') == 'http_request_path' ? 'Aggregated ' : ''}Request{$page.url.searchParams.get('aggregate') == 'http_request_path' ? 's' : ''}
              </th>
              <th class="duration">
                Processing Time
              </th>
            </tr>
          </thead>
          {#if $state.networks?.aggs?.results}
            <tbody>
              {#each $state.networks.aggs.results as log}
                <tr
                  class:active={log._timestamp && $page.params.id == log._timestamp}
                >
                  {#if $page.url.searchParams.get('aggregate')}
                    <td class="count">
                      <div>
                        {log.count}
                      </div>
                    </td>
                  {:else}
                    <td class="time">
                      <a href="/network/{log._timestamp}?{$page.url.searchParams.toString()}">
                        {new Date(log._timestamp / 1000).toLocaleString()}
                      </a>
                    </td>
                    <td
                      class="status"
                      class:success={log.lb_status_code >= 200 && log.lb_status_code < 300}
                      class:info={log.lb_status_code >= 300 && log.lb_status_code < 400}
                      class:error={log.lb_status_code >= 400 && log.lb_status_code < 600}
                    >
                      <a href="/network/{log._timestamp}?{$page.url.searchParams.toString()}">
                        {log.lb_status_code}
                      </a>
                    </td>
                  {/if}
                  <td class="request">
                    {#if !$page.url.searchParams.get('aggregate')}
                      <a href="/network/{log._timestamp}?{$page.url.searchParams.toString()}">
                        <div>
                          <span class="method">{log.http_request_method}</span> {log.http_request_path}
                        </div>
                      </a>
                    {:else}
                      <div>
                        <span class="method">{log.http_request_method}</span> {log.http_request_path}
                      </div>
                    {/if}
                  </td>
                  <td class="duration">
                    {#if !$page.url.searchParams.get('aggregate')}
                      <a href="/network/{log._timestamp}?{$page.url.searchParams.toString()}">
                        {Math.round((parseFloat(log.target_processing_time) + Number.EPSILON) * 1000) / 1000}s
                      </a>
                    {:else}
                      <div title="Median: {Math.round((parseFloat(log.median_target_processing_time) + Number.EPSILON) * 1000) / 1000}s &#10;&#13;Mean: {Math.round((parseFloat(log.avg_target_processing_time) + Number.EPSILON) * 1000) / 1000}s &#10;&#13;Min: {Math.round((parseFloat(log.min_target_processing_time) + Number.EPSILON) * 1000) / 1000}s &#10;&#13;Max: {Math.round((parseFloat(log.max_target_processing_time) + Number.EPSILON) * 1000) / 1000}s">
                        {Math.round((parseFloat(log.median_target_processing_time) + Number.EPSILON) * 1000) / 1000}s
                      </div>
                    {/if}
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
