/*
  store that handles all the state and data related objects

  usage: import { state } from '$lib/state.js' and then use
  the methods provided in the return statement for navigating through
  the state.
*/


// imports
// ------------------------------------------------------------------------
import { browser } from '$app/environment';
import { writable } from 'svelte/store';


const state = createStore();

function createStore(){

  // read local storage values
  // ------------------------------------------------------------------------
  const view = browser && localStorage.view ? JSON.parse(localStorage.view) : null;

  // store properties
  // ------------------------------------------------------------------------
  const state = {};
    // list of items pinned to the header navigation (array of strings)
    state.header = browser && localStorage.header ? JSON.parse(localStorage.header) : ['database', 'users', 'logs'];
    // if the app is connected to the instance (bool)
    state.online = undefined;
    // logs data (object)
    state.logs = {};
    // tables for current instance (array)
    state.tables = [];
    // currently active table (object)
    state.table = {};
    // type of view for the records ('table' or 'tiles')
    state.view = {
      database: view?.database ? view.database : 'table',
      tableStyle: view?.tableStyle ? view.tableStyle : 'collapsed'
    };
    // currently viewed records list (object)
    state.records = {};
    // currently viewed/edited record (object)
    state.record = null;
    // currently highlighted ids (object)
    state.highlighted = {
      record: null,
      constant: null
    };
    // filters for the records (object)
    state.filters = {
      page: 1,
      attributes: [
        { attribute_type: 'id', name: 'id', operation: 'value', value: '' }
      ]
    };
    // list of notifications (array of objects)
    state.notifications = [];
    // width of the aside panel in css units (string)
    state.asideWidth = browser && localStorage.asideWidth ? localStorage.asideWidth : '30%';



  // purpose:		creates the store with data provided in state object
  // ------------------------------------------------------------------------
  const { subscribe, set, update } = writable(state);


  // purpose:		updates the store properties
  // arguments:	name of the property you want to update (string)
  //				new value (any)
  // ------------------------------------------------------------------------
  const data = (property, value) => {
    update(state => {
      state[property] = value;

      return state;
    });
  };


  // purpose:		clears all the filters
  // ------------------------------------------------------------------------
  const clearFilters = () => {
    update(state => {
      state.filters = {
        page: 1,
        attributes: [
          { attribute_type: 'id', name: 'id', operation: 'value', value: '' }
        ]
      };

      return state;
    });
  };


  // purpose:		highlights an record if visible
  // arguments:	type of data to highlight ('record')
  //				id of the element to highlight (int)
  // ------------------------------------------------------------------------
  let highlightTimeout;

  const highlight = (type, id) => {
    update(state => {
      state.highlighted[type] = id;

      return state;
    });

    clearTimeout(highlightTimeout);
    highlightTimeout = setTimeout(() => { highlight('record', null); highlight('constant', null) }, 7000);
  };


  // purpose:		manages notifications
  // ------------------------------------------------------------------------
  const notification = {

    // purpose:		creates new notification
    // arguments:	notification type ('success', 'error')
    //				notification text message for the user (string)
    // ------------------------------------------------------------------------
    create: (type, message) => {
      update(state => {
        state.notifications.push({id: Date.now(), type: type, message: message});

        return state;
      });
    },

    // purpose:		removes a notification from the view
    // arguments:	id of the notification in array (int)
    // ------------------------------------------------------------------------
    remove: (id) => {
      update(state => {
        state.notifications = state.notifications.filter(notification => notification.id !== id);

        return state;
      });
    },

  };


  // purpose:		manages the view styles
  // arguments:	new view
  // ------------------------------------------------------------------------
  const setView = (newView) => {
    update(state => {
      state.view = {...state.view, ...newView}

      if(browser){
        localStorage.view = JSON.stringify(state.view);
      }

      return state;
    });
  };



  return {
    subscribe,
    set,
    data,
    clearFilters,
    highlight,
    notification,
    setView
  }

};



// exports
// ------------------------------------------------------------------------
export { state }
