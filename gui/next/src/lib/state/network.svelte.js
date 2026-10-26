/*
  network logs kept between visits to the network page

  usage: import { networkState } from '#lib/state/network.svelte.js'
  (not `network`, which is the API module)
*/


const networkState = $state({
  // network logs data (object)
  networks: {},
  // currently active network log (object)
  network: {}
});



// exports
// ------------------------------------------------------------------------
export { networkState };
