<!-- ================================================================== -->
<script>

import { browser } from '$app/environment';
import { serverUrl } from '#lib/api/address.js';
import { connectionState } from '#lib/state/connection.svelte.js';


// properties
// ------------------------------------------------------------------------
// miliseconds between checks (int)
const checkIntervalTime = 7000;



// purpose:		check if the app is connected to the instance every x seconds
// ------------------------------------------------------------------------
$effect(() => {
  checkIfOnline();

  const onlineCheckInterval = setInterval(checkIfOnline, checkIntervalTime);
  return () => clearInterval(onlineCheckInterval);
});

// purpose:		checks if the app is connected to the instance by fetching /info
// effect:		updates the connectionState.online store (bool)
// ------------------------------------------------------------------------
const checkIfOnline = async () => {
  if(browser && document.visibilityState !== 'hidden'){
    fetch(serverUrl('/info')).then(response => response.json()).then(data => {
      if(data){
        connectionState.online = data;
      }
    }).catch(() => {
      connectionState.online = false;
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
{#if connectionState.online === false}
  <div class="connectionIndicator" class:offline={connectionState.online === false}>
    Disconnected from the instance
  </div>
{/if}
