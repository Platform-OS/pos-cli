<!-- ================================================================== -->
<script>

import { onMount } from 'svelte';
import { browser } from '$app/environment';
import { state } from '$lib/state';


// properties
// ------------------------------------------------------------------------
// miliseconds between checks (int)
let checkIntervalTime = 7000;



// purpose:		check if the app is connected to the instance every x seconds
// ------------------------------------------------------------------------
let onlineCheckInterval;

onMount(async () => {
  checkIfOnline();

  onlineCheckInterval = setInterval(checkIfOnline, checkIntervalTime);
  return () => clearInterval(onlineCheckInterval);
});

// purpose:		checks if the app is connected to the instance by fetching /info
// effect:		updates the $state.online store (bool)
// ------------------------------------------------------------------------
const checkIfOnline = async () => {
  if(browser && document.visibilityState !== 'hidden'){
    const url = (typeof window !== 'undefined' && window.location.port !== '4173' && window.location.port !== '5173') ? `http://localhost:${parseInt(window.location.port)}` : 'http://localhost:3333';

    fetch(`${url}/info`).then(response => response.json()).then(data => {
      if(data){
        $state.online = true;
        return true;
      }
    }).catch(e => {
      $state.online = false;
      return false;
    });
  }
};

</script>



<!-- ================================================================== -->
<style>

.connectionIndicator {
  display: flex;
  align-items: center;
  gap: 1em;
}

.connectionIndicator:after {
  width: .8rem;
  height: .8rem;
  margin-inline-end: -.5em;
  display: block;
  position: relative;
  top: 1px;

  border-radius: 100%;
  background-color: var(--color-text-inverted);

  animation: blink .7s ease-in-out;
  animation-iteration-count: infinite;

  content: '';
}

@keyframes blink {
  0% {
    opacity: .2;
  }

  70% {
    opacity: 1;
  }
}

</style>



<!-- ================================================================== -->
{#if $state.online === false}
  <div class="connectionIndicator" class:offline={$state.online === false}>
    Disconnected from the instance
  </div>
{/if}
