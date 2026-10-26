/*
  notifications shown in the bottom corner

  usage: import { notificationsState } from '#lib/state/notifications.svelte.js' and then
  notificationsState.create('success', 'Record 1 created')
*/


// how long success and info notifications stay visible (int)
const timeout = 7000;

const list = $state([]);


// purpose:		creates new notification, removed by itself unless it is an error
// arguments:	notification type ('success', 'error', 'info')
//				notification text message for the user (string)
// ------------------------------------------------------------------------
const create = (type, message) => {
  const id = Date.now();

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
