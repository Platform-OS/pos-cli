<!--
  record context mnue in the database view
-->



<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { createEventDispatcher } from 'svelte';
import { clickOutside } from '$lib/helpers/clickOutside.js';

import Delete from '$lib/users/Delete.svelte';

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
      <Delete id={record.id} on:success={() => dispatch('reload')} on:close={() => dispatch('close')} />
    </li>
  </ul>
</menu>
