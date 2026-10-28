/*
  logs kept between visits to the logs pages

  usage: import { logsState } from '#lib/state/logs.svelte.js'
  (not `logs`, which is the API module)
*/


const logsState = $state({
  // logs data (object)
  logs: {}
});



// exports
// ------------------------------------------------------------------------
export { logsState };
