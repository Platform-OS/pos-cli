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
      mutation {
        constant_set(name: "${data.name}", value: "${data.value}"){
          name,
          value
        }
      }`;

    return graphql({ query }, false);
  },

  delete: (data) => {
    data = Object.fromEntries(data.entries());

    const query = `
      mutation {
        constant_unset(name: "${data.name}"){
          name
        }
      }
    `;

    return graphql({ query }, false);
  }

};



// exports
// ------------------------------------------------------------------------
export { constant }
