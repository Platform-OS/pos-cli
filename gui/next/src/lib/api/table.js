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
    const query = `
      query(
        $per_page: Int
        $id: ID
      ) {
        admin_tables(
          per_page: $per_page
          filter: {
            id: { value: $id }
          }
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

    const variables = { per_page: 100, id: id };

    return graphql({ query, variables }).then(data => data.admin_tables.results);
  }
};



// exports
// ------------------------------------------------------------------------
export { table };
