/*
  loads the records of a table for the view described by the url

  Sorting, filtering, the page and the deleted switch are all in the url (see
  #lib/database/query.js), so changing any of them is a navigation and this runs again.
  SvelteKit applies only the latest navigation, which is what keeps a slow response from
  replacing a newer one. Anything that changes the records calls invalidate('app:records').
*/


// imports
// ------------------------------------------------------------------------
import { error } from '@sveltejs/kit';
import { record } from '#lib/api/record.js';
import { parseQuery } from '#lib/database/query.js';


export const load = async ({ params, url, fetch, depends }) => {
  depends('app:records');

  // the table id is written into the query as it is
  if(!/^\d+$/.test(params.id)){
    error(404, 'Table not found');
  }

  const { filters, sort } = parseQuery(url.searchParams);

  // a filter value that the query cannot be built from (an array filter that is not JSON)
  // shows no records rather than an error page
  const records = await record.get({ table: params.id, filters, sort, deleted: filters.deleted, fetch }).catch(() => null);

  return { filters, sort, records };
};
