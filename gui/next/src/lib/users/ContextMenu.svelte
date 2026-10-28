<!--
  user context menu in the users view
-->



<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { clickOutside } from '#lib/helpers/clickOutside.js';

import Delete from '#lib/users/Delete.svelte';

// properties
// ------------------------------------------------------------------------
let {
  // user that the context menu corresponds to (object)
  record,
  // called when the menu should close (function)
  onclose,
  // called when the users list should be loaded again (function)
  onreload
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
      <Delete id={record.id} onsuccess={() => onreload?.()} onclose={() => onclose?.()} />
    </li>
  </ul>
</menu>
