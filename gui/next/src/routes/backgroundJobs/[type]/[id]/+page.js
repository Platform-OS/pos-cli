/*
  loads the background job shown in the details panel
*/


// imports
// ------------------------------------------------------------------------
import { backgroundJob } from '#lib/api/backgroundJob.js';
import { loadFailed } from '#lib/api/loadFailed.js';


export const load = async ({ params, fetch, depends }) => {
  depends('app:backgroundJobs');

  const jobs = await backgroundJob.get({ id: params.id, type: params.type.toUpperCase() }, { fetch }).catch(loadFailed('the background job'));

  return { item: jobs?.results?.[0] ?? null };
};
