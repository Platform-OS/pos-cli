<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { fade } from 'svelte/transition';
import { afterUpdate } from 'svelte';
import { state } from '$lib/state';

import Icon from '$lib/ui/Icon.svelte';
import ConnectionIndicator from '$lib/ui/ConnectionIndicator.svelte';

let height = 0;

afterUpdate(() => {
  $state.notifications.forEach(notification => {
    if(!notification.timeout){
      if(notification.type === 'success' || notification.type === 'info'){
        notification.timeout = setTimeout(() => state.notification.remove(notification.id), 7000);
      }
    }
  });
});

</script>


<!-- ================================================================== -->
<style>

.container {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  position: fixed;
  top: 100%;

  translate: 0 var(--height);

  transition: translate .2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.notification {
  margin-block-start: .5rem;
  padding: .7rem 2rem .8rem 1.5rem;
  display: flex;
  gap: 1em;
  align-items: center;
  position: relative;

  border-radius: 1rem;

  color: var(--color-text-inverted);
}

  .success {
    background-color: var(--color-confirmation);
  }

  .error {
    background-color: var(--color-danger);
  }

  .info {
    background-color: var(--color-text);
  }

  .disabled {
    display: none;
  }

.notification :global(small) {
  margin-block-start: .25em;
  display: block;

  font-size: .85em;
}

.notification :global(code) {
  padding-inline: .2em;

  border-radius: 4px;
  background-color: var(--color-context);

  font-family: monospace;
  font-size: 1.2em;
}


button {
  padding: .6em;
  margin: -.6em -1.5em -.6em 0;

  cursor: pointer;

  line-height: 0;
}

button:hover {
  color: var(--color-highlight);
}

</style>



<!-- ================================================================== -->
<div class="container" bind:clientHeight={height} aria-live="assertive" style="--height: -{height}px">

  {#each $state.notifications as notification (notification.id)}
    <div
      class="notification"
      class:success={notification.type === 'success'}
      class:error={notification.type === 'error'}
      class:info={notification.type === 'info'}
      transition:fade={{ duration: 100 }}
    >
      {@html notification.message}

      <button on:click={() => state.notification.remove(notification.id)}>
        <Icon icon="x" size="10" />
      </button>
    </div>
  {/each}

  <div
    class="notification error"
    class:disabled={$state.online !== false}
    transition:fade={{ duration: 100 }}
  >
    <ConnectionIndicator />
  </div>

</div>
