/*
  loads the background jobs list for the type and page in the url

  The list stays on screen while a job is open, so it is loaded by the layout. Only the
  query string is read here, so opening a job (a different path, the same query) does not
  load the list again, while changing the type or page is a navigation that does.
  SvelteKit applies only the latest navigation, so a slow response can no longer replace a
  newer one. Retrying or deleting a job calls invalidate('app:backgroundJobs').
*/


// imports
// ------------------------------------------------------------------------
import { backgroundJob } from '#lib/api/backgroundJob.js';


// the job types the list can show, the first one by default (array)
const types = ['SCHEDULED', 'DEAD', 'RUNNING'];


export const load = async ({ url, fetch, depends }) => {
  depends('app:backgroundJobs');

  const page = parseInt(url.searchParams.get('page'));
  const filters = {
    page: page > 0 ? page : 1,
    type: types.includes(url.searchParams.get('type')) ? url.searchParams.get('type') : types[0]
  };

  const jobs = await backgroundJob.get(filters, { fetch }).catch(() => null);

  return { filters, jobs };
};
