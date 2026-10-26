/*
  loads the users list for the filter and page in the url

  The list stays on screen while a user is open, so it is loaded by the layout. Only the
  query string is read here, so opening a user (a different path, the same query) does not
  load the list again, while changing the filter or page is a navigation that does.
  SvelteKit applies only the latest navigation, so a slow response can no longer replace a
  newer one. Anything that changes users calls invalidate('app:users').
*/


// imports
// ------------------------------------------------------------------------
import { user } from '#lib/api/user.js';


export const load = async ({ url, fetch, depends }) => {
  depends('app:users');

  const page = parseInt(url.searchParams.get('page'));
  const filters = {
    page: page > 0 ? page : 1,
    attribute: url.searchParams.get('attribute') === 'id' ? 'id' : 'email',
    value: url.searchParams.get('value') ?? ''
  };

  const users = await user.get(filters, { fetch }).catch(() => null);

  return { filters, users };
};
