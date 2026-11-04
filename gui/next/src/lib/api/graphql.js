/*
  an interface to call graphql queries against the instance
*/

// imports
// ------------------------------------------------------------------------
// Shared with the CLI and the MCP tools so every surface agrees on what
// "this response failed" means. The module is dependency-free, so vite
// bundles it into this app without pulling anything Node-only in.
import { graphQLErrors, formatGraphQLErrors } from '../../../../../lib/graph/response.js';
import { serverUrl } from '#lib/api/address.js';



// purpose:		a query the instance answered with errors
// ------------------------------------------------------------------------
class GraphQLError extends Error {
  constructor(errors){
    super(formatGraphQLErrors(errors));
    this.name = 'GraphQLError';
    this.errors = errors;
  }
}


// purpose:		run a graphql query
// arguments:	body of the query (string)
//				options (object), with fetch to use instead of the global one, such as
//				the one a SvelteKit load function receives (function)
// returns:		data returned from the database (object), or the whole response, with its
//				errors, when the instance answered with errors; mutations check .errors
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


// purpose:		run a graphql query whose data is used as it is
//				(graphql() resolves with the whole response when the instance answered with
//				errors, so reading a field of it gave undefined, which looked like no results)
// arguments:	as for graphql()
// returns:		data returned from the database (object), rejecting with a GraphQLError
//				when the instance answered with errors
// ------------------------------------------------------------------------
const graphqlData = (body, options) => {
  return graphql(body, options).then((res) => {
    const errors = graphQLErrors(res);

    if(errors){
      throw new GraphQLError(errors);
    }

    return res;
  });
};



// exports
// ------------------------------------------------------------------------
export { graphql, graphqlData, GraphQLError };
