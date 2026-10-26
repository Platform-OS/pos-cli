/*
  the user being created or edited

  usage: import { usersState } from '#lib/state/users.svelte.js'
  (not `user`, which is the API module)
*/


const usersState = $state({
  // user being edited, {} when creating a new one, undefined when the form is closed
  user: undefined
});



// exports
// ------------------------------------------------------------------------
export { usersState };
