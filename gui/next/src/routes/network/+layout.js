/*
  loads the requests log for the filters and sorting in the url

  The list stays on screen while a request is open, so it is loaded by the layout. Only
  the query string is read here, so opening a request (a different path, the same query)
  does not load the list again. SvelteKit applies only the latest navigation, so a slow
  response can no longer replace a newer one.
*/


// imports
// ------------------------------------------------------------------------
import { network } from '#lib/api/network.js';


export const load = async ({ url, fetch }) => {
  // network.get checks each value before it reaches the query
  const filters = Object.fromEntries(url.searchParams);

  const results = await network.get(filters, { fetch });

  return { network: results };
};
