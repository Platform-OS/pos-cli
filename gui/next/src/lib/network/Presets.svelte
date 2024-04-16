<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { createEventDispatcher } from 'svelte';
import { onNavigate } from '$app/navigation';

import Icon from '$lib/ui/Icon.svelte';


// properties
// ------------------------------------------------------------------------
// container for the presets (dom node)
let container;
// input with name for new presets to save (dom node)
let newPresetNameInput;

const dispatch = createEventDispatcher();


// purpose:   triggers corresponding actions when keyboard shortcuts are used
// arguments: keyboard event (event)
// ------------------------------------------------------------------------
function handleKayboardShortcuts(event){

  // close popup
  if(event.key === 'Escape'){
    dispatch('close');
  }

  // move down in the list
  else if(event.key === 'ArrowDown'){
    if(container.contains(document.activeElement)){
      event.preventDefault();
      if(document.activeElement.matches('input')){
        container.querySelector('a')?.focus();
      } else {
        document.activeElement?.parentElement?.nextElementSibling?.querySelector('a')?.focus();
      }
    } else {
      container.querySelector('li a').focus();
    }
  }

  // move up in the list
  else if(event.key === 'ArrowUp'){
    if(container.contains(document.activeElement)){
      event.preventDefault();
      if(document.activeElement?.matches('li:first-child a')){
        newPresetNameInput.focus();
      } else {
        document.activeElement?.parentElement?.previousElementSibling?.querySelector('a')?.focus();
      }
    } else {
      container.querySelector('li:last-child a').focus();
    }
  }

  // delete currently highlighted item
  else if(event.key === 'Delete'){
    if(container.contains(document.activeElement) && document.activeElement.matches('a')){
      console.log('Delete item');
    }
  }

};


// purpose:   close popup when user navigates away
// ------------------------------------------------------------------------
onNavigate(() => {
  dispatch('close');
});

</script>


<!-- ================================================================== -->
<style>

/* new preset form */
form {
  margin-block-end: .5em;

  display: flex;
}

form :focus-visible {
  position: relative;
  z-index: 1;
}

input[type="text"] {
  width: 100%;
  padding: .2rem .5rem .3rem;

  border-radius: calc(.5rem - 4px) 0 0  calc(.5rem - 4px);
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

button[type="submit"] {
  display: flex;
  align-items: center;
  padding-inline: .5rem;

  background-color: var(--color-context-input-background);
  border-radius: 0 calc(.5rem - 4px) calc(.5rem - 4px) 0;
}

  button[type="submit"] :global(svg) {
    width: 13px;
    height: 13px;
  }


/* presets list */
li {
  padding-inline-end: calc(var(--space-navigation) / 3);
  display: flex;
  align-items: center;
  justify-content: space-between;

  line-height: 1.1em;
}

  li:hover,
  li:has(a:focus-visible),
  li:has(button:focus-visible) {
    border-radius: calc(.5rem - 4px);
    background-color: var(--color-context-button-background-hover);
  }

a {
  padding: calc(var(--space-navigation) / 2.5) calc(var(--space-navigation) / 1.5);
  flex-grow: 1;
}

/* delete button */
li button {
  width: 15px;
  height: 15px;
  padding: 2px;
  display: flex;
  flex-shrink: 0;

  opacity: 0;
  border-radius: .5em;
}

  li:hover button,
  li:has(button:focus-visible) button,
  li:has(a:focus-visible) button {
    opacity: 1;
  }

  li button :global(svg) {
    width: 100%;
    height: 100%;
  }

  li button:hover {
    background-color: transparent;
    color: var(--color-interaction-hover);
  }

</style>



<!-- ================================================================== -->
<svelte:window on:keydown={handleKayboardShortcuts}></svelte:window>


<div bind:this={container}>
  <form action="">
    <input type="text" placeholder="Save current view" bind:this={newPresetNameInput}>
    <button type="submit">
      <span class="label">Save currently selected filters as new preset</span>
      <Icon icon="plus" />
    </button>
  </form>
  <ul>
    <li>
      <a href="/network?order_by=target_processing_time&order=DESC">Slowest requests</a>
      <button>
        <span class="label">Delete 'Slowest requests' preset</span>
        <Icon icon="x" />
      </button>
    </li>
    <li>
      <a href="/network?aggregate=http_request_path&order_by=avg_target_processing_time&order=DESC">Aggregated slowest requests</a>
      <button>
        <span class="label">Delete 'Aggregated slowest requests' preset</span>
        <Icon icon="x" />
      </button>
    </li>
    <li>
      <a href="/network?order_by=_timestamp&order=DESC&lb_status_codes=400,401,402,403,404,405,406,407,408,409,410,411,412,413,414,415,416,417,418,419,420,420,421,422,423,424,425,426,427,428,429,431,451">Responded with 4∗∗ error</a>
      <button>
        <span class="label">Delete 'Responded with 4** error' preset</span>
        <Icon icon="x" />
      </button>
    </li>
    <li>
      <a href="/network?order_by=_timestamp&order=DESC&lb_status_codes=500,501,502,503,504,505,506,507,508,510,511">Responded with 5∗∗ error</a>
      <button>
        <span class="label">Delete 'Responded with 5** error' preset</span>
        <Icon icon="x" />
      </button>
    </li>
  </ul>
</div>