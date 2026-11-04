/*
  loads the request shown in the details panel, from the list already on screen when it
  is there and from the API when it is not (a link to a request that is not in the list)
*/


// imports
// ------------------------------------------------------------------------
import { network } from '#lib/api/network.js';


export const load = async ({ params, fetch, parent }) => {
  const { network: list } = await parent();

  const cached = list?.hits?.find(request => String(request._timestamp) === params.id);
  if(cached){
    return { request: cached };
  }

  const response = await network.getOne(params.id, { fetch });

  return { request: response?.hits?.[0] ?? null };
};
