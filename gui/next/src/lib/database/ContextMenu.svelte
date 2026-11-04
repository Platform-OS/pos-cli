<!--
  record context mnue in the database view
-->



<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { clickOutside } from '#lib/helpers/clickOutside.js';
import { databaseState } from '#lib/state/database.svelte.js';

import Delete from '#lib/database/Delete.svelte';
import Restore from '#lib/database/Restore.svelte';
import Icon from '#lib/ui/Icon.svelte';

// properties
// ------------------------------------------------------------------------
let {
  // record that the context menu corresponds to (object)
  record,
  // if the record is a deleted one (bool)
  deleted = false,
  // called when the menu should close (function)
  onclose
} = $props();


// purpose:   handles closing the context menu with Esc
// effect:    calls onclose
// ------------------------------------------------------------------------
const keyboardShortcut = event => {
  if(event.key === 'Escape'){
    onclose?.();
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
<svelte:window onkeyup={keyboardShortcut} />

<menu class="content-context" use:clickOutside={() => onclose?.()}>
  <ul>
    <li>
      <button type="button" onclick={() => { onclose?.(); databaseState.record = {...record}; databaseState.record.id = null; } }>
        <Icon icon="copy" size="22" />
        Copy record
      </button>
    </li>
    <li>
      {#if deleted}
        <Restore table={databaseState.table} id={record.id} onsuccess={() => onclose?.()} />
      {:else}
        <Delete table={databaseState.table} id={record.id} onsuccess={() => onclose?.()} />
      {/if}
    </li>
  </ul>
</menu>
