/*
  notifications shown in the bottom corner

  usage: import { notificationsState } from '#lib/state/notifications.svelte.js' and then
  notificationsState.create('success', 'Record 1 created')
*/


// how long success and info notifications stay visible (int)
const timeout = 7000;

const list = $state([]);
// the id the next notification gets; a counter, since two notifications can be created in the
// same millisecond and the list is keyed by id (int)
let nextId = 1;


// purpose:		creates new notification, removed by itself unless it is an error
// arguments:	notification type ('success', 'error', 'info')
//				message for the user, shown as text; a snippet when it needs markup
//				(string or snippet)
// ------------------------------------------------------------------------
const create = (type, message) => {
  const id = nextId++;

  list.push({ id, type, message });

  if(type === 'success' || type === 'info'){
    setTimeout(() => remove(id), timeout);
  }
};


// purpose:		removes a notification from the view
// arguments:	id of the notification (int)
// ------------------------------------------------------------------------
const remove = (id) => {
  const index = list.findIndex(notification => notification.id === id);

  if(index > -1){
    list.splice(index, 1);
  }
};


const notificationsState = {
  get list(){ return list; },
  create,
  remove
};



// exports
// ------------------------------------------------------------------------
export { notificationsState };
