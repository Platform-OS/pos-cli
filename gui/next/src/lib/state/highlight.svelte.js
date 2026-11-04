/*
  briefly highlights an item that has just been created or changed

  usage: import { highlightState, highlight } from '#lib/state/highlight.svelte.js'
*/


// how long the highlight stays (int)
const duration = 7000;

const highlightState = $state({
  // id of the highlighted record (int or null)
  record: null,
  // name of the highlighted constant (string or null)
  constant: null
});


// purpose:		highlights an item if visible
// arguments:	type of the item ('record' or 'constant')
//				id of the item to highlight (int or string)
// ------------------------------------------------------------------------
let highlightTimeout;

const highlight = (type, id) => {
  highlightState[type] = id;

  clearTimeout(highlightTimeout);
  highlightTimeout = setTimeout(() => {
    highlightState.record = null;
    highlightState.constant = null;
  }, duration);
};



// exports
// ------------------------------------------------------------------------
export { highlightState, highlight };
