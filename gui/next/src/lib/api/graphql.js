/*
  an interface to call graphql queries against the instance
*/

// imports
// ------------------------------------------------------------------------
// Shared with the CLI and the MCP tools so every surface agrees on what
// "this response failed" means. The module is dependency-free, so vite
// bundles it into this app without pulling anything Node-only in.
import { graphQLErrors } from '../../../../../lib/graph/response.js';
import { serverUrl } from '#lib/api/address.js';



// purpose:		run a graphql query
// arguments:	body of the query (string)
//				options (object), with fetch to use instead of the global one, such as
//				the one a SvelteKit load function receives (function)
// returns:		data returned from the database (object)
// ------------------------------------------------------------------------
const graphql = (body, options) => {
  const fetchFn = options?.fetch ?? fetch;

  const url = serverUrl('/api/graph');

  return fetchFn(url, {
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
    body: JSON.stringify(body)
  })
    .then((res) => res.json())
    .then((res) => {
      const errors = graphQLErrors(res);

      if(errors) {
        errors.forEach(error => {
          console.log(body.query);
          console.info(error);
        });
        return res;
      }

      return res && res.data;
    });
};



// exports
// ------------------------------------------------------------------------
export { graphql };
