/*
  whether the GUI can reach the instance through `pos-cli gui serve`

  usage: import { connectionState } from '#lib/state/connection.svelte.js'
*/


const connectionState = $state({
  // instance info from /info when connected, false when the check failed,
  // undefined before the first check (object, false or undefined)
  online: undefined
});



// exports
// ------------------------------------------------------------------------
export { connectionState };
