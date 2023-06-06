/*
  gets tables from the database
*/


// imports
// ------------------------------------------------------------------------
import { graphql } from '$lib/api/graphql';



// purpose:		gets table(s) from the database
// arguments:	id of the table information you need (string, optional)
// returns:		array of tables as they appear in the database (array)
// ------------------------------------------------------------------------
const table = {
  get: (id) => {
    const filter = id ? `filter: { id: { value: ${id} } }` : '';

    const query = `
      query {
        admin_model_schemas(
          per_page: 100
          ${filter}
        ) {
          results {
            id
            name
            properties {
              name
              attribute_type
            }
          }
        }
      }`;

    return graphql({ query }, false).then(data => data.admin_model_schemas.results);
  }
};



// exports
// ------------------------------------------------------------------------
export { table }
