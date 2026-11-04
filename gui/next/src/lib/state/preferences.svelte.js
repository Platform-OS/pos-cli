/*
  UI preferences kept between sessions in localStorage

  usage: import { preferencesState, setView } from '#lib/state/preferences.svelte.js'
*/


// imports
// ------------------------------------------------------------------------
import { browser } from '$app/environment';
import { stored } from '#lib/state/storage.js';


const view = stored('view', null);

const preferencesState = $state({
  // list of items pinned to the header navigation (array of strings)
  header: stored('header', ['database', 'users', 'logs']),
  // type of view for the records ('table' or 'tiles') and how the table cells are shown
  view: {
    database: view?.database ? view.database : 'table',
    tableStyle: view?.tableStyle ? view.tableStyle : 'collapsed'
  },
  // width of the aside panel in css units (string or false)
  asideWidth: stored('asideWidth', false, false)
});


// purpose:		changes the view styles and remembers them
// arguments:	properties of the view to change (object)
// ------------------------------------------------------------------------
const setView = (newView) => {
  preferencesState.view = { ...preferencesState.view, ...newView };

  if(browser){
    try {
      localStorage.view = JSON.stringify(preferencesState.view);
    } catch {
      // not remembered, but the view still changes
    }
  }
};



// exports
// ------------------------------------------------------------------------
export { preferencesState, setView };
