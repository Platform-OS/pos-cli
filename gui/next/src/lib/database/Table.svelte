<!--
  table view for records
-->



<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { state } from '$lib/state.js';
import { parseValue } from '$lib/parseValue.js'

import Icon from '$lib/ui/Icon.svelte';
import ContextMenu from '$lib/database/ContextMenu.svelte';
import JSONTree from '$lib/ui/JSONTree.svelte';


// properties
// ------------------------------------------------------------------------
// the extended menu for editing an record
let contextMenu = {
  // item id for which the context menu is opened for
  id: null
};

</script>


<!-- ================================================================== -->
<style>

table {
  min-width: 100%;
}

thead {
  position: sticky;
  top: 0;
  z-index: 50;
}

th {
  background-color: var(--color-background);

  white-space: nowrap;
  font-weight: 500;
}

  .type {
    font-weight: 400;
    color: var(--color-text-secondary);
  }

td, th {
  padding: .6rem;
  vertical-align: top;

  border: 1px solid var(--color-frame);

  transition: background-color .2s linear;
}

  .collapsed td {
    max-width: 300px;
    overflow: hidden;
    vertical-align: middle;

    white-space: nowrap;
    text-overflow: ellipsis;
  }

  td:first-child, th:first-child {
    width: 4rem;
    position: sticky;
    left: 0;
    z-index: 10;

    border-inline-start: 0;
    box-shadow: inset -4px 0 0 0 var(--color-frame);
  }

  td:first-child {
    overflow: visible;

    background-color: var(--color-page);
  }

  th.id {
    text-align: end;
  }

  td .id {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: .7em;
  }

  .date span {
    color: var(--color-text-secondary);
  }

.highlighted td {
  background-color: var(--color-highlight);
}

.hasContextMenu {
  position: relative;
  z-index: 20;
}

.value-null {
  text-transform: uppercase;
  font-size: .9em;
  color: var(--color-text-secondary);
}

.combo {
  background-color: transparent;
  opacity: 0;

  transition: opacity .1s linear;
}

  .combo .button:first-child {
    padding-inline: .1rem 0;
  }

  tr:hover .combo {
    opacity: .5;
  }

  tr:hover .combo:hover {
    opacity: 1;
  }

  tr:hover .combo .button:not(.active):hover {
    background-color: var(--color-background);
  }

  .combo .button.active {
    background-color: var(--color-context);
    color: var(--color-text-inverted);
  }

  .combo .button.active:hover :global(svg) {
    color: var(--color-text-inverted);
  }

  tr:has(.active) .combo {
    opacity: 1;
  }

  tr:has(.active) .combo button:first-child {
    border-end-start-radius: 0;
  }


.delete {
  width: 50px;
}

</style>



<!-- ================================================================== -->
{#if $state.table?.properties}
  <table class={$state.view.tableStyle}>
    <thead>
      <tr>
        <th class="id">id</th>
          {#each $state.table.properties as property}
            <th>{property.name} <small class="type">({property.attribute_type})</small></th>
          {/each}
        <th>created at</th>
        <th>updated at</th>
        {#if $state.filters.deleted === 'true'}
          <th>deleted at</th>
        {/if}
      </tr>
    </thead>
    {#if $state.records?.results?.length}
      {#each $state.records?.results as record (record.id)}
        <tr class:highlighted={$state.highlighted.record === record.id} class:hasContextMenu={contextMenu.id === record.id}>
          <td>
            <div class="id">
              <div class="combo">
                <button class="button compact more" class:active={contextMenu.id === record.id} on:click={() => contextMenu.id = record.id}>
                  <span class="label">More options</span>
                  <Icon icon="navigationMenuVertical" size="16" />
                </button>
                <button class="button compact edit" title="Edit record" on:click={() => { $state.record = record; }}>
                  <span class="label">Edit record</span>
                  <Icon icon="pencil" size="16" />
                </button>
              </div>
              {#if contextMenu.id === record.id}
                <ContextMenu record={record} on:close={() => contextMenu.id = null} />
              {/if}
              {record.id}
            </div>
          </td>
          {#each $state.table.properties as property}
            {@const value = parseValue(record.properties[property.name], property.attribute_type)}
            <td class:value-null={value.type === 'null'}>
              {#if value.value !== undefined}
                {#if value.type === 'json' || value.type === 'jsonEscaped'}
                  {#if $state.view.tableStyle === 'expanded'}
                    <JSONTree value={value.value} />
                  {:else}
                    {JSON.stringify(value.value)}
                  {/if}
                {:else}
                  {value.value}
                {/if}
              {/if}
            </td>
          {/each}
          <td class="date">
            {(new Date(record?.created_at)).toLocaleDateString(undefined, {})}
            <span>{(new Date(record?.created_at)).toLocaleTimeString(undefined, {})}</span>
          </td>
          <td class="date">
            {(new Date(record?.updated_at)).toLocaleDateString(undefined, {})}
            <span>{(new Date(record?.updated_at)).toLocaleTimeString(undefined, {})}</span>
          </td>
          {#if $state.filters.deleted === 'true'}
            <td class="date">
              {(new Date(record?.deleted_at)).toLocaleDateString(undefined, {})}
              <span>{(new Date(record?.deleted_at)).toLocaleTimeString(undefined, {})}</span>
            </td>
          {/if}
        </tr>
      {/each}
    {/if}
  </table>
{/if}
