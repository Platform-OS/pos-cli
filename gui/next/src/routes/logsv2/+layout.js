/*
  loads the logs for the date, search and page in the url

  The list stays on screen while a log is open, so it is loaded by the layout. Only the
  query string is read here, so opening a log (a different path, the same query) does not
  load the list again. SvelteKit applies only the latest navigation, so a slow response
  can no longer replace a newer one.
*/


// imports
// ------------------------------------------------------------------------
import { logs } from '#lib/api/logsv2.js';


export const load = async ({ url, fetch }) => {
  const page = parseInt(url.searchParams.get('page'));
  const filters = {
    page: page > 0 ? page : 1,
    start_time: url.searchParams.get('start_time') ?? '',
    message: url.searchParams.get('message') ?? ''
  };

  const results = await logs.get(filters, { fetch });

  return { filters, logs: results };
};
