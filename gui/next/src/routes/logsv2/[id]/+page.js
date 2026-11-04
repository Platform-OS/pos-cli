/*
  loads the log shown in the details panel, from the list already on screen when it is
  there and from the API when it is not (a link to a log that is on another page)
*/


// imports
// ------------------------------------------------------------------------
import { logs } from '#lib/api/logsv2.js';


export const load = async ({ params, fetch, parent }) => {
  const { logs: list } = await parent();

  const cached = list?.hits?.find(log => String(log._timestamp) === params.id);
  if(cached){
    return { log: cached };
  }

  const response = await logs.getOne(params.id, { fetch });

  return { log: response?.hits?.[0] ?? null };
};
