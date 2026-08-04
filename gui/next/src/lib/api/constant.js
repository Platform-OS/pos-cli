/*
  operation on instance constants
*/


// imports
// ------------------------------------------------------------------------
import { graphql } from '$lib/api/graphql';



// purpose:		gets constants from the instance
// returns:		array of objects with contants (array)
// ------------------------------------------------------------------------
const constant = {

  get: () => {
    const query = `
      query {
        constants(
          per_page: 100
        ) {
          results {
            name,
            value,
            updated_at
          }
        }
      }`;

    return graphql({ query }, false).then(data => data.constants.results);
  },

  edit: (data) => {
    data = Object.fromEntries(data.entries());

    const query = `
      mutation SetConstant($name: String!, $value: String!) {
        constant_set(name: $name, value: $value){
          name,
          value
        }
      }`;

    return graphql({ query, variables: { name: data.name, value: data.value } }, false);
  },

  delete: (data) => {
    data = Object.fromEntries(data.entries());

    const query = `
      mutation UnsetConstant($name: String!) {
        constant_unset(name: $name){
          name
        }
      }
    `;

    return graphql({ query, variables: { name: data.name } }, false);
  }

};



// exports
// ------------------------------------------------------------------------
export { constant };
