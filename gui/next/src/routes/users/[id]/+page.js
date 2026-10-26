/*
  loads the user shown in the details panel
*/


// imports
// ------------------------------------------------------------------------
import { user } from '#lib/api/user.js';


export const load = async ({ params, fetch, depends }) => {
  depends('app:users');

  const users = await user.get({ attribute: 'id', value: params.id }, { fetch }).catch(() => null);

  return { item: users?.results?.[0] ?? null };
};
