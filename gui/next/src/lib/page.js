/*
  the current page as a store, for components written with the legacy `$:` syntax

  usage: import { page } from '#lib/page.js' and then read $page.url, $page.params…

  SvelteKit 3 removed $app/stores, and a `$:` statement does not re-run when a field of
  `page` from $app/state changes, so reading that directly would stop the views reloading
  on navigation. Every field is read here, so the store emits whenever any of them changes.
*/


// imports
// ------------------------------------------------------------------------
import { page as current } from '$app/state';
import { toStore } from 'svelte/store';


const page = toStore(() => ({
  data: current.data,
  error: current.error,
  form: current.form,
  params: current.params,
  route: current.route,
  state: current.state,
  status: current.status,
  url: current.url
}));


export { page };
