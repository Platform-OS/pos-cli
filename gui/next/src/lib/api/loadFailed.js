/*
  what a load function gives its page when the query for it failed

  the page shows an empty list for null, the same as for no results, so a query the instance
  answered with errors is also reported; a request that never reached the instance is not, since
  the connection indicator already says the instance cannot be reached
*/


// imports
// ------------------------------------------------------------------------
import { GraphQLError } from '#lib/api/graphql.js';
import { notificationsState } from '#lib/state/notifications.svelte.js';



// purpose:		the catch handler for a load function's query
// arguments:	what was being loaded, for the message (string)
// returns:		a handler that reports a GraphQLError and resolves with null (function)
// ------------------------------------------------------------------------
const loadFailed = (what) => (error) => {
  if(error instanceof GraphQLError){
    notificationsState.create('error', `Could not load ${what}: ${error.message}`);
  }

  return null;
};



// exports
// ------------------------------------------------------------------------
export { loadFailed };
