<!--
  record context mnue in the database view
-->



<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { createEventDispatcher } from 'svelte';
import { clickOutside } from '$lib/helpers/clickOutside.js';
import { state } from '$lib/state.js';

import Delete from '$lib/database/Delete.svelte';
import Restore from '$lib/database/Restore.svelte';
import Icon from '$lib/ui/Icon.svelte';

// properties
// ------------------------------------------------------------------------
// record that the context menu corresponds to (object)
export let record;
// event dispatcher
const dispatch = createEventDispatcher();


// purpose:   handles closing the context menu with Esc
// effect:    dispatches a 'close' event to parent component
// ------------------------------------------------------------------------
const keyboardShortcut = event => {
  if(event.key === 'Escape'){
    dispatch('close');
  }
};

</script>


<!-- ================================================================== -->
<style>

/* extended menu */
menu {
  position: absolute;
  left: 0;
  top: 100%;
  z-index: 20;
  overflow: hidden;

  border-radius: 0 1rem 1rem;
  white-space: nowrap;
}

menu li + li {
  border-block-start: 1px solid var(--color-context-input-background);
}

menu :global(button) {
  width: 100%;
  padding: .5rem 1rem;
  display: flex;
  align-items: center;
  gap: .5em;
  line-height: 0;
}

menu :global(button:hover) {
  background-color: var(--color-context-button-background-hover);
}

menu li:last-child :global(button) {
  padding-block-end: .6rem;
}

</style>



<!-- ================================================================== -->
<svelte:window on:keyup={keyboardShortcut} />

<menu class="content-context" use:clickOutside={() => dispatch('close')}>
  <ul>
    <li>
      <button type="button" on:click={() => { dispatch('close'); $state.record = {...record}; $state.record.id = null; } }>
        <Icon icon="copy" size="22" />
        Copy record
      </button>
    </li>
    <li>
      {#if $state.filters.deleted === 'true'}
        <Restore table={$state.table} id={record.id} on:success={() => dispatch('close')} />
      {:else}
        <Delete table={$state.table} id={record.id} on:success={() => dispatch('close')} />
      {/if}
    </li>
  </ul>
</menu>
